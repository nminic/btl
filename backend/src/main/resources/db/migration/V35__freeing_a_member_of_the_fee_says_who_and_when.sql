/*
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
 */
alter table membership
    add constraint membership_free_of_the_fee_says_who
        check (basis <> 'feeExempt' or decided_by_name is not null);

/* And when. `decided_at` is nobody's foreign key, so this one may be written over the column
   the question is actually about. */
alter table membership
    add constraint membership_free_of_the_fee_says_when
        check (basis <> 'feeExempt' or decided_at is not null);

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
