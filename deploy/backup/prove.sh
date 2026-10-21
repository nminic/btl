#!/bin/sh
# THE MONTHLY PROOF THAT A COPY RESTORES (ADL O19, "dokazanim vracanjem jednom mesecno"), AFTER THE
# RESTORE ITSELF HAS RUN.
#
# Run by deploy/backup.sh --prove inside the throwaway database it started (no network, its data
# folder in memory), after check.sh opened the copy and restore-database.sh restored its dump:
#
#   prove.sh counts <work folder>          every table holds what the DUMP says it holds
#   prove.sh age <work folder> <now>       the copy is no older than 26 hours
#   prove.sh record <work folder> <now>    writes <work folder>/proof.txt, which holds no member
#
# Separate steps so that each can be run alone against a database a case has changed on purpose.
#
# THE EXPECTED COUNTS ARE READ OUT OF THE DUMP STREAM AND NEVER OUT OF THE RESTORED DATABASE. A
# count taken from the database that was restored and compared with the same database says that
# the database equals itself. Read out of the dump - one line of a COPY block is one row, because
# COPY's text form writes a line break inside a value as \n - it says what the copy carries, and
# the restored database is then asked whether it holds exactly that, table for table, and holds no
# table the dump does not.
#
# AND A FLOOR THAT AN EMPTY RESTORE CANNOT MEET. Equal counts are also what two empty sides give: a
# dump of a database nobody migrated restores into nothing and matches. So the copy has to carry
# flyway_schema_history with at least one migration in it, and at least one row beside it. Every
# real copy carries far more (the migrations seed eleven tables); this floor asks only for what
# nothing empty can have.
#
# 26 HOURS is the owner's number (ADL O19, decision (3) of 20.10.2026: "kad 26 sati nema nove
# kopije"), the same one the Worker beside deploy/cloudflare/no-reply-reject.js watches for. The age
# is read from the manifest, which is inside the encryption, and not from R2's own date.

set -eu
umask 077

STEP=${1:?prove.sh needs a step: counts, age or record}
WORK=${2:?prove.sh needs the work folder}
OUT="$WORK/check"

fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }

DAY_AND_TWO_HOURS=93600

sql() { psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA "$@"; }

[ -s "$OUT/btl.dump" ] || fail "there is no dump in $OUT; check.sh opens the copy first"

case "$STEP" in
  counts)
    # One line per table: the name exactly as pg_dump wrote it after COPY, which is the qualified
    # and, where it has to be, quoted name, and the number of rows its block holds.
    if ! { if pg_restore --data-only --file=- "$OUT/btl.dump" 2> "$WORK/counts.err"; then
             printf '0\n' > "$WORK/counts.status"
           else
             printf '%s\n' "$?" > "$WORK/counts.status"
           fi; } \
         | awk '
             /^COPY / { name = $2; inside = 1; rows[name] = 0; order[++n] = name; next }
             inside && /^\\\.$/ { inside = 0; next }
             inside { rows[name]++ }
             END { for (i = 1; i <= n; i++) print order[i], rows[order[i]] }
           ' > "$WORK/counts.dump"; then
      fail 'the rows of the dump could not be counted'
    fi
    [ "$(cat "$WORK/counts.status")" = 0 ] || fail 'pg_restore could not read the data of the dump'
    sort "$WORK/counts.dump" > "$WORK/counts.expected"

    grep -q '^public\.flyway_schema_history [1-9]' "$WORK/counts.expected" \
      || fail 'the copy carries no flyway_schema_history with a migration in it, so it is the copy of a database nobody migrated, and equal counts would prove nothing'
    total=$(awk '{ t += $2 } END { print t + 0 }' "$WORK/counts.expected")
    [ "$total" -gt 0 ] || fail 'the copy carries no row at all'

    # The restored side: every table the database now has, by the same spelling, and its count.
    sql -c "select quote_ident(schemaname) || '.' || quote_ident(tablename) from pg_tables where schemaname = 'public' order by 1" \
      > "$WORK/tables.restored"
    : > "$WORK/counts.restored"
    while read -r table; do
      printf '%s %s\n' "$table" "$(sql -c "select count(*) from $table" < /dev/null)" >> "$WORK/counts.restored"
    done < "$WORK/tables.restored"
    sort "$WORK/counts.restored" > "$WORK/counts.got"

    if ! diff "$WORK/counts.expected" "$WORK/counts.got" > "$WORK/counts.diff"; then
      printf 'difference (< what the dump carries, > what the restored database holds):\n' >&2
      grep -E '^[<>]' "$WORK/counts.diff" | sed 's/^/  /' >&2
      fail 'the restored database does not hold what the copy carries'
    fi
    printf 'counted: %s tables, %s rows, the same in the dump and in the restored database\n' \
      "$(wc -l < "$WORK/counts.got" | tr -d ' ')" "$total"
    ;;

  age)
    NOW=${3:?prove.sh age needs the time, in seconds since 1970}
    created=$(sed -n 's/^created //p' "$OUT/manifest")
    [ -n "$created" ] || fail 'the manifest says nothing about when the copy was made'
    age=$((NOW - created))
    [ "$age" -ge 0 ] || fail "the copy says it was made $((0 - age)) seconds in the future, so a clock is wrong"
    [ "$age" -le "$DAY_AND_TWO_HOURS" ] \
      || fail "the newest copy is $((age / 3600)) hours old; the owner's limit is 26, so the nightly copy has stopped"
    printf 'aged: %s hours\n' "$((age / 3600))"
    ;;

  record)
    NOW=${3:?prove.sh record needs the time, in seconds since 1970}
    [ -s "$WORK/counts.got" ] || fail 'record comes after counts'
    {
      printf 'btl-backup-proof 1\n'
      printf 'proven %s\n' "$NOW"
      printf 'copy-created %s\n' "$(sed -n 's/^created //p' "$OUT/manifest")"
      printf 'tables %s\n' "$(wc -l < "$WORK/counts.got" | tr -d ' ')"
      printf 'rows %s\n' "$(awk '{ t += $2 } END { print t + 0 }' "$WORK/counts.got")"
      awk '$1 == "photos" || $1 == "files" || $1 == "strays" { print "copy-" $0 }' "$OUT/summary"
      printf 'migrations %s\n' "$(sql -c 'select count(*) from flyway_schema_history where success')"
      printf 'constraints-not-valid %s\n' "$(sql -c 'select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = '"'public'"' and not c.convalidated')"
      printf 'result restored\n'
    } > "$WORK/proof.txt"
    ;;

  *)
    fail "unknown step '$STEP'; this takes counts, age or record"
    ;;
esac
