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

set -eu

say() { printf '%s\n' "$*"; }
fail() { printf 'PALO: %s\n' "$*" >&2; exit 1; }

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
say '--- 3. migracije su stvarno primenjene ---'
psql() { docker exec qa-postgres psql -U "${QA_POSTGRES_USER:-btl_qa}" -d "${QA_POSTGRES_DB:-btl_qa}" -tAc "$1"; }

applied=$(psql "select count(*) from flyway_schema_history where success") \
  || fail 'flyway_schema_history se ne cita, dakle Flyway nije ni krenuo'
[ "$applied" -gt 0 ] || fail 'nijedna migracija nije primenjena; Flyway nije nasao migracije na classpath-u'
say "primenjenih migracija: $applied"

failed=$(psql "select count(*) from flyway_schema_history where not success")
[ "$failed" = 0 ] || fail "$failed migracija je zabelezeno kao neuspelo"

say ''
say '--- 4. ogranicenja stvarno postoje u zivoj bazi ---'
# Not "the file says so" but "the database carries it". A migration that passed the gate on an
# empty schema can still have been skipped here.
tables=$(psql "select count(*) from pg_tables where schemaname = 'public'")
checks=$(psql "select count(*) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c'")
uniques=$(psql "select count(*) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'u'")
keys=$(psql "select count(*) from pg_constraint where connamespace = 'public'::regnamespace and contype = 'f'")
say "tabela: $tables, CHECK: $checks, UNIQUE: $uniques, stranih kljuceva: $keys"
[ "$tables" -gt 1 ] || fail 'sema nosi samo Flywayevu tabelu istorije, dakle nijedna migracija nije nista napravila'

say ''
say '--- 5. sifarnici nose ono sto migracija tvrdi ---'
for pair in 'country:246' 'place:47016'; do
  table=${pair%%:*}
  want=${pair##*:}
  have=$(psql "select count(*) from $table" 2>/dev/null || echo missing)
  [ "$have" = missing ] && { say "$table: tabele nema (jos nije stigla migracija koja je pravi)"; continue; }
  [ "$have" = "$want" ] || fail "$table nosi $have redova, a migracija tvrdi $want"
  say "$table: $have"
done

say ''
say 'SVE PROVERE PROSLE'
