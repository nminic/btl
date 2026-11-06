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
# WHAT IT COMPARES, and it is not a list: the SCHEMA AS PostgreSQL ITSELF WRITES IT DOWN.
# `pg_dump --schema-only` of the live database against `pg_dump --schema-only` of the reference,
# line for line. Beside it, every setting whose source is not the built-in default, which is where
# a switch that turns enforcement off is written; and the number of table-level privileges held by
# anybody but the owner, since the dumps are taken without ACLs.
#
# WHY A DUMP AND NOT A QUERY OVER THE CATALOGUES. There was such a query here, and it grew for four
# rounds in a row, each of which found the next catalogue it did not read: names but not
# definitions, then no columns, then no trigger enabled-flag - so `alter database ... set
# session_replication_role = 'replica'` turned off all sixteen foreign keys and it saw nothing -
# then no `postgresql.auto.conf`, no rewrite rules, no policy permissiveness, no routine body.
# Every round the fix was one more branch, and every round there was a next one. That is the shape
# the workspace rules say to stop building: a guard that must ENUMERATE what to look at has no
# floor, and the answer is to compare the whole text against a golden one.
#
# What a dump CANNOT say is asked beside it, and it is a closed list rather than an open one: the
# database's own collation, what is written in the configuration files - the settings, who may
# connect and how they prove it - whether a trigger fires, who holds a privilege, and whether
# the running server refuses a login with no password. None of the five has a DDL form that
# `pg_dump --schema-only` writes,
# so no dump of any schema would carry them.
#
# The other direction is nearly true and the exception is worth naming: what HAS a DDL form is in
# the dump, EXCEPT an index that is not valid, which pg_dump leaves out entirely. That is not a
# hole here - a row that disappears is a difference like any other - but the sentence would be
# wrong without it.
#
# `pg_dump` is that golden text and it costs nothing to keep current, because the golden side is
# generated from the migrations on every run. Measured on the QA host before this was written: the
# two dumps differ in exactly two lines, the `\restrict` and `\unrestrict` tokens pg_dump 18 makes
# at random, and are byte for byte identical without them.
#
# WHAT IT STILL DOES NOT SEE, measured rather than assumed:
#
#   - ROWS. Whether every table the migrations seed still holds as many rows as they leave is
#     section 5; whether a migration says what it should say is the gate's question, answered
#     against a schema built from nothing.
#   - WHO OWNS an object, and the privileges on a column, a sequence or the schema. The dumps are
#     taken `--no-owner --no-acl`, because the reference is built by `postgres` and QA runs as
#     `btl_qa`, so ownership differs on every row by construction. What is compared instead is the
#     count of TABLE-level privileges held by anybody but the owner, 0 on both sides today.
#   - THE CONTENT OF pg_hba.conf BEYOND ITS RULES, such as a comment, an `include_if_exists`
#     directive, or a line the parser rejected without an `error` of its own. What is compared is
#     what PostgreSQL parsed out of that file - which is NOT what decides who gets in. The rules in
#     force are the ones from the last successful reload, and the file can be put back afterwards.
#     That sentence stood here until 10.09.2026 and was overturned by measurement, so the running
#     server is now asked directly whether it refuses a login without a password.
#   - A REPEATABLE `R__` MIGRATION. The reference is built from `V*` only, so a view Flyway has
#     applied from an `R__` file would show up as something QA carries and the migrations do not.
#     No such file exists today; `V1` names the convention. Since 06.11.2026 section 3 REFUSES one,
#     in the checkout or in the history, by name, instead of letting the schema comparison blame
#     the wrong thing.
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

psql() {
  docker exec qa-postgres psql -v ON_ERROR_STOP=1 -U "${QA_POSTGRES_USER:-btl_qa}" \
    -d "${QA_POSTGRES_DB:-btl_qa}" -tAc "$1"
}

# Made first, so that every section below has them and the way out removes them whichever one ends the run.
live=$(mktemp)
expected=$(mktemp)
live_raw=$(mktemp)
expected_raw=$(mktemp)
# shellcheck disable=SC2064
trap "docker rm -f '$REFERENCE' >/dev/null 2>&1 || true; rm -f '$live' '$expected' '$live_raw' '$expected_raw'" EXIT

say '--- 1. kontejneri ---'
docker compose -f compose.qa.yml ps --format '{{.Name}}\t{{.State}}\t{{.Status}}'

# The services are read off the compose file and not named here, so a fourth service with no
# container, or one that is created and not running, is a failure and not a number that was
# written by hand. `ps -a -q` also lists a container that exists and has stopped.
services=$(docker compose -f compose.qa.yml config --services) \
  || fail 'compose.qa.yml se ne cita, dakle spisak servisa nije poznat'
[ -n "$services" ] || fail 'compose.qa.yml ne nosi nijedan servis'

for service in $services; do
  container=$(docker compose -f compose.qa.yml ps -a -q "$service")
  [ -n "$container" ] || fail "servis $service nema kontejner"
  state=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo missing)
  [ "$state" = running ] || fail "servis $service nije u stanju running nego $state"
done
say "svi servisi rade, ih je $(printf '%s\n' "$services" | wc -l)"

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
#
# A REPEATABLE `R__` MIGRATION IS REFUSED, on either side, because the comparison below and the
# reference database in section 4 both know only `V*`: a view Flyway applied from an `R__` file
# would show up as something QA carries and the migrations do not, and the sentence that names the
# cause would be wrong. Refusing it by name says the true thing at the first moment it can be true.
ls "$MIGRATIONS" > "$live_raw"
if grep -q '^R__' "$live_raw"; then
  fail "u $MIGRATIONS stoji R__ migracija, koju ova provera ne zna; sema ispod bi bila poredjena bez nje"
fi

# The version AND the file name, because Flyway keeps both: a history row whose script was renamed
# to something else is a different migration under the same number, and the numbers alone passed it.
sed -n 's/^V\([0-9][0-9]*\)__.*\.sql$/\1 &/p' "$live_raw" | sort -n > "$expected_raw"
[ -s "$expected_raw" ] || fail "u $MIGRATIONS nema nijedne V<broj>__*.sql migracije, dakle checkout nije potpun"

# Into a file and not through a pipe, because `sh` has no pipefail: a psql that fails at the head of
# a pipe is not seen, and the `|| fail` after it belongs to the last command of the pipe.
psql "select version || ' ' || script from flyway_schema_history where success order by version::integer" \
  > "$live_raw" || fail 'flyway_schema_history se ne cita, dakle Flyway nije ni krenuo'

if [ "$(psql "select count(*) from flyway_schema_history where success and version is null")" != 0 ]; then
  fail 'u istoriji stoji R__ migracija, koju ova provera ne zna'
fi

want=$(cut -d' ' -f1 "$expected_raw" | tr '\n' ' ' | sed 's/ *$//')
have=$(cut -d' ' -f1 "$live_raw" | tr '\n' ' ' | sed 's/ *$//')

[ "$want" = "$have" ] || fail "primenjene migracije su [$have], a main nosi [$want]"
if ! diff "$expected_raw" "$live_raw" > /dev/null; then
  say 'isti brojevi, drugi fajlovi (- main, + istorija):'
  diff "$expected_raw" "$live_raw" | grep -E '^[<>]' || true
  fail 'primenjene migracije nose druga imena od onih koje main nosi'
fi
say "primenjeno svih $(printf '%s' "$want" | wc -w): $want"

failed=$(psql "select count(*) from flyway_schema_history where not success")
[ "$failed" = 0 ] || fail "$failed migracija je zabelezeno kao neuspelo"

say ''
say '--- 4. sema je ono sto migracije opisuju, red za red ---'

# The same image QA is running, and the IMAGE and not its tag. `.Config.Image` gives the tag as it
# was written when the container was made, and a tag moves. That mattered little while two
# catalogues were compared, since a minor release does not change a catalogue; it matters now,
# because the comparison is pg_dump TEXT and its format does change between minor releases - the
# two random tokens this script strips arrived exactly that way. `.Image` is the digest, and
# `docker run` takes it. Measured: an image untagged while its container runs still resolves by
# digest, and a digest that resolves to nothing exits 125 rather than pulling something else.
image=$(docker inspect -f '{{.Image}}' qa-postgres)

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

# Only the two tokens go. pg_dump 18 fills them with a fresh random string on every run, so they
# differ between any two dumps and say nothing; everything else stays, comments and blank lines
# included. Measured 09.09.2026: without any cleaning at all the two dumps differ in exactly four
# lines, which are those two on each side, so there is nothing else to remove - and removing more
# was a hole of its own, since `^--` also matches the second line of a string broken across two.
ocisti() { grep -vE '^(\\restrict |\\unrestrict )' "$1"; }

# Into a file first and only then read, because `sh` has no pipefail: through a pipe the exit code
# of pg_dump is invisible, and the floor written for exactly that case could never be reached, since
# `grep -v` that selects nothing exits 1 and `set -e` ends the script before it.
docker exec qa-postgres pg_dump -U "${QA_POSTGRES_USER:-btl_qa}" -d "${QA_POSTGRES_DB:-btl_qa}" \
  --schema-only --no-owner --no-acl --exclude-table=flyway_schema_history > "$live_raw" \
  || fail 'pg_dump nad QA bazom nije prosao'
docker exec "$REFERENCE" pg_dump -U postgres -d ref --schema-only --no-owner --no-acl > "$expected_raw" \
  || fail 'pg_dump nad referentnom bazom nije prosao'

[ -s "$expected_raw" ] || fail 'referentna sema je prazna, dakle poredjenje ispod ne tvrdi nista'
[ -s "$live_raw" ] || fail 'ispis zive seme je prazan'

ocisti "$live_raw" > "$live"
ocisti "$expected_raw" > "$expected"

if ! diff -u "$expected" "$live" > /dev/null; then
  say 'razlika (- ono sto migracije opisuju, + ono sto QA nosi):'
  diff -u "$expected" "$live" | sed -n '3,$p' | grep -E '^[-+]' || true
  fail 'sema na QA nije ono sto migracije opisuju'
fi
say "sema se poklapa, redova: $(wc -l < "$expected")"

# WHAT A DUMP CANNOT SAY, asked beside it. Four things, and each is here because a round measured
# the hole rather than because it seemed prudent.
#
# The DATABASE ITSELF. `pg_dump` without `--create` says nothing about it, and `pg_settings` cannot
# stand in: `lc_collate` and `lc_ctype` stopped being settings in PostgreSQL 16. Measured
# 09.09.2026: a database created with ICU `tr-TR` passed everything, and in it
# `lower('IVAN@primer.rs')` is `ıvan@primer.rs` with a dotless i, so the unique index over
# `lower(email)` took both spellings and one address opened two accounts. That is ADL A38 gone.
BAZA="select 'baza ' || d.datcollate || ' ' || d.datctype || ' ' || d.datlocprovider::text
       || ' ' || pg_encoding_to_char(d.encoding)
  from pg_database d where d.datname = current_database()"

# WHAT IS WRITTEN IN THE CONFIGURATION FILES, read off the files and not off the running values.
# All three of them, and pg_hba.conf is here on the owner's word of 10.09.2026 after a round measured
# what its absence costs: with the last rule flipped from `scram-sha-256` to `trust` and the config
# reloaded, the check passed while psql from another container on the same network signed in WITHOUT
# A PASSWORD and read the account table. Measured before it was written: both files render seven
# rows and zero difference between the live database and the reference.
# `ALTER SYSTEM` writes into postgresql.auto.conf and takes effect on the next reload or restart, so
# `pg_settings` alone calls a database green while the switch that disables every foreign key is
# already on disk - and the container restarts unless stopped. `pg_file_settings` is the file as
# written. `applied` is read as it is defined and not as it sounds: it means the value COULD be
# applied now, not that it is in force - measured, a setting written and not reloaded is
# `applied=true` while the running value is still the old one - so `pending_restart` is beside it
# and neither may be dropped for the other.
# `concat` and not `||`, because PostgreSQL gives a row it could not parse its `error` and NULL in
# every other column, and a NULL anywhere in a `||` chain makes the whole line NULL: an empty line,
# the text of the error never shown. Measured 06.11.2026 on a pg_hba.conf with two broken lines:
# with `||` both came out as an empty line, with `concat` each carries its error. The count of
# lines still changed, so the check did fail; what was lost was the sentence that says why.
FAJLOVI="select concat('u-fajlu ', name, ' = ', setting,
       ' iz ', regexp_replace(sourcefile, '.*/', ''),
       ' primenjeno=', applied::text, coalesce(' greska=' || error, ''))
  from pg_file_settings
union all
select 'ceka-restart ' || name from pg_settings where pending_restart
union all
select 'podesavanje ' || name || ' = ' || setting || ' (' || source || ')' from pg_settings
 where source not in ('default', 'client', 'session')
union all
select concat('pristup ', coalesce(lpad(rule_number::text, 4, '0'), '----'), ' ', type, ' ',
       array_to_string(database, ','), ' ', array_to_string(user_name, ','),
       ' ', coalesce(address, '-'), coalesce('/' || netmask, ''), ' ', auth_method,
       coalesce(' greska=' || error, ''))
  from pg_hba_file_rules
union all
select concat('mapa ', map_name, ' ', sys_name, ' -> ', pg_username, coalesce(' greska=' || error, ''))
  from pg_ident_file_mappings"

# THE RULE'S NUMBER LEADS THE 'pristup' LINE, because pg_hba.conf is read top to bottom and the
# first rule that matches decides: the lines are sorted by the client afterwards, and without the
# number a file with the same rules in another order produced the same sorted text. Measured
# 06.11.2026 on the rules of a fresh cluster with the catch-all moved from the bottom to the top:
# no difference without the number, sixteen lines of difference with it. A rule that failed to
# parse has no number and prints dashes.

# WHETHER THE TRIGGERS FIRE, which has no DDL form at all: a foreign key is carried out by internal
# triggers, `alter table ... disable trigger all` turns them off, and the DDL pg_dump writes is
# unchanged. Measured: with the dump alone a row naming a role that does not exist went into
# `account`. Internal ones are keyed by the CONSTRAINT they enforce, since their own names carry
# OIDs that differ between two databases. Every schema and not only `public`, because the dump
# beside this one has no schema of its own either, and a pair of unequal reach lies.
OKIDACI="select 'okidac ' || n.nspname || '.' || c.relname || '.' || tg.tgname || ' ' || tg.tgenabled::text
  from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname not in ('pg_catalog', 'information_schema') and not tg.tgisinternal
union all
select 'sprovodjenje ' || n.nspname || '.' || con.conname || ' ' || string_agg(distinct tg.tgenabled::text, ',')
  from pg_trigger tg
  join pg_constraint con on con.oid = tg.tgconstraint
  join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname not in ('pg_catalog', 'information_schema') and tg.tgisinternal
 group by n.nspname, con.conname"

# And the privileges, because the dumps are taken without ACLs.
# AND WHO ACTUALLY GETS IN, which is the one question the file cannot answer. A round on 10.09.2026
# measured the difference with this script's own code: pg_hba.conf switched to `trust`, reloaded,
# then switched BACK without a second reload - the file matched the reference again, the check said
# everything passed, and psql from another container signed in as superuser with no password at all.
# The permanent shape is worse: `include_if_exists` produces no row in pg_hba_file_rules, because a
# directive is not a rule, so a switch can sit in that file for ever and be invisible here.
#
# So the rules on disk are compared as before AND the running server is asked to refuse a login. Over
# TCP to the container's OWN address rather than 127.0.0.1, since the image's own pg_hba trusts the
# loopback and an answer from there would be about a different rule. `-w` so psql never waits for a
# password, and PGPASSWORD emptied so it has none to send.
bez_lozinke() {
  adresa=$(docker exec "$1" hostname -i | tr -d '\r' | cut -d' ' -f1)

  [ -n "$adresa" ] || fail "$1 nema svoju IP adresu, pa proba prijave ispod ne tvrdi nista"

  if docker exec -e PGPASSWORD= "$1" psql -w -h "$adresa" -U "$2" -d "$3" -tAc 'select 1' \
    > /dev/null 2>&1; then
    printf 'prijava-bez-lozinke PROSLA\n'
  else
    printf 'prijava-bez-lozinke odbijena\n'
  fi
}

VLASNIK="select 'prava-izvan-vlasnika ' || count(*)::text
  from information_schema.role_table_grants g
  join pg_class c on c.relname = g.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = g.table_schema
 where g.table_schema not in ('pg_catalog', 'information_schema')
   and g.grantee <> pg_get_userbyid(c.relowner)"

# Sorted by the CLIENT in byte order and never inside the database: an ORDER BY would sort by that
# database's collation, and the two need not have the same one - which is the very thing the line
# above this is here to catch, so the comparison must not depend on it. Measured 09.09.2026: with
# the query ordering, a database with libc `C` produced a difference of pure order and a verdict
# that named the wrong cause.
# Into a file first and sorted afterwards, for the reason written above the dumps and broken here
# in the same commit that wrote it: `sh` has no pipefail, so through a pipe the exit code of every
# psql is lost. And the loss is symmetric by construction - both sides run the same query text on
# the same release - so a broken query shortens both, the difference comes out empty, and the
# script says everything passed. Measured 09.09.2026: one renamed column in the second query, with
# every foreign key disabled on the live side, gave exit 0; the same state without the pipe gave
# exit 1.
# THE RULES IN FORCE ARE MADE TO BE THE RULES ON DISK, and this is what closes the class the
# behavioural probe below could only sample. A round on 10.09.2026 measured why sampling is not
# enough: `host postgres all all trust`, reloaded, then the file put back, gives a permanent
# passwordless SUPERUSER into the `postgres` database, which every cluster has - and a probe that
# asks about one user in one database on one address cannot see it. Narrow it to another user, or
# another source address, and it is invisible again. The combinations have no end, which is the
# shape the workspace rules say to stop enumerating.
#
# A reload ends it: after it, memory holds what the file holds WHEN THE FILE PARSES, and the file IS
# compared, line for line, against the reference. So no rule that lives only in memory survives
# this check, whatever it was narrowed to. When the file does not parse PostgreSQL refuses all of
# it and keeps the old rules, and `pg_reload_conf()` still answers `t` because it only sends the
# signal; memory then holds NOT what the file holds. What catches that is the comparison, which
# reads the file afresh through `pg_hba_file_rules` and prints the error beside the broken line,
# so the comparison is not redundant and must not be dropped as if the reload made it so.
#
# WHAT THIS CANNOT DO, and it is the honest half: it heals rather than alarms. A divergence that
# existed before this ran is gone by the time the comparison happens, so the check says the state is
# right - which it now is - and cannot say it was wrong a second ago. Reading the rules in force is
# what would report that, and PostgreSQL exposes no view of them.
#
# The reload itself applies the file already on disk, which is what a deploy expects anyway; if that
# file is wrong, the comparison two steps down says so and names the line.
#
# AND IT APPLIES MORE THAN THE FILE: a reload also puts into force a setting written with
# `ALTER SYSTEM` that was waiting for one. Measured 06.11.2026: `alter system set
# authentication_timeout = 120` leaves `show` at 1min until the reload and 2min after it. That is
# not a way in (it needs the superuser the setting is written by), but it is a moment of activation
# chosen by this script and not by whoever wrote the setting, on every deploy.
: > "$live_raw"
: > "$expected_raw"

# THE PROBE RUNS FIRST, BEFORE THE RELOAD BELOW, and the order is the whole of it: the reload makes
# memory equal the file, so a probe after it can no longer see anything and would be a line that
# always says the same word.
bez_lozinke qa-postgres "${QA_POSTGRES_USER:-btl_qa}" "${QA_POSTGRES_DB:-btl_qa}" >> "$live_raw"
bez_lozinke "$REFERENCE" postgres ref >> "$expected_raw"

psql "select pg_reload_conf()" > /dev/null || fail 'ponovno ucitavanje konfiguracije nije proslo'

for upit in "$BAZA" "$FAJLOVI" "$OKIDACI" "$VLASNIK"; do
  psql "$upit" >> "$live_raw" || fail 'upit nad QA bazom nije prosao'
  docker exec "$REFERENCE" psql -v ON_ERROR_STOP=1 -U postgres -d ref -tAc "$upit" >> "$expected_raw" \
    || fail 'upit nad referentnom bazom nije prosao'
done



LC_ALL=C sort "$live_raw" > "$live"
LC_ALL=C sort "$expected_raw" > "$expected"

[ -s "$expected" ] || fail 'referentna podesavanja su prazna, dakle poredjenje ispod ne tvrdi nista'
[ -s "$live" ] || fail 'podesavanja zive baze se ne citaju'

if ! diff -u "$expected" "$live" > /dev/null; then
  say 'razlika izvan seme (- ocekivano, + na QA):'
  diff -u "$expected" "$live" | sed -n '3,$p' | grep -E '^[-+]' || true
  fail 'QA baza nije podesena kao sto referentna jeste'
fi
say "podesavanja i okidaci se poklapaju, redova: $(wc -l < "$expected")"

say ''
say '--- 5. sifarnici nose ono sto migracija tvrdi ---'
# Every table the reference holds rows in, which are the tables the migrations seed, is counted on
# QA and must hold as many. Read off the reference and not named here: the list used to be two
# tables written by hand, and the migrations seed eleven (measured 06.11.2026 on the reference
# built from the 83 migrations), so nine could be emptied on QA with this section saying all passed.
# Counted by one catalogue query so that a table the next migration creates is in it at once.
#
# THE BOUNDARY: equality, so a seed table that is meant to grow on QA (nothing is today; they are
# closed lists) would have to be taken out of this by name, with the reason beside it.
counts="select table_name || ' ' || (xpath('/row/c/text()',
       query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"
docker exec "$REFERENCE" psql -v ON_ERROR_STOP=1 -U postgres -d ref -tAc "$counts" > "$expected_raw" \
  || fail 'redovi referentne baze se ne broje'

seeded=0
while read -r table want_rows; do
  [ "$want_rows" != 0 ] || continue
  have_rows=$(psql "select count(*) from public.\"$table\"")
  [ "$have_rows" = "$want_rows" ] || fail "$table nosi $have_rows redova, a migracije ga seju sa $want_rows"
  seeded=$((seeded + 1))
  say "$table: $have_rows"
done < "$expected_raw"
[ "$seeded" -gt 0 ] || fail 'referentna baza ne sadrzi nijedan zasejan red, dakle ovaj odeljak ne tvrdi nista'

say ''
say 'SVE PROVERE PROSLE'
