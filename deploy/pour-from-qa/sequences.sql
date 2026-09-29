-- WHERE EVERY SEQUENCE STANDS ON QA, WRITTEN OUT AS THE STATEMENTS THAT PUT PRODUCTION THERE.
--
-- Run by deploy/pour-from-qa.sh AGAINST QA, and what comes back is SQL text that goes straight
-- into the transaction that pours, after the last COPY. Read by PouringFromQaTest, which runs
-- this very file and checks it names every sequence pg_depend knows about, in both directions.
--
-- WHY THIS EXISTS AT ALL. A sequence is not a row and no COPY carries it. The rows land with
-- their `id` values intact and every sequence on production stays where its migration left it,
-- so the first member the portal writes after the pour takes an `id` that is already on a poured
-- row and the insert fails on the primary key. Measured 29.09.2026: pg_depend names 40 sequences
-- owned by a column, one per table with a `bigserial` id, so this is 40 chances to break and not
-- an edge case.
--
-- WHY QA'S `last_value` AND NOT `max(id)` OF THE TABLE, which is the obvious shortcut and is
-- wrong in a way that shows up late. A sequence runs AHEAD of the largest id whenever a row has
-- been deleted, or an insert rolled back, and both have happened on any database somebody has
-- been using. Setting production to `max(id)` would hand out ids QA has already spent, and the
-- collision would not appear until the portal reached them. The sequence's own position is a
-- fact about QA like any other, so it is carried rather than recomputed.
--
-- `is_called` is read rather than assumed, and that is the difference between `setval(s, 7)` and
-- a sequence whose next value is 7 instead of 8. A sequence that has never been used carries
-- `last_value = start_value` with `is_called = false`, and writing `true` there would silently
-- burn the first id. Both columns are read out of the sequence itself with query_to_xml, the
-- same idiom row-counts.sql uses, because the name comes from the catalogue and not from the
-- text of the query - pg_sequences exposes `last_value` but not `is_called`, so it cannot answer
-- this on its own.
--
-- THE FLOOR IS pg_depend, not a list: a sequence counts when it is owned by a column of a table
-- (`deptype` 'a' for a serial, 'i' for an identity column). A migration that adds a table with a
-- `bigserial` id gets its sequence carried on the next run with nothing changed here. A bare
-- sequence belonging to no column would not be carried, and none exists today; it is named here
-- so the next reader knows it is a boundary that was seen rather than one that was missed.
select format('select setval(%L, %s, %s);',
              quote_ident(sn.nspname) || '.' || quote_ident(s.relname),
              (xpath('/row/v/text()',
                     query_to_xml(format('select last_value as v from %I.%I', sn.nspname, s.relname),
                                  false, true, '')))[1]::text,
              (xpath('/row/v/text()',
                     query_to_xml(format('select is_called as v from %I.%I', sn.nspname, s.relname),
                                  false, true, '')))[1]::text)
  from pg_class s
  join pg_namespace sn on sn.oid = s.relnamespace
  join pg_depend d
    on d.objid = s.oid
   and d.classid = 'pg_class'::regclass
   and d.deptype in ('a', 'i')
  join pg_class t on t.oid = d.refobjid
  join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
 where s.relkind = 'S'
   and sn.nspname = 'public'
 order by s.relname collate "C";
