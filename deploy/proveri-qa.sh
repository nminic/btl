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
# THE TWO FLOORS, because the first draft had neither and two rounds measured both holes on real
# infrastructure:
#
#   - Which migrations must be there is read off the CHECKOUT this script runs inside, one version
#     per V<n>__*.sql file, and the applied set must EQUAL it. The first draft asked only for "more
#     than none", so a database carrying five of six - the table gone, the history row gone, which
#     is what a hand `flyway repair` leaves - printed SVE PROVERE PROSLE and exited 0.
#
#   - What the schema must CARRY is measured against a REFERENCE DATABASE this script builds, here
#     and now, by applying those same migration files into a throwaway postgres container. Both
#     catalogues are then read with one query and compared line for line: every table, every column
#     with its type, nullability, collation and default, every constraint with its definition AND
#     whether it is validated, and every index with its definition.
#
# WHY A REFERENCE DATABASE AND NOT A FILE. The second draft compared against a catalogue committed
# beside this script, and a round measured five ways past it, each exiting 0: a dropped column, a
# CHECK replaced by `check (true)`, a unique index rebuilt over `email` instead of `lower(email)`, a
# constraint restored as NOT VALID over a row that breaks it, and a collation changed from sr_latn.
# All five carried the same object NAMES, and names were all the file held. Worse, the file had to
# be blessed from a live database after every new migration, and that blessing ran BEFORE the schema
# was ever compared - so a broken deploy could write itself a catalogue that matched it.
#
# A reference database has neither problem. PostgreSQL parses the migrations, so the expected side
# is never a list somebody wrote; and it is built from the checkout on every run, so a new migration
# needs no blessing at all. Measured: the six migrations of 09.09.2026 apply in two seconds.
#
# WHAT IT COMPARES, and the list is the query and not a promise: the database's own collation,
# ctype, locale provider and encoding; every relation of every kind - table, partitioned table,
# view, materialised view, foreign table - with its persistence, its row-security flag and its
# storage options; every column with its POSITION, type, nullability, collation, default and
# whether it is generated; every constraint in the schema with its definition and whether it is
# validated, reached through the schema rather than through a table so a domain's constraint is in
# too; every index, sequence, trigger, routine, row-security policy, view body, domain and
# non-default collation; and the number of privileges granted to anybody but the owner.
#
# A round on 09.09.2026 measured all of that as MISSING, eleven mutations passing with `poklapa se`,
# and the sharpest was the last one on that list: two databases whose own collation differs give an
# identical catalogue, while `lower('CUPRIJA')` answers differently in each - and
# `account_email_unique` is an index over `lower(email)`.
#
# WHAT IT STILL DOES NOT SEE, measured rather than assumed:
#
#   - ROWS. Whether `place` holds the right 47016 towns is section 5; whether a migration says what
#     it should say is the gate's question, answered against a schema built from nothing.
#   - WHO OWNS an object. The reference database is built by `postgres` and QA runs as `btl_qa`, so
#     ownership differs on every row by construction. What is compared instead is that nobody but
#     the owner has been granted anything, which is 0 on both sides today.
#   - A MIGRATION THAT MAY NOT RUN IN A TRANSACTION. Flyway takes `executeInTransaction=false`;
#     this applies each file with `psql -1`. None of the migrations needs it today. The day one does
#     - `create index concurrently` is the likely one - it will fail HERE and be reported as a
#     checkout that is not what was merged, which is the wrong sentence. It is written down so the
#     next person recognises it rather than believing it.

set -eu

say() { printf '%s\n' "$*"; }
fail() { printf 'PALO: %s\n' "$*" >&2; exit 1; }

MIGRATIONS=../backend/src/main/resources/db/migration
REFERENCE=btl-qa-referentna-sema

psql() { docker exec qa-postgres psql -U "${QA_POSTGRES_USER:-btl_qa}" -d "${QA_POSTGRES_DB:-btl_qa}" -tAc "$1"; }

# Everything the schema is, not just what the objects are called. Flyway's own table is left out on
# both sides, because the reference database has no Flyway in it; what is in that table is section
# 3's question and it asks it directly.
#
# No ORDER BY: sorting inside the database would sort by that database's collation, and the two
# databases need not have the same one. The client sorts both sides in byte order instead.
FLYWAY="'flyway_schema_history'"

CATALOGUE="
select 'baza ' || d.datcollate || ' ' || d.datctype || ' ' || d.datlocprovider::text
       || ' ' || pg_encoding_to_char(d.encoding)
  from pg_database d where d.datname = current_database()
union all
select 'relacija ' || c.relkind::text || ' ' || c.relname
       || ' ' || c.relpersistence::text
       || case when c.relrowsecurity then ' rls' else ' bez-rls' end
       || coalesce(' opcije ' || array_to_string(c.reloptions, ','), '')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
   and c.relname <> $FLYWAY
union all
select 'kolona ' || c.relname || ' ' || lpad(a.attnum::text, 3, '0') || ' ' || a.attname
       || ' ' || format_type(a.atttypid, a.atttypmod)
       || case when a.attnotnull then ' not-null' else ' nullable' end
       || coalesce(' collate ' || (select co.collname from pg_collation co
                                    where co.oid = a.attcollation and co.collname <> 'default'), '')
       || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
       || case when a.attgenerated <> '' then ' generated' else '' end
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
 where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
   and a.attnum > 0 and not a.attisdropped and c.relname <> $FLYWAY
union all
select 'ogranicenje ' || coalesce(c.relname, t.typname, '(sema)') || '.' || con.conname
       || case when con.convalidated then ' validated ' else ' NIJE-VALIDIRANO ' end
       || pg_get_constraintdef(con.oid)
  from pg_constraint con
  left join pg_class c on c.oid = con.conrelid
  left join pg_type t on t.oid = con.contypid
 where con.connamespace = 'public'::regnamespace
   and coalesce(c.relname, '') <> $FLYWAY
union all
select 'indeks ' || indexdef from pg_indexes
 where schemaname = 'public' and tablename <> $FLYWAY
union all
select 'sekvenca ' || sequencename || ' ' || data_type::text || ' start ' || start_value
       || ' korak ' || increment_by || ' od ' || min_value || ' do ' || max_value
       || case when cycle then ' ciklicno' else ' bez-ciklusa' end
  from pg_sequences where schemaname = 'public'
union all
select 'okidac ' || pg_get_triggerdef(tg.oid)
  from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and not tg.tgisinternal
union all
select 'rutina ' || p.prokind::text || ' ' || p.proname
       || '(' || pg_get_function_identity_arguments(p.oid) || ') -> '
       || pg_get_function_result(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
union all
select 'politika ' || tablename || '.' || policyname || ' ' || cmd
       || coalesce(' using ' || qual, '') || coalesce(' with ' || with_check, '')
  from pg_policies where schemaname = 'public'
union all
select 'pogled ' || viewname || ' ' || md5(definition) from pg_views where schemaname = 'public'
union all
select 'materijalizovan ' || matviewname || ' ' || md5(definition)
  from pg_matviews where schemaname = 'public'
union all
select 'domen ' || t.typname || ' ' || format_type(t.typbasetype, t.typtypmod)
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
 where n.nspname = 'public' and t.typtype = 'd'
union all
select 'kolacija ' || co.collname || ' ' || co.collprovider::text
       || ' ' || coalesce(co.colllocale, co.collcollate, '?')
       || case when co.collisdeterministic then ' deterministicka' else ' nedeterministicka' end
  from pg_collation co join pg_namespace n on n.oid = co.collnamespace
 where n.nspname = 'public'
union all
select 'prava-izvan-vlasnika ' || count(*)::text
  from information_schema.role_table_grants g
  join pg_class c on c.relname = g.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = g.table_schema
 where g.table_schema = 'public' and g.grantee <> pg_get_userbyid(c.relowner)
"

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

# One version per file, read off the names rather than out of the SQL. A file is on main or it is
# not, and nothing about what it contains matters here.
want=$(ls "$MIGRATIONS" | sed -n 's/^V\([0-9][0-9]*\)__.*\.sql$/\1/p' | sort -n | tr '\n' ' ' | sed 's/ *$//')
[ -n "$want" ] || fail "u $MIGRATIONS nema nijedne V<broj>__*.sql migracije, dakle checkout nije potpun"

have=$(psql "select version from flyway_schema_history where success order by version::integer" \
  | tr '\n' ' ' | sed 's/ *$//') \
  || fail 'flyway_schema_history se ne cita, dakle Flyway nije ni krenuo'

[ "$want" = "$have" ] || fail "primenjene migracije su [$have], a main nosi [$want]"
say "primenjeno svih $(printf '%s' "$want" | wc -w): $want"

failed=$(psql "select count(*) from flyway_schema_history where not success")
[ "$failed" = 0 ] || fail "$failed migracija je zabelezeno kao neuspelo"

say ''
say '--- 4. sema je ono sto migracije opisuju, do definicije ---'

# The same image QA is running, asked of the running container rather than written here, so the
# reference cannot be built by a different PostgreSQL than the one being measured.
image=$(docker inspect -f '{{.Config.Image}}' qa-postgres)

live=$(mktemp)
expected=$(mktemp)
# shellcheck disable=SC2064
trap "docker rm -f '$REFERENCE' >/dev/null 2>&1 || true; rm -f '$live' '$expected'" EXIT

docker rm -f "$REFERENCE" >/dev/null 2>&1 || true
docker run -d --name "$REFERENCE" -e POSTGRES_PASSWORD=referentna -e POSTGRES_DB=ref "$image" >/dev/null

waited=0
# Over TCP and not over the unix socket, which is what compose.qa.yml two files away already
# writes down and explains: the socket exists during the image own bootstrap phase, while the
# temporary server is still refusing real connections, so a gate over it opens too early. Measured
# on the QA host on 09.09.2026: two runs in twelve got through that window, the migrations went to
# the bootstrap server, it was shut down under them, and the script blamed the checkout.
until docker exec "$REFERENCE" pg_isready -q -h 127.0.0.1 -U postgres -d ref 2>/dev/null; do
  waited=$((waited + 1))
  [ "$waited" -lt 60 ] || fail "referentna baza se nije digla za 60 sekundi"
  sleep 1
done

# In the order of the VERSIONS and not of the file names, and taken from the same `$want` section 3
# already sorted numerically, so the order has one home rather than two. A glob sorts V10 before V2,
# and a round on 09.09.2026 measured what that does: the reference build dies on the first file and
# blames the checkout, from V10 onwards, for ever.
for version in $want; do
  file=$(ls "$MIGRATIONS"/V"$version"__*.sql)
  [ "$(printf '%s\n' "$file" | wc -l)" = 1 ] \
    || fail "vise fajlova nosi verziju $version, sto ni Flyway ne prima: $file"
  docker exec -i "$REFERENCE" psql -q -v ON_ERROR_STOP=1 -U postgres -d ref -1 -f - < "$file" \
    || fail "$file ne prolazi ni na praznoj bazi, dakle checkout nije ono sto je spojeno"
done
say "referentna sema napravljena od $(printf '%s' "$want" | wc -w) migracija"

psql "$CATALOGUE" | LC_ALL=C sort > "$live"
docker exec "$REFERENCE" psql -U postgres -d ref -tAc "$CATALOGUE" | LC_ALL=C sort > "$expected"

[ -s "$expected" ] || fail 'referentna sema je prazna, dakle poredjenje ispod ne tvrdi nista'

if ! diff -u "$expected" "$live" > /dev/null; then
  say 'razlika (- ono sto migracije opisuju, + ono sto QA nosi):'
  diff -u "$expected" "$live" | sed -n '3,$p' | grep -E '^[-+]' || true
  fail 'sema na QA nije ono sto migracije opisuju'
fi
say "poklapa se, redova: $(wc -l < "$expected")"

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
