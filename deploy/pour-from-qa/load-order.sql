-- THE ORDER THE TABLES MAY BE FILLED IN, ASKED OF THE FOREIGN KEYS THEMSELVES.
--
-- Read by deploy/pour-from-qa.sh, which fills the tables in the order of the rows this returns,
-- and by PouringFromQaTest, which runs this very file against a database built from the
-- migrations and checks the order against pg_constraint rather than against a written list.
-- One home, two readers: a list written here instead would be a second home for a fact the
-- database already holds, and the day a migration adds a table the list would be silently short.
--
-- Two columns come back, `name` and `level`. `level` is the LONGEST path from a table nobody
-- points at, so every parent is strictly below every child and sorting by it is a load order.
--
-- A TABLE IN A CYCLE COMES BACK WITH level = NULL, and that is the point rather than an
-- oversight: nothing reaches it from a root, so no order exists for it, and the script stops and
-- names it instead of pouring the rest and leaving it out. The graph is acyclic today (measured
-- 29.09.2026: 49 tables, 91 foreign keys, none unreachable), and this says what happens on the
-- day it is not.
--
-- A SELF REFERENCE IS DELIBERATELY NOT AN EDGE, and this is measured, not assumed. `btl_event`
-- points at `btl_event` (copied_from) and `competitor` at `competitor` (referred_by). Counted as
-- an edge, each would be a cycle of one and both tables would come back NULL. They need no order
-- between them because the whole table is filled by ONE `COPY`, and a foreign key is carried out
-- by an AFTER ROW trigger that fires at the END OF THE STATEMENT. Measured on postgres:18 on
-- 29.09.2026: a row pointing forward at a row later in the same COPY gives `COPY 2` and both
-- rows land; the same two rows as two separate COPYs give
-- `ERROR: insert or update on table violates foreign key constraint`. So one COPY per table is a
-- condition of correctness here, not a way of going faster, and dropping this line turns both
-- tables into cycles.
--
-- `flyway_schema_history` is left out because it is not poured: production writes its own when
-- its backend first starts, and a copied history would carry QA's checksums into a database that
-- computed its own. It is also not created by any migration, so it is absent from the reference
-- database this is compared against, and leaving it in would look like a difference.
with recursive
fk as (
    select child.relname as child, parent.relname as parent
      from pg_constraint con
      join pg_class child on child.oid = con.conrelid
      join pg_class parent on parent.oid = con.confrelid
      join pg_namespace n on n.oid = child.relnamespace
     where con.contype = 'f'
       and n.nspname = 'public'
       and child.relname <> parent.relname
),
t as (
    select c.relname as name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname <> 'flyway_schema_history'
),
reached as (
    select t.name, 0 as level, array[t.name] as path
      from t
     where not exists (select 1 from fk where fk.child = t.name)
    union all
    select fk.child, reached.level + 1, reached.path || fk.child
      from reached
      join fk on fk.parent = reached.name
     where not fk.child = any(reached.path)
)
select t.name, max(reached.level) as level
  from t
  left join reached on reached.name = t.name
 group by t.name
 order by max(reached.level) nulls last, t.name;
