/* A membership held on a balance carries its trail whole, or not at all.
 *
 * Owner, 03.10.2026 (PDL P8, „Trag (ko je odobrio i kada) ide uz svaku radnju koja prasta novac";
 * ADL, the entry of the same day): the trail of who entered an act, and when, goes with EVERY act
 * that forgives money. Two acts on a membership do. An exemption from the fee, which V35 gave its
 * trail, and a membership granted on a balance that fell short of the fee, „Odobri umanjen iznos iz
 * balansa", which had none. „Odobri iz balansa" for the whole fee forgives nothing and goes without
 * one. From this file on MembershipWriteApi writes the trail on a short balance, in the three columns
 * V35 added; this file adds no column and moves no row.
 *
 *
 * WHAT THE CONSTRAINT SAYS
 * ------------------------
 * For the basis `balance`, and for it alone:
 *
 *   (decided_by_name is null) = (decided_at is null)
 *       the name and the moment are both there or both absent. A name without a moment is a trail
 *       that does not say when, and a moment without a name is one that does not say who.
 *
 *   decided_by is null or decided_by_name is not null
 *       the pointer is never there without the name. The name is what outlives the account (V35, and
 *       V9 before it): ON DELETE SET NULL empties the pointer and leaves the name, never the other
 *       way round, so a pointer with no name could only come from a writer that forgot it.
 *
 * It is scoped to the basis BY NAME and not written over every basis, which is V35's own shape and
 * for V35's own reason: `payment` never carries a trail on the membership
 * (membership_on_a_payment_names_no_decision) and `feeExempt` always does
 * (membership_free_of_the_fee_says_who and ..._says_when), and a rule that spoke for every basis
 * would speak for the next one before anybody had decided what it needs. With this file the schema
 * says something about the trail of every basis that exists: never on a payment, always on an
 * exemption, whole or absent on a balance.
 *
 *
 * WHAT IT DOES NOT SAY, named because a narrow rule without its reason reads as an oversight
 * -------------------------------------------------------------------------------------------
 * It does not say „a trail exactly when the balance fell short of the fee". The row cannot be asked:
 * a membership carries no price, the price list is edited afterwards, and the book line it names
 * holds an amount and not the fee it was short of, so no statement over this table can tell a
 * balance that covered the fee from one that did not. An equivalence would be a rule the database
 * cannot check, and V35's header says why a constraint over the basis may not decide ahead of the
 * question: „a biconditional here would DECIDE FOR IT". What decides is the route, which compares
 * the balance with the fee of the day in one place (Balance.Settlement), and what holds the route is
 * MembershipWriteApiTest, case by case, on both sides of the fee and of the fee plus the tax.
 *
 *
 * WHY THE TRAIL IS ON THE MEMBERSHIP WHEN THE BOOK ALREADY SAYS WHO AND WHEN
 * --------------------------------------------------------------------------
 * balance_entry (recorded_by, recorded_by_name, occurred_at; V38) already names whoever spent the
 * balance and the moment, and it stays: it is the record of the money. The membership carries the
 * trail of the ACT, so that „on which memberships was money forgiven, and by whom" is one question
 * on one table for an exemption and for a short balance alike, and nothing has to join the book to
 * find out whether a line forgave anything. The cost is that on a short balance the same name and the
 * same moment are written twice. The two homes are written in one transaction from one account and
 * one clock, and MembershipWriteApiTest has a case that compares them, so they cannot come apart
 * without a case failing (ADL, the entry of 09.10.2026 under the one above).
 *
 *
 * THE ROWS THAT ARE ALREADY THERE
 * -------------------------------
 * It is added VALID, which V35's pair was not, because no row can break it. Measured on QA on
 * 09.10.2026 by a query that only reads, before this file was written: one membership, basis
 * feeExempt, with no trail (entered before V35 had a place for one), and none with the basis
 * `balance`. Beyond the measurement the shape of the data says the same: the only writer of the
 * three columns wrote them for an exemption alone, so every `balance` row a database can hold has
 * all three empty, and that satisfies both clauses. MembershipConstraintsTest runs THIS FILE over a
 * `balance` membership already standing and asks the catalogue whether the constraint came out
 * validated; TheTrailArrivesOverMembershipsAlreadyThereTest still requires that nothing else in the
 * schema is `not valid`.
 *
 * The three comments V35 wrote on the columns say „exemption" and nothing else. Left as they are they
 * would tell the next reader that the columns are for exemptions alone, which is the sentence this
 * file stops being true, so they are replaced below. A comment is catalogue text and not part of any
 * row, so replacing it changes no data.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */
alter table membership
    add constraint membership_on_a_balance_carries_its_trail_whole_or_not_at_all
        check (basis <> 'balance'
               or ((decided_by_name is null) = (decided_at is null)
                   and (decided_by is null or decided_by_name is not null)));

comment on column membership.decided_by is
    'The account that entered an act which forgave money, empty once that account is gone (ON DELETE '
        'SET NULL, PDL P23): an exemption from the fee (V35), or a membership granted on a balance that '
        'fell short of the fee (V56, PDL 03.10.2026). Empty for a membership held on a payment, whose '
        'trail is on `payment` instead, and for one granted on a balance that covered the fee, which '
        'forgave nothing.';

comment on column membership.decided_by_name is
    'The name the act was entered under, which outlives the account. This, and not `decided_by`, is '
        'what `membership_free_of_the_fee_says_who` is written over, for the reason V9 measured. '
        'Present on every exemption. On a membership held on a balance it is present, together with '
        '`decided_at`, when the route found the balance short of the fee, and absent with it '
        'otherwise: `membership_on_a_balance_carries_its_trail_whole_or_not_at_all` holds the pair '
        'whole and the route decides which of the two a row gets.';

comment on column membership.decided_at is
    'When somebody entered the act. Never the season, which the row already names, and never the date '
        'of the board decision itself, which the owner refused to have typed (27.09.2026). On a '
        'membership held on a balance it is there together with `decided_by_name`, or not at all.';
