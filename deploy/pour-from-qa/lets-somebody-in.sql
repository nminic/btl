-- WHICH OF THE POURED ROWS LET SOMEBODY IN, ASKED OF THE CATALOGUE.
--
-- Read by deploy/pour-from-qa.sh, which names these tables and their row counts in its closing
-- report, and by PouringFromQaTest, which runs this very file and compares what it returns
-- against the columns the catalogue holds.
--
-- WHAT COUNTS AS LETTING SOMEBODY IN, and the second half of this was missed until a security
-- round measured it on 29.09.2026.
--
--   `token_hash`    - account_session, password_reset_token, email_verification_token. The
--                     portal keeps the SHA-256 of a secret the holder was given and signs in
--                     whoever presents a secret that hashes to a stored row.
--
--   `password_hash` - account. This is not a different KIND of thing, only a different column
--                     name: SignInApi reads `select id, password_hash, ... from account where
--                     lower(email) = lower(?)` and checks the visitor against exactly that
--                     value. A predicate written over `token_hash` alone cannot see it, and
--                     the first version of this query was written that way.
--
-- WHY GETTING THAT WRONG WAS WORSE THAN A MISSING LINE IN A REPORT. The script's closing
-- sentence said emptying the token tables "ends every one of them". With `account` absent from
-- this list that sentence read as though it covered everything, and it did not: a password is
-- not in any of those three tables, so EVERY QA PASSWORD GOES ON WORKING ON PRODUCTION and no
-- amount of emptying changes it. The report now separates the two, because they have different
-- remedies - one is a delete, the other is a password change.
--
-- AND IT HAS A NAMED HOLDER. compose.qa.yml says in so many words that BTL_SUPERADMIN_EMAIL is
-- deliberately NOT separated between the two stacks, since it is the same person administering
-- both, and the superadmin is chosen by an address in the environment rather than by a row. So
-- from the first minute production runs, the superadmin's password there is whatever it was on
-- QA. That is the one this list exists to make impossible to overlook.
--
-- THE FLOOR IS THE CATALOGUE, not a list of table names. A table earns its place here by
-- carrying a column the portal authenticates against, so a fourth such table arrives in this
-- report on the day it is created rather than on the day somebody remembers. What it cannot do
-- is recognise a fifth column NAME nobody has thought of, and that is written down rather than
-- pretended away: the two names below are the schema's whole answer today, measured against
-- every hash-bearing column the migrations create, and PouringFromQaTest compares this against
-- the catalogue so a new one fails the gate instead of passing unseen.
select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
 where n.nspname = 'public'
   and c.relkind = 'r'
   and a.attname in ('token_hash', 'password_hash')
 group by c.relname
 order by c.relname collate "C";
