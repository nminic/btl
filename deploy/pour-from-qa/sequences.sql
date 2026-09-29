-- WHERE EVERY SEQUENCE STANDS ON QA, WRITTEN OUT AS THE STATEMENTS THAT PUT PRODUCTION THERE.
--
-- Run by deploy/pour-from-qa.sh AGAINST QA, and what comes back is SQL text that goes straight
-- into the transaction that pours, after the last COPY. Read by PouringFromQaTest, which runs
-- this very file and checks it names every sequence the schema has.
--
-- WHY THIS EXISTS AT ALL. A sequence is not a row and no COPY carries it. The rows land with
-- their `id` values intact and every sequence on production stays where its migration left it,
-- so the first member the portal writes after the pour takes an `id` that is already on a poured
-- row and the insert fails on the primary key.
--
-- EVERY SEQUENCE IN THE SCHEMA, AND NOT ONLY THE ONES A COLUMN OWNS. This asked `pg_depend` for
-- sequences owned by a column until 29.09.2026, and a security round measured what that missed:
-- the schema has 41 sequences, 40 of them owned by a column, and the forty-first is
-- `member_number_seq`. V16 creates it BARE - `create sequence member_number_seq as integer start
-- with 1 no cycle`, with no `owned by` - precisely so that it survives a deleted row, which that
-- migration says in as many words. `MemberNumbers.draw()` takes the member number out of it with
-- `select nextval('member_number_seq')`.
--
-- ~~A bare sequence belonging to no column would not be carried, and none exists today.~~
-- [OVERTURNED 29.09.2026] That sentence was written here as a boundary and it was FALSE: one
-- exists, and it is the one the member number depends on. It is left visible rather than
-- deleted, because a reader who meets the old shape elsewhere should find out here that it was
-- measured and overturned rather than believe it again.
--
-- WHAT IT COST WHEN IT WAS MISSED, measured by running the real script end to end against two
-- stacks rather than reasoned about: after a clean pour QA stood at `member_number_seq = 2 | t`
-- and production at `1 | f`. The next three activations then failed with
-- `duplicate key ... (member_number)=(000001)`, the same for `000002`, and only the third got
-- through. And `nextval` is NOT transactional - PaymentApi says so beside the call - so each of
-- those failures SPENT ITS NUMBER FOR GOOD, which is the owner's written boundary in PDL 19,
-- "Aktivacija trosi clanski broj nepovratno". Worse, the tool refuses to run a second time once
-- production is no longer pristine, so the repair would not have been another pour but a
-- `setval` typed by hand on production.
--
-- SO THE FLOOR IS `relkind = 'S'` IN THE SCHEMA, WITH NO PREDICATE ABOUT OWNERSHIP. Asking which
-- sequences a column owns was answering a question nobody had: what the pour needs is every
-- sequence the portal draws from, and a sequence is drawn from whether or not a column owns it.
-- A narrower predicate here is a sequence left behind, and the only way to find out is in
-- production.
--
-- WHY QA'S `last_value` AND NOT `max(id)` OF THE TABLE, which is the obvious shortcut and is
-- wrong in a way that shows up late. A sequence runs AHEAD of the largest id whenever a row has
-- been deleted, or an insert rolled back, and both have happened on any database somebody has
-- been using. `member_number_seq` has no table to take a maximum of at all, so for that one the
-- shortcut does not even have a form. The sequence's own position is a fact about QA like any
-- other, so it is carried rather than recomputed.
--
-- AND IT IS CARRIED AS IT STANDS, not as it ought to stand. QA's own `member_number_seq` was
-- measured on 29.09.2026 sitting at `1 | f` while `000001` was already taken, which is a
-- collision QA carries on its own account. Repairing that is somebody else's branch; this tool
-- moves what is there, because a tool that silently corrected a sequence would be deciding
-- something nobody asked it to and would hide the fault instead of moving it.
--
-- `is_called` is read rather than assumed, and that is the difference between `setval(s, 7)` and
-- a sequence whose next value is 7 instead of 8. A sequence that has never been used carries
-- `last_value = start_value` with `is_called = false`, and writing `true` there would silently
-- burn the first id. Both columns are read out of the sequence itself with query_to_xml, the
-- same idiom row-counts.sql uses, because the name comes from the catalogue and not from the
-- text of the query - pg_sequences exposes `last_value` but not `is_called`, so it cannot answer
-- this on its own.
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
 where s.relkind = 'S'
   and sn.nspname = 'public'
 order by s.relname collate "C";
