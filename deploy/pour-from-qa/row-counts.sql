-- HOW MANY ROWS EVERY TABLE HOLDS, WITH NO LIST OF TABLES ANYWHERE.
--
-- Read by deploy/pour-from-qa.sh, which runs it against the production database and against a
-- reference database built from this checkout's migrations, and refuses to pour unless the two
-- answers are identical line for line. Read by PouringFromQaTest, which runs this very file and
-- checks it changes its mind after a single row is written.
--
-- WHY THIS IS WHAT "EMPTY" MEANS, and why the obvious two readings are both wrong.
--
-- "No tables" is wrong because production's schema is built by Flyway when its backend first
-- starts, and an empty schema is a fault rather than a resting state - compose.prod.yml says so
-- in those words. A pour into a database with no tables would fail on the first COPY.
--
-- "No rows" is wrong because the migrations themselves seed eleven tables. Measured 29.09.2026
-- against a reference database built from the 46 migrations this checkout carries: a production
-- database that has just come up for the first time, that nobody has ever used, already holds
-- 47,396 rows - 47,016 places, 246 countries, 15 ducats, 11 ducat kinds, 11 admin rights, 7
-- price rows, 4 roles, and 4 static pages with their 39 sections and both sets of translations.
-- A check against zero would refuse every production database there can ever be.
--
-- So empty means: PRODUCTION HOLDS NOTHING ITS OWN MIGRATIONS DID NOT PUT THERE. The reference
-- database is what the migrations put there, built fresh on every run from the files in the
-- checkout, so a migration that seeds a twelfth table needs nothing changed here and no number
-- blessed anywhere. That is the floor: PostgreSQL executes the migrations, and the expected side
-- is never a list somebody wrote and has to remember to grow.
--
-- AND IT IS THE LOCK ON A SECOND RUN, with no flag file and no state of its own. After a
-- successful pour production holds QA's rows, which are not the reference's rows, so this stops
-- matching and the tool refuses. The owner asked for a tool that "pours everything at once, one
-- time"; a second run over the same database is exactly what would double the data, and the
-- proof of emptiness is already the thing that prevents it.
--
-- `count(*)` is exact and `n_live_tup` would not be: that column is an estimate the statistics
-- collector maintains, it is zero on a table that has never been analysed, and a check that
-- reads it would call a full database empty. query_to_xml is how a count is taken over a table
-- whose name comes from the catalogue rather than from the text of the query.
--
-- `flyway_schema_history` is left out for the reason load-order.sql gives: production writes its
-- own and the reference database has none, so it is a difference by construction rather than a
-- finding. Ordered `collate "C"` so two databases that disagree about collation still return
-- these lines in the same order - the comparison must not depend on the very thing a schema
-- check exists to notice.
select c.relname,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from public.%I', c.relname),
                           false, true, '')))[1]::text::bigint as rows
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and c.relname <> 'flyway_schema_history'
 order by c.relname collate "C";
