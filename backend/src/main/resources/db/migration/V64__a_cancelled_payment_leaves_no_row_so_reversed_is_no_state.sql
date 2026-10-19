/* A CANCELLED PAYMENT LEAVES NO ROW, SO `reversed` IS NOT A STATE A PAYMENT CAN BE IN.
 *
 * The owner, 18.10.2026 (PDL P8, the section "Osnov clanstva ima jedan dom, zapis po sezoni"),
 * choosing between the outcomes put to him and against the recommendation: "Kad se osnov promeni
 * iz "uplata" ili se uplata stornira, zapis o uplati se BRISE." Refused: that the row stay, marked
 * as reversed. The cost was put to him before he chose: the record of what was collected keeps no
 * trace that the money was ever booked. And in the same section, with the
 * recommendation: the refusal "Storno vraca covek, van ovog ekrana." (confirmed 28.09.2026) is
 * deleted "zajedno sa stanjem "stornirana uplata" koje je pisalo, jer uplata se od 18.10.2026 pri
 * stornu brise pa to stanje ne nastaje".
 *
 * So the word goes from the one rule that names it, and nothing else in this file moves. The trail
 * of a cancellation is not lost by it: it has a table of its own, `membership_change` (V63), with no
 * amount in it by the owner's decision of the same day.
 *
 *
 * SENTENCES OF EARLIER MIGRATIONS THAT THIS OVERTURNS, NAMED HERE BECAUSE THEY CANNOT BE CHANGED.
 * A migration is immutable once it is merged (ADL, "migracija je nepromenljiva cim se spoji na
 * `main`"), so the sentences stay where they were written, and they are false from this file on:
 *
 *   - V16, beside `payment_state_known`: "Waiting, recognised, or reversed. A reversal is its own
 *     state rather than a deletion". It is a deletion.
 *   - V22, beside `membership_payment_fk`: "Nothing else ever deletes a payment - a reversal is a
 *     state and not a deletion (V16)." A cancellation deletes the payment, and that key's CASCADE
 *     is what takes the season's membership with it.
 *   - V42, beside `payment.received`: "A `reversed` row keeps its `received` for the same reason it
 *     keeps its day". There is no such row.
 *
 * What V22 says about its own carry ("A `reversed` payment is not one either") is a statement about
 * the rows that carry read on the day it ran, and stays true of that day.
 *
 * The rule's comment below says the same in the catalogue, so a reader of the schema meets the
 * current sentence and not only the overturned one.
 *
 *
 * THE ROWS THAT ARE ALREADY THERE. The rule is narrowed, so a row reading `reversed` would make this
 * file fail rather than pass. Measured before it was written, with the owner's permission, on QA on
 * 18.10.2026: `select count(*) from payment` is 0, so there is no such row and none of any other
 * state either. No route has ever written the word: the only writer of `payment` is
 * `BookingAPayment`, and it writes `recorded`. The rule is added valid, and nothing here deletes or
 * rewrites a payment to make it pass: a row that reads `reversed` stops this file with the rule's
 * own name, because removing a record of money is the owner's to decide and not a migration's.
 * `db/TheReversedStateGoesOverThePaymentsAlreadyThereTest` runs this file over a payment of each
 * state that remains, requires each to come out as it went in and the rule validated, and requires
 * a row reading `reversed` to stop it.
 */

alter table payment
    drop constraint payment_state_known;

alter table payment
    add constraint payment_state_known
        check (state in ('awaited', 'recorded'));

comment on constraint payment_state_known on payment is
    'Waiting or recognised, and nothing else. A cancelled payment is deleted, not marked: PDL P8, '
        '18.10.2026, "zapis o uplati se BRISE"; the trail of the cancellation is membership_change '
        '(V63). Until V64 a third state, reversed, stood here.';
