-- THE CONSTRAINTS THAT ARE NOT VALID, WITH THE STATEMENTS THAT LIFT THEM AND PUT THEM BACK, ASKED
-- OF THE CATALOGUE.
--
-- Read by deploy/pour-from-qa.sh, which asks it of production before the pour, writes the `drop`
-- rows into the transaction ahead of the first write and the `restore` rows after the last one,
-- and asks again after the commit to see that production holds exactly what it held before. Read
-- by PouringFromQaTest, which runs this very file against a real PostgreSQL, lifts and restores
-- what it names around a write that the constraint refuses, and checks it comes back not valid.
--
-- WHY THIS EXISTS. A constraint added `not valid` is enforced on every insert and every update
-- and ignored for the rows that were already there. QA can hold such a row: the owner's own
-- membership predates the trail V35 added and has none, and the two constraints that ask for one
-- are `not valid` for exactly that reason. COPY is an insert, so production, which carries the
-- same constraints, would refuse the row and the whole pour would roll back at `membership`.
--
-- WHAT THE OWNER DECIDED (02.10.2026, between three outcomes offered). The tool copies QA
-- faithfully: for every constraint that is not valid it lifts the constraint in the same
-- transaction before the write and puts it back after, again as not valid. Production ends
-- exactly as QA is, the row stays without its trail, and nothing is invented. The two outcomes
-- turned down were re-granting the exemption through the portal, which would record that it was
-- decided now, and a tool that only names the row and refuses, which would stop the pour on the
-- day of the pour.
--
-- THE LIST IS ASKED OF THE CATALOGUE AND NOT WRITTEN HERE: `pg_constraint` where the constraint
-- is not validated. A constraint that arrives in a later migration is lifted and restored with no
-- edit to this file or to the script, and PouringFromQaTest builds one the schema does not have
-- and checks it is carried. It is asked of PRODUCTION. By the time this is read, the schema
-- comparison in the script has proved production carries the constraints QA does, state
-- included, because pg_dump writes NOT VALID, so what is not valid there is what is not valid on
-- QA.
--
-- THE DEFINITION IS pg_get_constraintdef, AND IT ENDS IN `NOT VALID`. Measured on postgres:18
-- 02.10.2026: `CHECK ((n > 0)) NOT VALID`. So the statement that puts the constraint back brings
-- it back not valid with no flag added here. A restore written without the suffix would validate
-- against the rows just poured and fail on the very row this file exists for, or, on a database
-- with no such row, pass and leave production holding as valid what QA holds as not. That is why
-- the script asks this again after the commit and compares.
--
-- `set constraints all immediate` COMES FIRST AMONG THE RESTORES, and it is measured rather than
-- tidy. On postgres:18, an ALTER TABLE after a write in the same transaction fails with `cannot
-- ALTER TABLE ... because it has pending trigger events` when the table has a deferred constraint
-- trigger, and V29 declares two of them, on `race` and `btl_event`. Neither carries a constraint
-- that is not valid today, so nothing hits it; a not valid constraint arriving on one of them
-- would. The statement runs the deferred checks at that point and not at COMMIT, inside the same
-- transaction, so what is refused is the same and so is the rollback. It is emitted only when
-- there is something to restore.
--
-- Two columns, `phase` and `statement`, separated by a bar. A statement may itself hold a bar (a
-- CHECK can use `||`), so the reader keeps the whole rest of the line. Ordered `collate "C"` so
-- the answer before the pour and the answer after it, which are compared line for line, cannot
-- differ by the collation of the database that gave them.
--
-- WHAT IT CANNOT CARRY, written down rather than left to be found, and PouringFromQaTest asks the
-- catalogue about each so that the migration which breaks one fails the build and not the pour:
--   - a statement is one line, so a name or a definition with a newline in it cannot be carried;
--   - a COMMENT on such a constraint is lost by dropping it, and none exists;
--   - a constraint on a partitioned table (`relkind = 'p'`) is not seen, the same boundary the
--     rest of this tool has, and none exists.
with not_valid as (
    select n.nspname, c.relname, con.conname, con.oid as constraint_oid
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where not con.convalidated
       and n.nspname = 'public'
       and c.relkind = 'r'
)
select phase, statement
  from (
        select 'drop' as phase, 0 as step,
               format('alter table %I.%I drop constraint %I;', nspname, relname, conname) as statement
          from not_valid
        union all
        select 'restore', 0, 'set constraints all immediate;'
         where exists (select 1 from not_valid)
        union all
        select 'restore', 1,
               format('alter table %I.%I add constraint %I %s;',
                      nspname, relname, conname, pg_get_constraintdef(constraint_oid))
          from not_valid
       ) lifted
 order by phase collate "C", step, statement collate "C";
