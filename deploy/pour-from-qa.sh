#!/bin/sh
# POURS THE REAL DATA FROM QA INTO A PRODUCTION DATABASE THAT HAS NEVER BEEN USED. ONCE.
#
# The owner's words on 29.09.2026, given as a choice between offered outcomes:
#   - where the data comes from:  "Prenesi ih sa QA na produkciju"
#   - whether any of it is test:  "Nema, sve je pravo"
#   - what kind of tool:          "Jednokratan, uliva sve odjednom"
# and, earlier, that more real data is still being entered on QA, so this is written now and run
# only when he says he has finished.
#
# Run it ON THE HOST, from /opt/btl/deploy, AFTER the production stack has come up for the first
# time:
#
#   docker compose -f compose.prod.yml build backend
#   docker compose -f compose.prod.yml up -d --build frontend backend
#   sh pour-from-qa.sh --check      # proves everything and pours nothing
#   sh pour-from-qa.sh              # pours
#
# THE ORDER IS FORCED AND IS NOT A PREFERENCE. Flyway runs inside the backend at startup, out of
# classpath:db/migration, and compose.prod.yml says there is no separate step. So production has
# no schema at all until its backend has run once, and this tool REFUSES an unmigrated database
# rather than treating it as an empty one - an empty schema is a fault, not a resting state.
#
# IT CARRIES NO SECRETS AND READS NO .env, which is the same arrangement proveri-qa.sh next to it
# already relies on. Every connection is made with `docker exec` into the database's own
# container and travels over that container's unix socket, which the postgres image trusts for
# local connections, so no password is ever passed, read or stored. The role and database names
# come from the environment with the same defaults compose.prod.yml and compose.qa.yml declare,
# exactly as proveri-qa.sh does it; an operator who changed them in a .env exports the matching
# variable before running this, and the refusal below names it.
#
# WHAT IT REFUSES TO DO, each with the reason it exists:
#
#   - Pour into a database that is not migrated, or whose schema is not what /opt/btl's
#     migrations describe. Compared as pg_dump TEXT against a reference database built here and
#     now out of the migration files, which is the technique proveri-qa.sh section 4 already uses
#     and the rounds that shaped it are written in its header.
#   - Pour out of a QA whose schema is not that same thing. If the two checkouts sit on different
#     commits, QA has columns production does not, and a COPY would put them in the wrong place
#     or fail halfway. That is a finding rather than something to work around.
#   - Pour into a database that carries ANY row its own migrations did not put there. See
#     pour-from-qa/row-counts.sql for why that is what "empty" has to mean, and why it is also
#     what stops a second run from doubling the data.
#   - Skip a table it cannot carry. If the foreign keys form a cycle, no load order exists, and
#     this stops and names the tables rather than pouring the rest.
#
# WHAT IT MOVES, and the second half is the one that is easy to forget: the ROWS of every table,
# and the PHOTOGRAPHS, which are not in the database at all. `photo` holds only a media type, a
# size, a digest and a crop; the bytes live on a Docker volume, in a file named after the
# photo's id (MePhotoApi writes `folder.resolve(String.valueOf(photo))`). A pour of the database
# alone leaves production with rows pointing at files that are not there, which is a portal full
# of pictures that 404 - the phrase compose.prod.yml already uses about a missing volume. The
# ids are poured verbatim, so the files need no renaming and this is a plain copy.
#
# THE PHOTOGRAPHS GO FIRST, and the order is deliberate. Copying files is additive and doing it
# twice changes nothing, while the database side is one transaction that either lands whole or
# not at all. Photographs first means a failed pour leaves files nothing points at, which the
# next run overwrites; the other order would leave rows pointing at files that never arrived.
#
# THE DATABASE SIDE IS ONE TRANSACTION, and that is the real way back rather than the backup.
# TRUNCATE is transactional in PostgreSQL, so a failure anywhere - a constraint, a disconnect, a
# full disk - rolls the whole thing back and leaves production byte for byte as it was. A
# pg_dump taken beforehand is still worth having, but it covers a different case: this tool being
# WRONG, not this tool failing.
#
# ONE COPY PER TABLE IS A CONDITION OF CORRECTNESS, NOT A WAY OF GOING FASTER, and it is measured
# rather than argued. See the paragraph on self references in pour-from-qa/load-order.sql.
#
# FOREIGN KEYS STAY ENFORCED THROUGHOUT. `pg_dump --data-only` would need --disable-triggers to
# load in an order it does not control, and the header of proveri-qa.sh records what turning
# those off means: measured, "a row naming a role that does not exist went into account". So the
# order is computed instead, out of pg_constraint, and every key checks every row.

set -eu

say() { printf '%s\n' "$*"; }
fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }

CHECK_ONLY=no
case "${1:-}" in
  --check) CHECK_ONLY=yes ;;
  '') ;;
  *) fail "unknown argument '$1'; this takes --check or nothing at all" ;;
esac

PROD_COMPOSE=compose.prod.yml
MIGRATIONS=../backend/src/main/resources/db/migration
SQL=pour-from-qa
REFERENCE=btl-pour-reference
QA_POSTGRES=qa-postgres
QA_BACKEND=qa-backend

# The same names and the same defaults the two compose files declare, and the same way
# proveri-qa.sh reads them. No password is among them and none is needed: see the header.
PROD_ROLE=${PROD_POSTGRES_USER:-btl}
PROD_NAME=${PROD_POSTGRES_DB:-btl}
QA_ROLE=${QA_POSTGRES_USER:-btl_qa}
QA_NAME=${QA_POSTGRES_DB:-btl_qa}

# Each of the three named ONCE, here, and used through these names below. Naming a file twice -
# once to check it is there and again to run it - is a second home for the same fact, and the
# half that PouringFromQaTest holds is exactly that the script and the folder agree about which
# files exist. With one mention each, renaming one here and leaving the file alone fails that
# case; with two, it would take two edits to be caught and one edit to slip through.
ORDER_SQL="$SQL/load-order.sql"
COUNTS_SQL="$SQL/row-counts.sql"
SEQUENCES_SQL="$SQL/sequences.sql"

[ -f "$PROD_COMPOSE" ] || fail "no $PROD_COMPOSE here; this is run from /opt/btl/deploy"
[ -d "$MIGRATIONS" ] || fail "no $MIGRATIONS; the checkout beside this deploy is not complete"
for f in "$ORDER_SQL" "$COUNTS_SQL" "$SEQUENCES_SQL"; do
  [ -f "$f" ] || fail "no $f; this tool is a shell script AND its SQL, and half is missing"
done

WORK=$(mktemp -d)
# shellcheck disable=SC2064
trap "docker rm -f '$REFERENCE' >/dev/null 2>&1 || true; rm -rf '$WORK'" EXIT

say '--- 1. both stacks are up ---'

PROD_DB=$(docker compose -f "$PROD_COMPOSE" ps -q postgres)
[ -n "$PROD_DB" ] || fail "the production postgres is not running. Bring the stack up first:
  docker compose -f $PROD_COMPOSE build backend
  docker compose -f $PROD_COMPOSE up -d --build frontend backend
Its backend runs the migrations on startup, and there is nothing to pour into until it has."
PROD_BACKEND=$(docker compose -f "$PROD_COMPOSE" ps -q backend)
[ -n "$PROD_BACKEND" ] || fail "the production backend is not running, so the migrations have
not been applied and the photographs have nowhere to go."

docker inspect -f '{{.State.Status}}' "$QA_POSTGRES" >/dev/null 2>&1 \
  || fail "the QA database container '$QA_POSTGRES' is not there; QA is where the data comes from"
docker inspect -f '{{.State.Status}}' "$QA_BACKEND" >/dev/null 2>&1 \
  || fail "the QA backend container '$QA_BACKEND' is not there, and it is what names the photo folder"

prod_sql() { docker exec -i "$PROD_DB" psql -v ON_ERROR_STOP=1 -U "$PROD_ROLE" -d "$PROD_NAME" -tA "$@"; }
qa_sql() { docker exec -i "$QA_POSTGRES" psql -v ON_ERROR_STOP=1 -U "$QA_ROLE" -d "$QA_NAME" -tA "$@"; }
ref_sql() { docker exec -i "$REFERENCE" psql -v ON_ERROR_STOP=1 -U postgres -d ref -tA "$@"; }

prod_sql -c 'select 1' > /dev/null 2>"$WORK/reach.err" \
  || fail "cannot read production as role '$PROD_ROLE' in database '$PROD_NAME'.
If deploy/.env names others, export PROD_POSTGRES_USER and PROD_POSTGRES_DB and run again.
$(cat "$WORK/reach.err")"
qa_sql -c 'select 1' > /dev/null 2>"$WORK/reach.err" \
  || fail "cannot read QA as role '$QA_ROLE' in database '$QA_NAME'.
If the QA .env names others, export QA_POSTGRES_USER and QA_POSTGRES_DB and run again.
$(cat "$WORK/reach.err")"
say "production: $PROD_NAME as $PROD_ROLE      QA: $QA_NAME as $QA_ROLE"

say ''
say '--- 2. a reference database, built here and now out of the migration files ---'

# The IMAGE and not its tag, for the reason proveri-qa.sh gives beside the same line: a tag
# moves, and what is compared below is pg_dump TEXT, whose format does change between releases.
IMAGE=$(docker inspect -f '{{.Image}}' "$PROD_DB")

want=$(ls "$MIGRATIONS" | sed -n 's/^V\([0-9][0-9]*\)__.*\.sql$/\1/p' | sort -n | tr '\n' ' ' | sed 's/ *$//')
[ -n "$want" ] || fail "$MIGRATIONS holds no V<number>__*.sql at all, so the checkout is not complete"

docker rm -f "$REFERENCE" >/dev/null 2>&1 || true
# Reachable only from inside its own container - no port is published and it is removed by the
# trap above - so it is told to trust the local socket rather than being given a password to
# hold. Nothing signs in to it but the two `docker exec` calls below.
docker run -d --name "$REFERENCE" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=ref \
  "$IMAGE" >/dev/null

waited=0
# Over TCP and not the unix socket: the socket exists during the image's own bootstrap phase,
# while the temporary server is still refusing real connections. proveri-qa.sh measured two runs
# in twelve getting through that window.
until docker exec "$REFERENCE" pg_isready -q -h 127.0.0.1 -U postgres -d ref 2>/dev/null; do
  waited=$((waited + 1))
  [ "$waited" -lt 90 ] || fail 'the reference database did not come up within 90 seconds'
  sleep 1
done

# In the order of the VERSIONS and not of the file names: a glob sorts V10 before V2.
for version in $want; do
  file=$(ls "$MIGRATIONS"/V"$version"__*.sql)
  [ "$(printf '%s\n' "$file" | wc -l)" = 1 ] \
    || fail "more than one file carries version $version, which Flyway would not take either: $file"
  docker exec -i "$REFERENCE" psql -q -v ON_ERROR_STOP=1 -U postgres -d ref -1 -f - < "$file" \
    || fail "$file does not apply even to an empty database, so the checkout is not what was merged"
done
say "reference built from $(printf '%s' "$want" | wc -w) migrations"

say ''
say '--- 3. both databases carry exactly the migrations this checkout does ---'

applied_by() {
  docker exec -i "$1" psql -v ON_ERROR_STOP=1 -U "$2" -d "$3" -tAc \
    "select version from flyway_schema_history where success order by version::integer" \
    > "$WORK/applied" 2>"$WORK/applied.err" \
    || fail "$4 has no readable flyway_schema_history, so Flyway has not run there at all.
$(cat "$WORK/applied.err")"
  tr '\n' ' ' < "$WORK/applied" | sed 's/ *$//'
}

have=$(applied_by "$PROD_DB" "$PROD_ROLE" "$PROD_NAME" production)
[ "$have" = "$want" ] || fail "production carries migrations [$have] and this checkout carries [$want].
Its backend applies them on startup, so bring the stack up and let it finish before pouring."

qa_have=$(applied_by "$QA_POSTGRES" "$QA_ROLE" "$QA_NAME" QA)
[ "$qa_have" = "$want" ] || fail "QA carries migrations [$qa_have] and /opt/btl carries [$want].
The two checkouts are on different commits. Pull and redeploy both so they agree, then run again."

failed=$(prod_sql -c "select count(*) from flyway_schema_history where not success")
[ "$failed" = 0 ] || fail "$failed migrations are recorded on production as having failed"
say "both carry all $(printf '%s' "$want" | wc -w)"

say ''
say '--- 4. and both schemas are what those migrations describe, line for line ---'

# Only the two tokens go: pg_dump 18 fills them with a fresh random string on every run.
clean() { grep -vE '^(\\restrict |\\unrestrict )' "$1"; }

dump_into() {
  docker exec "$1" pg_dump -U "$2" -d "$3" --schema-only --no-owner --no-acl \
    --exclude-table=flyway_schema_history > "$4" || fail "pg_dump against $5 did not pass"
  [ -s "$4" ] || fail "the schema dump of $5 is empty, so the comparison below would claim nothing"
}

dump_into "$REFERENCE" postgres ref "$WORK/ref.raw" 'the reference'
clean "$WORK/ref.raw" > "$WORK/ref.sql"

dump_into "$PROD_DB" "$PROD_ROLE" "$PROD_NAME" "$WORK/production.raw" production
dump_into "$QA_POSTGRES" "$QA_ROLE" "$QA_NAME" "$WORK/qa.raw" QA

for side in production qa; do
  clean "$WORK/$side.raw" > "$WORK/$side.sql"
  if ! diff -u "$WORK/ref.sql" "$WORK/$side.sql" > "$WORK/$side.diff"; then
    say "difference (- what the migrations describe, + what $side carries):"
    sed -n '3,$p' "$WORK/$side.diff" | grep -E '^[-+]' || true
    fail "the schema on $side is not what the migrations describe"
  fi
done
say "both match the reference, $(wc -l < "$WORK/ref.sql") lines each"

say ''
say '--- 5. production carries nothing its own migrations did not put there ---'

prod_sql -F'|' -f - < "$COUNTS_SQL" > "$WORK/prod.counts"
ref_sql -F'|' -f - < "$COUNTS_SQL" > "$WORK/ref.counts"

if ! diff -u "$WORK/ref.counts" "$WORK/prod.counts" > "$WORK/counts.diff"; then
  say 'difference (- what a fresh migration leaves, + what production holds):'
  sed -n '3,$p' "$WORK/counts.diff" | grep -E '^[-+]' || true
  fail "production is NOT empty: it holds rows its migrations did not write.
If this pour has already been run, it is finished and must not be run twice - running it again
is what would double the data. If somebody has been using the portal, stop and decide what to
keep; this tool will not merge."
fi
say "empty, against $(wc -l < "$WORK/ref.counts") tables that a fresh migration seeds or leaves bare"

say ''
say '--- 6. the order the tables may be filled in, asked of the foreign keys ---'

qa_sql -F'|' -f - < "$ORDER_SQL" > "$WORK/order"
[ -s "$WORK/order" ] || fail 'the load order came back empty'

# A table in a cycle comes back with no level. Named rather than skipped.
if grep -q '|$' "$WORK/order"; then
  say 'these tables are in a foreign key cycle, so no order exists for them:'
  grep '|$' "$WORK/order" | sed 's/|$//' | sed 's/^/  /'
  fail 'the foreign keys form a cycle; nothing was poured and nothing was skipped'
fi

TABLES=$(cut -d'|' -f1 "$WORK/order" | tr '\n' ' ' | sed 's/ *$//')
say "$(printf '%s' "$TABLES" | wc -w) tables, deepest level $(cut -d'|' -f2 "$WORK/order" | sort -n | tail -1)"

say ''
say '--- 7. where the photographs are, and where they will go ---'

# Resolved BEFORE the --check exit below, deliberately. A --check that stopped at step 6 would
# answer "ready" for a stack whose photograph volume is missing or shared, and the real run
# would then copy the rows and fail here - which is the one moment the two halves must not be
# allowed to disagree, since the files move before the transaction does.
#
# Asked of each backend rather than written out: the container says where it keeps pictures,
# and Docker says which volume is mounted there. WhatEachStackRequiresTest holds the other end
# of that, comparing the setting against the mount for every deployed stack.
photos_of() {
  folder=$(docker exec "$1" printenv BTL_PHOTOS_FOLDER)
  [ -n "$folder" ] || fail "$2 does not say where it keeps photographs"
  docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$folder\"}}{{.Name}}{{end}}{{end}}" "$1"
}

QA_VOLUME=$(photos_of "$QA_BACKEND" 'the QA backend')
PROD_VOLUME=$(photos_of "$PROD_BACKEND" 'the production backend')
[ -n "$QA_VOLUME" ] || fail 'the QA backend mounts no volume where it says it keeps photographs'
[ -n "$PROD_VOLUME" ] || fail 'the production backend mounts no volume where it says it keeps
photographs, so anything copied would go into a container layer and vanish on the next build'
[ "$QA_VOLUME" != "$PROD_VOLUME" ] || fail "both stacks name the same volume '$QA_VOLUME',
which would mean production and QA share their members' photographs"
say "from $QA_VOLUME to $PROD_VOLUME"

if [ "$CHECK_ONLY" = yes ]; then
  say ''
  say 'CHECK ONLY: everything above passed and nothing was poured.'
  exit 0
fi

say ''
say '--- 8. copying the photographs, which are not in the database ---'

docker run --rm --entrypoint sh -v "$QA_VOLUME":/from:ro -v "$PROD_VOLUME":/to "$IMAGE" \
  -c 'cp -a /from/. /to/' || fail 'copying the photographs did not pass'

from_count=$(docker run --rm --entrypoint sh -v "$QA_VOLUME":/from:ro "$IMAGE" -c 'ls -A /from | wc -l')
to_count=$(docker run --rm --entrypoint sh -v "$PROD_VOLUME":/to:ro "$IMAGE" -c 'ls -A /to | wc -l')
[ "$from_count" = "$to_count" ] \
  || fail "QA holds $from_count photographs and production now holds $to_count; nothing was poured into the database"
say "$to_count photographs copied from $QA_VOLUME to $PROD_VOLUME"

say ''
say '--- 9. the pour, as one transaction ---'

STREAM="$WORK/pour.sql"
: > "$STREAM"
{
  printf 'begin;\n'
  # Every table in ONE truncate: a truncate must name every table a foreign key points from, and
  # naming all of them is how that is satisfied without CASCADE, which would widen silently.
  # No RESTART IDENTITY on purpose - the sequences take QA's positions below, not 1.
  printf 'truncate table %s;\n' "$(printf '%s' "$TABLES" | sed 's/ /, /g')"
} >> "$STREAM"

for table in $TABLES; do
  printf 'copy public.%s from stdin;\n' "$table" >> "$STREAM"
  docker exec "$QA_POSTGRES" psql -v ON_ERROR_STOP=1 -U "$QA_ROLE" -d "$QA_NAME" \
    -c "copy public.$table to stdout" >> "$STREAM" \
    || fail "reading $table out of QA did not pass; nothing has been written to production"
  printf '\\.\n' >> "$STREAM"
done

# Where every sequence stands on QA, written out as the statements that put production there.
qa_sql -f - < "$SEQUENCES_SQL" >> "$STREAM" \
  || fail 'reading the sequence positions out of QA did not pass; nothing has been written to production'

printf 'commit;\n' >> "$STREAM"

# Into a file and then read, never through a pipe: `sh` has no pipefail, and through one the exit
# code of psql is invisible.
if ! docker exec -i "$PROD_DB" psql -v ON_ERROR_STOP=1 -U "$PROD_ROLE" -d "$PROD_NAME" \
     -f - < "$STREAM" > "$WORK/pour.log" 2>&1; then
  say 'the last lines of what production said:'
  tail -20 "$WORK/pour.log" | sed 's/^/  /'
  fail 'the pour did not pass. It was one transaction, so production is exactly as it was before
this ran, and the photographs copied in step 8 point at nothing until it is run again.'
fi
say 'poured'

say ''
say '--- 10. production now holds what QA holds ---'

prod_sql -F'|' -f - < "$COUNTS_SQL" > "$WORK/prod.after"
qa_sql -F'|' -f - < "$COUNTS_SQL" > "$WORK/qa.after"

if ! diff -u "$WORK/qa.after" "$WORK/prod.after" > "$WORK/after.diff"; then
  say 'difference (- QA, + production):'
  sed -n '3,$p' "$WORK/after.diff" | grep -E '^[-+]' || true
  fail 'production does not hold what QA holds, although the transaction committed'
fi

say ''
say 'WHAT CAME OVER'
awk -F'|' '$2 > 0 { printf "  %-40s %s\n", $1, $2 }' "$WORK/prod.after"
say "  $(awk -F'|' '$2 == 0' "$WORK/prod.after" | wc -l) further tables are empty on both sides"

# WHICH OF THOSE ROWS LET SOMEBODY IN, asked of the catalogue rather than listed here. Every
# table carrying a `token_hash` holds what the portal checks a visitor's token against: it keeps
# the SHA-256 of a secret the holder was given, and signs in whoever presents a secret that
# hashes to a stored row. That digest is UNKEYED - measured 29.09.2026, SecretToken.hashOf is a
# plain MessageDigest over the secret with nothing from the environment in it - so a row poured
# here answers on production exactly as it did on QA. Said out loud rather than quietly left
# behind, because leaving it out would be this tool deciding something nobody asked it to.
say ''
LETS_IN=$(prod_sql -F'|' -c "select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'token_hash' and a.attnum > 0
 where n.nspname = 'public' and c.relkind = 'r' order by c.relname collate \"C\"")
say 'AND WHAT OF IT LETS SOMEBODY IN. These tables hold what the portal checks a visitor against,'
say 'and their rows now answer on production exactly as they did on QA:'
for t in $LETS_IN; do
  say "  $t: $(awk -F'|' -v t="$t" '$1 == t { print $2 }' "$WORK/prod.after")"
done
say 'So a browser still holding a QA session is signed in here, and a link mailed from QA works here.'
say 'Emptying those tables ends every one of them, and costs nothing but a fresh sign-in.'

say ''
say 'DONE. This tool must not be run again against this database, and it will refuse to be.'
