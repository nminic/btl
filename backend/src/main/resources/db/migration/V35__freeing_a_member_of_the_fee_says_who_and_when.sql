/*
 * THIS FILE WAS CHANGED AFTER IT WAS MERGED, AND THAT IS NOT A PRECEDENT. READ THIS FIRST.
 * ========================================================================================
 *
 * ADL A2: a migration is immutable from the day it merges to `main`. This file merged on
 * 27.09.2026 (#391) and was changed the same day, under the one case A2 names for it, its
 * addendum of 27.09.2026: "migracija koja je PALA nije primenjena, pa se sme menjati u
 * mestu ... granica je spajanje ZATO STO spajanje znaci da QA dolazi da pamti kontrolnu
 * sumu. Migracija koja padne je cela transakcijski DDL, pa pad znaci `rollback` i NIJEDAN
 * RED SE NE UPISE, ni sa `success = false`."
 *
 * That is this file exactly: it merged, it FAILED on QA, and therefore no database ever
 * came to hold its checksum. A2 requires the condition to be CHECKED against
 * `flyway_schema_history` rather than assumed, and requires this sentence to be here.
 *
 * WHAT WAS MEASURED, three places, before a line was touched:
 *
 *   - QA: `select version from flyway_schema_history order by installed_rank desc` tops out
 *     at 34, and `docker logs qa-backend` repeats
 *     `ERROR: check constraint "membership_free_of_the_fee_says_who" of relation
 *     "membership" is violated by some row` out of DbMigrate.doMigrateGroup. The backend
 *     never started, so the portal was down, not merely un-migrated.
 *   - The local development database (compose volume `btl_postgres-data`): no
 *     `flyway_schema_history` table at all and nought tables in `public`.
 *   - From a test: only a fresh Testcontainers `postgres:18`, thrown away after every run.
 *     A2's own measure already excludes those - "primenjena samo u Testcontainers bazama koje
 *     se bacaju posle svakog prolaza" - and MigrationsAreImmutableTest's javadoc says why a
 *     green build is evidence about nothing here.
 *
 * AND THERE WAS NO OTHER WAY, which A2 says in the same addendum: a later migration cannot
 * repair this one, because Flyway fails HERE and never reaches it. Editing this file was not
 * the cheaper of two options, it was the only one that runs.
 *
 * SO: THE NEXT PERSON DOES NOT GET TO DO THIS. The exception is about a migration that
 * FAILED, not about one that is inconvenient. From the day this file succeeds on QA it is as
 * immutable as every other, and a correction is the next migration.
 *
 *
 * FREEING A MEMBER OF THE FEE SAYS WHO DID IT AND WHEN.
 *
 * THE DECISION, owner 27.09.2026, chosen between three outcomes offered to him and carrying
 * the recommendation he was given: a membership granted without a fee carries a trail, WHO and
 * WHEN. The reason put to him and accepted: this is the only action on the portal that
 * FORGIVES SOMEBODY MONEY, and the only other action that touches money - recording a payment -
 * has carried its trail since V16.
 *
 * WHAT HE REFUSED, with the cost he was shown: a third column naming the number of the board's
 * own decision. The cost of taking it would have been the administration typing that number at
 * every exemption, and he declined it. So the portal records who on the portal entered the
 * exemption and when, and the act of the board itself lives in the board's minutes, outside
 * this database. The Statute is what makes that separation the right way round: article 24
 * point 10 gives the exemption to the board, and PDL 5956 („redovni clan oslobodjen placanja
 * odlukom Upravnog odbora") is the sentence this schema is not trying to replace.
 *
 * AND ONE MORE DECISION OF THE SAME DAY, HERE BECAUSE IT EXPLAINS A COLUMN THAT IS MISSING:
 * an exemption given BY MISTAKE is not corrected through the portal, and that is a recorded
 * boundary rather than an oversight. The owner's reason: every season is granted separately
 * (PDL:3427, 13.09.2026, „Pocasno clanstvo se odobrava za svaku sezonu posebno... Ne jednom pa
 * dok se ne oduzme"), so a mistake lasts at most to the end of that season and is never
 * carried forward. Nothing here records a withdrawal because nothing may withdraw.
 *
 *
 * WHY THE TRAIL LIVES ON THE MEMBERSHIP AND NOT BESIDE THE PAYMENT'S
 * ------------------------------------------------------------------
 * A membership held on a recorded fee already says who and when, on `payment`
 * (`recorded_by`, `recorded_by_name`, `recorded_at`, V16). Copying that here would give one
 * fact two homes, which is the fault V22 was written to end for „was he a member" and the one
 * `competitor.membership_basis` is still serving out. So the two bases do not share these
 * columns: a payment's trail stays on the payment, and only a membership that has no payment
 * to point at keeps its own.
 *
 * WHICH IS WHY THE CONSTRAINTS ARE SCOPED TO A BASIS BY NAME AND NOT WRITTEN AS A
 * BICONDITIONAL. `membership_basis_says_whether_a_payment_is_named` (V22) could say
 * `(basis = 'payment') = (payment_id is not null)` because the two bases were the whole world.
 * They are not any more: a branch in flight adds `'balance'` as a third, and a biconditional
 * here would DECIDE FOR IT - forcing a membership bought with a balance to carry a trail in
 * these columns before anybody has decided whether it should. That is not this migration's
 * decision to make, so what stands below says exactly what is known: an exemption always
 * carries a trail, a payment never carries one here, and a third basis arrives to a question
 * nobody has answered for it yet rather than to an answer nobody chose.
 */


/*
 * The account that entered it, and it MAY GO: a moderator has the same right to have his
 * account deleted as anybody else (PDL P23), so this empties exactly as `payment.recorded_by`
 * and `verification.decided_by` do.
 */
alter table membership
    add column decided_by bigint;

/*
 * And the name it was entered under, which stays when the account does not. The same shape
 * V9 chose for a decision and V16 for a receipt, and for the same reason: an exemption WAS
 * given, it stays given, and it says by whom. `sr_latn` because it is a person's name.
 */
alter table membership
    add column decided_by_name text collate sr_latn;

/* When. Not the season, which the row already names, but the moment somebody entered it. */
alter table membership
    add column decided_at timestamptz;

alter table membership
    add constraint membership_decided_by_fk foreign key (decided_by) references account (id)
        on delete set null;

/*
 * AN EXEMPTION ALWAYS SAYS WHO, AND THIS IS WRITTEN OVER THE NAME AND NEVER OVER THE ACCOUNT.
 *
 * That is not a preference: V9 paid for it. Written over `decided_by`, this constraint and the
 * foreign key above contradict each other, because `on delete set null` empties the pointer of
 * every row that account ever decided and the constraint then refuses exactly that - so
 * deleting the account of a moderator who had granted one exemption would fail outright, which
 * is neither what `on delete set null` says nor what PDL P23 allows. V9 measured that delete
 * coming back naming its own constraint. A name cannot be taken away by deleting anything, so
 * the two never disagree.
 *
 *
 * AND IT IS `not valid`, WHICH IS A STATEMENT ABOUT TIME AND NOT A WEAKENING.
 * -------------------------------------------------------------------------
 * This is the pair that failed on QA, and the two words were added on 27.09.2026 for a reason
 * that is worth having in front of you rather than in a commit message.
 *
 * WHAT IS THERE. One membership, entered before these three columns existed: season 2027, basis
 * `feeExempt`, no payment, and therefore no trail, because on the day it was written there was
 * nowhere to put one. Measured, not estimated: one such row.
 *
 * WHAT WAS REFUSED, and this is the important half. The other way to get the migration through
 * was to fill that row in. Nothing could be filled in that would be true: NOBODY granted that
 * exemption on the portal, because the portal could not record granting one until this file.
 * Writing any name there would be a FALSE RECORD OF A DECISION - the one thing these columns
 * exist to make reliable - and it would be a false record on the owner's own membership. A
 * schema is allowed to know less; it is not allowed to say something that did not happen.
 *
 * SO `not valid` SAYS EXACTLY WHAT IS TRUE: an exemption entered from the day the trail exists
 * names who entered it, and one entered before that cannot. PostgreSQL enforces it on every
 * `insert` and every `update` from this moment and leaves the rows that were already there
 * alone. The half that had to survive does survive, measured: a NEW `feeExempt` row with no
 * name is still refused, and TheTrailArrivesOverMembershipsAlreadyThereTest is where that is
 * held down together with the migration running over the row at all.
 *
 * WHAT IS GIVEN UP, recorded as a boundary rather than left to be discovered: no constraint in
 * the schema asserts anything about that one row. It is one row today.
 *
 * AND ONE CONSEQUENCE THAT IS EASY TO MISS, so it is measured and written here. A `not valid`
 * CHECK is still enforced on an `update` of a row - including an update that touches none of
 * these three columns - so that legacy row can be read and DELETED but not UPDATED. Measured:
 * `update membership set basis = 'feeExempt' where season = 2027`, which changes nothing at
 * all, is refused. Whether that can be reached was measured too, and today it cannot: there
 * is no JPA entity over `membership`, and the whole of `src/main` holds exactly two writes to
 * it, both inserts, at MembershipWriteApi.java:271 and PaymentApi.java:442. There is no
 * `update membership` and no `delete from membership` anywhere. On top of that
 * MembershipWriteApi already answers 200 and writes nothing when a `feeExempt` row for that
 * season is standing (MembershipWriteApi.java:241-243), which is the path that legacy row is
 * actually on. The day something does need to update a membership, it has to deal with this,
 * and this paragraph is how it finds out instead of getting a 500.
 *
 * WHY ONLY THIS PAIR IS `not valid`. Measured statement by statement against a database
 * carrying both bases, rather than assumed from the one error QA happened to print first: the
 * foreign key passes because `decided_by` is null on every legacy row and a null satisfies a
 * key; `membership_on_a_payment_names_no_decision` passes because a legacy membership held on
 * a payment carries all three of these columns empty, which is the side it asks for; and
 * `membership_decided_by_name_not_blank` passes because null is not blank. So the other four
 * statements below are `valid` and stay `valid`, and the test named above asserts that in the
 * catalogue so nobody can quietly widen this.
 */
alter table membership
    add constraint membership_free_of_the_fee_says_who
        check (basis <> 'feeExempt' or decided_by_name is not null) not valid;

/* And when. `decided_at` is nobody's foreign key, so this one may be written over the column
   the question is actually about. `not valid` for the reason above, and it is the pair rather
   than one of them: the legacy row names neither, so validating either one refuses it. */
alter table membership
    add constraint membership_free_of_the_fee_says_when
        check (basis <> 'feeExempt' or decided_at is not null) not valid;

/*
 * AND A MEMBERSHIP HELD ON A PAYMENT CARRIES NO TRAIL HERE, which is the half that keeps these
 * columns from quietly becoming a second home for what `payment` already says. Without it the
 * three columns are optional everywhere except an exemption, and the first writer to fill them
 * in beside a receipt would have made the same fact answerable from two places with nothing
 * saying which is right.
 */
alter table membership
    add constraint membership_on_a_payment_names_no_decision
        check (basis <> 'payment' or (decided_by_name is null and decided_at is null));

/* The shape `verification` and `payment` both give the name they keep: present or absent, never
   blank. A blank name is a trail that looks like a trail and names nobody. */
alter table membership
    add constraint membership_decided_by_name_not_blank
        check (decided_by_name is null or btrim(decided_by_name) <> '');

/*
 * „Which memberships did this moderator enter", and the side `on delete set null` has to find
 * when an account goes. A foreign key builds no index on the referencing side and the key of
 * this table begins with the member, so without this line deleting an account is a scan of
 * every membership the league has ever had. `verification_decided_by_idx` and
 * `payment_recorded_by_idx` exist for the same two reasons.
 */
create index membership_decided_by_idx on membership (decided_by);

comment on column membership.decided_by is 'The account that entered an exemption from the fee, empty once that account is gone (ON DELETE SET NULL, PDL P23) and empty for a membership held on a payment, whose trail is on `payment` instead.';
comment on column membership.decided_by_name is 'The name the exemption was entered under, which outlives the account. This, and not `decided_by`, is what `membership_free_of_the_fee_says_who` is written over, for the reason V9 measured.';
comment on column membership.decided_at is 'When somebody entered the exemption. Never the season, which the row already names, and never the date of the board decision itself, which the owner refused to have typed (27.09.2026).';
