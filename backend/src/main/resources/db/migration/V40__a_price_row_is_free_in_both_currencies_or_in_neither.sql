/*
 * A ROW OF THE PRICE LIST IS FREE IN BOTH CURRENCIES OR PRICED IN BOTH. NOUGHT IN ONE ALONE IS
 * REFUSED.
 *
 * THE DECISION, PDL 20b, owner 27.09.2026, chosen between three outcomes: „Red cenovnika je ili
 * besplatan u obe valute, ili ima iznos u obe. Nula u jednoj a iznos u drugoj se odbija."
 *
 * THE OCCASION WAS MEASURED AND NOT IMAGINED. A membership priced 0 EUR / 600 RSD is reachable
 * through `PUT /api/pricing/{key}`, and it breaks BOTH roads to an activation with a 500 from the
 * server: `balance_entry_a_membership_takes` (V38) reads
 * `check (reason <> 'membership' or (eur < 0 and rsd < 0))`, so a spend has to move BOTH currencies
 * strictly, and a membership that costs nothing in euro cannot be written down as one that does.
 *
 * AND V38 NAMED THIS VERY QUESTION AND LEFT IT OPEN, in its own words, beside the line that keeps a
 * reward of nothing out of the book: „It does not decide whether nought belongs on the price list,
 * which is somebody else's question and stays open." This is that decision, and it is the reason the
 * question is answered on the PRICE LIST rather than in the book.
 *
 * WHERE IT IS ENFORCED, AND THE ALTERNATIVE THAT WAS REFUSED. On the price list. The book stays as it
 * is. Loosening the book was offered and refused, with the cost that was shown before the choice:
 * every future sum would then have to reckon with lines standing at nought in one currency.
 *
 * WHAT THE PRICE LIST REALLY HOLDS, read off QA on 27.09.2026 rather than assumed, so that the next
 * reader does not have to measure it again:
 *
 *     early      | 35.00 | 4200.00
 *     junior     | 20.00 | 2400.00
 *     late       | 50.00 | 6000.00
 *     processing |  3.00 | (null)
 *     referral   |  5.00 |  600.00
 *     regular    | 40.00 | 4800.00
 *     season     | 40.00 | 4800.00
 *
 * Seven rows, not one of them at nought, and the fee the only one with no dinar side at all.
 * `select key, eur, rsd from price_row where rsd is not null and (eur = 0) <> (rsd = 0)` answered
 * NOTHING there, which is why the constraint below is plain and not `not valid`: `not valid` (V35) is
 * a true sentence about a row that EXISTS and cannot be put right, and there is no such row to spare.
 *
 * AND SEVEN IS ALL THERE EVER ARE, which is why that measurement settles the question rather than
 * sampling it. V4 inserts the seven; nothing since has inserted or deleted one, and
 * `PUT /api/pricing/{key}` carries a single statement, `update price_row set label, eur, rsd where
 * key`. The price list is a codebook whose AMOUNTS and NAMES change and whose rows do not.
 */


/*
 * THE FEE IS EXEMPT, AND THAT IS A DECISION WRITTEN HERE RATHER THAN A HOLE LEFT IN THE RULE.
 *
 * `rsd is null` is the fee row and nothing else, and that is not an assumption: V4's
 * `price_row_only_fee_has_no_rsd check ((rsd is null) = (kind = 'fee'))` says so in both directions,
 * and that constraint is immutable. A row with ONE currency cannot carry nought „in only one of the
 * two", because it has no second one to disagree with. The processing fee has no dinar side for the
 * reason V4 already gives: there is no payment intermediary on that side to pay.
 *
 * AND IT IS SAID OUT LOUD RATHER THAN LEFT TO THREE VALUED LOGIC, which is the whole reason this
 * paragraph exists. Written as `(eur = 0) = (rsd = 0)` alone the fee row would evaluate to NULL, a
 * check constraint takes NULL, and the row would pass - not because anybody decided it should, but
 * because nobody noticed it had. `rsd is null or` makes the exemption a sentence somebody can argue
 * with.
 *
 * WHAT IT DOES NOT SAY, named because a narrow rule without its reason reads as an oversight: it says
 * nothing about a fee row priced at nought. A free processing fee is one currency at nought and there
 * is no second currency to contradict it, so it is not this rule's question. Whether the association
 * may waive the fee through the pricing screen is somebody's decision and is not being made here.
 *
 * NEGATIVE AMOUNTS ARE SOMEBODY ELSE'S, TOO: `price_row_eur_not_negative` and
 * `price_row_rsd_not_negative` (V4) already refuse those, and each row that breaks them breaks
 * nothing here. Measured rather than hoped - no row in `ConstraintsTest`'s list of deliberate
 * violations breaks two constraints after this file, which is what makes each failure name the thing
 * it is about.
 */
alter table price_row
    add constraint price_row_free_in_both_or_priced_in_both
        check (rsd is null or (eur = 0) = (rsd = 0));


comment on column price_row.rsd is
    'The dinar price, and null on the one row that has no dinar side: the processing fee, which pays '
        'an intermediary the dinar account does not have (V4, PDL 04.08.2026). Since V40 a row that '
        'HAS both currencies is free in both or priced in both, never nought in one alone: the owner '
        'decided that on 27.09.2026 (PDL 20b), because 0 EUR / 600 RSD was reachable and broke both '
        'roads to an activation - balance_entry_a_membership_takes (V38) requires a spend to move '
        'both currencies strictly. The fee row is exempt for the reason it has no second currency to '
        'disagree with, and that exemption is written into the constraint rather than left to a null.';
