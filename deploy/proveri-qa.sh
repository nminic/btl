#!/bin/sh
# What QA is really serving, asked of the running stack rather than of the repo.
#
# Written 09.09.2026, on the owner's decision that quality is checked after a merge and not only
# before one (ADL A39). The gate measures a schema Testcontainers builds from nothing; the QA
# database has a history, and a migration that passes on an empty database can still fail on one
# that already carries rows. No test in the repo sees that difference.
#
# Run it on the server, from /opt/btl-qa/deploy, after every deploy:
#
#   sh proveri-qa.sh
#
# It exits non-zero on the first thing that is not what it should be, and says which.
#
# THE TWO FLOORS, because the first draft of this file had neither and a round on 09.09.2026
# measured both holes on real infrastructure:
#
#   - Which migrations must be there is read off the CHECKOUT this script runs inside, one version
#     per V<n>__*.sql file. The first draft asked only for "more than none", so a database that had
#     lost a merged migration - four applied out of five, the table gone, the history row gone,
#     which is what is left after a hand `flyway repair` - printed SVE PROVERE PROSLE and exited 0.
#     That is the exact state A39 exists for, and it is the one state the gate cannot see.
#   - What the schema must CARRY is read off qa-katalog.txt beside this file, line for line: every
#     table, every constraint with its kind, every index. The first draft printed those counts and
#     asserted nothing about them, so a psql that answered zero to all three, and a real database
#     with `place` dropped, both passed.
#
# The catalogue is regenerated on the server, from a database whose migrations have all just been
# applied, and committed:
#
#   sh proveri-qa.sh --zapisi
#
# What that blesses, said out loud rather than left to be assumed: the catalogue is a snapshot of a
# live schema, so it is only as right as the deploy that made it. What keeps it honest is that it
# carries the migration versions it was written for, and refuses to be used against any other set -
# so a migration merged after it was written cannot be checked against it by accident. That a
# migration builds what it says it builds is the gate's question, and the gate answers it against a
# schema built from nothing.

set -eu

say() { printf '%s\n' "$*"; }
fail() { printf 'PALO: %s\n' "$*" >&2; exit 1; }

MIGRATIONS=../backend/src/main/resources/db/migration
CATALOGUE=./qa-katalog.txt

psql() { docker exec qa-postgres psql -U "${QA_POSTGRES_USER:-btl_qa}" -d "${QA_POSTGRES_DB:-btl_qa}" -tAc "$1"; }

# Everything the schema carries, in one sorted list. contype is cast because `text || "char"` has
# more than one candidate operator in PostgreSQL 18 and the query fails to plan without it.
catalogue_of_the_database() {
  psql "select 'tabela '||tablename from pg_tables where schemaname = 'public'
        union all
        select 'ogranicenje '||contype::text||' '||conname from pg_constraint
         where connamespace = 'public'::regnamespace
        union all
        select 'indeks '||indexname from pg_indexes where schemaname = 'public'
        order by 1"
}

say '--- 1. kontejneri ---'
docker compose -f compose.qa.yml ps --format '{{.Name}}\t{{.State}}\t{{.Status}}'

for name in qa-postgres qa-backend qa-frontend; do
  state=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo missing)
  [ "$state" = running ] || fail "$name nije u stanju running nego $state"
done
say 'sva tri rade'

say ''
say '--- 2. bekend vidi bazu ---'
# A backend that came up against an empty schema also answers UP, because the database is
# reachable and that is all that indicator asks. So the component is read, not the summary.
health=$(docker exec qa-backend curl -fsS localhost:8080/actuator/health) \
  || fail 'actuator/health ne odgovara'
printf '%s\n' "$health" | grep -q '"status":"UP"' || fail "health nije UP: $health"
printf '%s\n' "$health" | grep -q 'PostgreSQL' \
  || fail "health ne imenuje PostgreSQL, dakle baza nije procitana: $health"
say 'health je UP i imenuje PostgreSQL'

say ''
say '--- 3. svaka migracija koju main nosi je primenjena ---'
[ -d "$MIGRATIONS" ] || fail "nema foldera $MIGRATIONS; skripta se pokrece iz /opt/btl-qa/deploy"

# The floor: one version per file, read off the names rather than out of the SQL. A file is on main
# or it is not, and nothing about what it contains matters here.
want=$(ls "$MIGRATIONS" | sed -n 's/^V\([0-9][0-9]*\)__.*\.sql$/\1/p' | sort -n | tr '\n' ' ' | sed 's/ *$//')
[ -n "$want" ] || fail "u $MIGRATIONS nema nijedne V<broj>__*.sql migracije, dakle checkout nije potpun"

have=$(psql "select version from flyway_schema_history where success order by version::integer" \
  | tr '\n' ' ' | sed 's/ *$//') \
  || fail 'flyway_schema_history se ne cita, dakle Flyway nije ni krenuo'

[ "$want" = "$have" ] || fail "primenjene migracije su [$have], a main nosi [$want]"
say "primenjeno svih $(printf '%s' "$want" | wc -w): $want"

failed=$(psql "select count(*) from flyway_schema_history where not success")
[ "$failed" = 0 ] || fail "$failed migracija je zabelezeno kao neuspelo"

if [ "${1:-}" = '--zapisi' ]; then
  say ''
  say "--- zapisujem $CATALOGUE za migracije [$want] ---"
  {
    say '# Sta sema nosi, procitano iz zive QA baze posle deploya u kom su sve migracije prosle.'
    say '# Ne pise se rukom: sh proveri-qa.sh --zapisi'
    printf '# migracije: %s\n' "$want"
    catalogue_of_the_database
  } > "$CATALOGUE"
  say "zapisano redova: $(grep -vc '^#' "$CATALOGUE")"
  exit 0
fi

say ''
say '--- 4. sema nosi tacno ono sto je zapisano, red za red ---'
[ -f "$CATALOGUE" ] || fail "nema $CATALOGUE; napravi ga sa: sh proveri-qa.sh --zapisi"

written_for=$(sed -n 's/^# migracije: //p' "$CATALOGUE")
[ "$written_for" = "$want" ] \
  || fail "katalog je pisan za migracije [$written_for], a main nosi [$want]; posle uspesnog deploya: sh proveri-qa.sh --zapisi"

live=$(mktemp)
recorded=$(mktemp)
# shellcheck disable=SC2064
trap "rm -f '$live' '$recorded'" EXIT

catalogue_of_the_database > "$live"
grep -v '^#' "$CATALOGUE" > "$recorded"

if ! diff -u "$recorded" "$live" > /dev/null; then
  say 'razlika (- zapisano, + u bazi):'
  diff -u "$recorded" "$live" | sed -n '3,$p' | grep -E '^[-+]' || true
  fail 'sema u bazi nije ono sto je zapisano'
fi
say "poklapa se, redova: $(wc -l < "$recorded")"

say ''
say '--- 5. sifarnici nose ono sto migracija tvrdi ---'
for pair in 'country:246' 'place:47016'; do
  table=${pair%%:*}
  want_rows=${pair##*:}
  have_rows=$(psql "select count(*) from $table")
  [ "$have_rows" = "$want_rows" ] || fail "$table nosi $have_rows redova, a migracija tvrdi $want_rows"
  say "$table: $have_rows"
done

say ''
say 'SVE PROVERE PROSLE'
