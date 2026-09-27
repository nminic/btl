/*
 * TWO WAYS THE MONEY ARRIVES, AND THE SLIP IS CALLED `ips`.
 *
 * THE DECISION, PDL 23b, owner 27.09.2026, chosen between the outcomes offered: the set has exactly
 * two members, `ips` and `paypal`. `slip`, `card` and `sepa` go.
 *
 * AND HIS NOTE, WHICH DECIDES SOMETHING RATHER THAN ASKING FOR A THIRD VALUE. In his own words:
 * „Ali uzmi u obzir da pored pisu podaci koje neko uvek moze manuelno prepisati u uplatnicu. Zar
 * ne?" The figures printed beside the QR code are there exactly so that somebody CAN copy them into
 * a slip by hand, and when he does the money arrives BY THE SAME ROAD - the same dinar account, the
 * same act - as it does when the code is scanned. So a slip filled in by hand is `ips` too, and that
 * is why this file ends with two values and not three. Read the other way round the same sentence
 * would have added a third, and PDL 23b writes that reading down in order to refuse it.
 *
 * WHAT STOOD HERE BEFORE. V16:115 carried `check (method in ('slip', 'card', 'paypal', 'sepa'))`,
 * under a comment calling them „the four ways money arrives (...) A member from Serbia sees the slip
 * and the card, a member abroad sees PayPal and SEPA (P8, 31.07.2026)". Two of those four were never
 * chosen: no card provider was ever picked, and the SEPA value reached nothing at all. Measured over
 * `backend/src` and `frontend/src` on 27.09.2026, before this file was written, it stood in exactly
 * two places - V16's own list, and the set in `PaymentApi` that mirrored it. No screen, no test and
 * no row ever said it, which is why dropping it takes nothing with it.
 *
 * AND THE NAME IS NOT COINED HERE. `frontend/src/data/paymentQr.ts:124` has read
 * `export type PaymentMethod = 'ips' | 'paypal'` since the card was taken out on 26.09.2026, and
 * `methodsFor` answers `['ips']` for a member who pays in dinars and `['paypal']` for everybody
 * else. The portal has therefore been saying `ips` on the screen and `slip` in the table, and this
 * migration brings the schema to the word the screen already uses.
 *
 * WHY NOTHING ON THE SERVING SIDE MOVES WITH IT, said out loud because it is the question a reader
 * asks next: `method` is write-only today. `POST /api/payments` takes it, no route serves it back,
 * and no screen calls that route yet. So this file and `PaymentApi.METHODS` are the whole of the
 * change, and there is no reader anywhere holding the old four words.
 */


/*
 * THE ROWS THAT ARE ALREADY THERE, WHICH IS THE HALF NO ORDINARY TEST CAN SEE.
 *
 * `slip` is what a payment slip was called and `ips` is what it is called now: one road under two
 * names. So the rows carrying it are RENAMED rather than refused.
 *
 * AND AFTER THIS FILE `'slip'` CANNOT BE WRITTEN AGAIN. That is what makes the statement below
 * invisible to every test that starts from an empty database: no case can produce the row it acts
 * on, so deleting it leaves the whole suite green. `PaymentMethodCarriedOverTest` is the one thing
 * that can see it - it puts V16's constraint back, writes the row a real database holds, and then
 * runs THIS FILE through `DatabaseTest.migrationSql`. That is the class which took QA down for 7
 * hours and 50 minutes on 27.09.2026, and it is measured here rather than found there.
 */
update payment set method = 'ips' where method = 'slip';


/*
 * AND `card` AND `sepa` ARE NOT TRANSLATED, WHICH IS A DECISION AND NOT AN OMISSION.
 *
 * There is no honest value to move them to. A card payment is money that came in through a card
 * processor: writing `ips` over it would say it arrived on a dinar slip, and writing `paypal` would
 * name an intermediary that never saw it. Either one is a false record of how money arrived, which
 * is the same thing this portal refused on 27.09.2026 when it would not put a name on an exemption
 * nobody had granted. So a row carrying either value stops this migration, and that is the intended
 * outcome: it asks a person what really happened instead of guessing on his behalf.
 *
 * WHICH IS WHY THE CONSTRAINT IS PLAIN AND NOT `not valid`, and the difference is measured rather
 * than argued. On QA on 27.09.2026 `select count(*) from payment` answered 0 and
 * `select coalesce(method,'(prazno)'), count(*) from payment group by 1` answered nothing at all, so
 * there is no such row anywhere to spare. `not valid` (V35) is a true sentence about a row that
 * EXISTS and cannot be corrected; written over an empty table it would only be a permanent excuse
 * for whatever gets in first.
 */
alter table payment
    drop constraint payment_method_known;

alter table payment
    add constraint payment_method_known check (method in ('ips', 'paypal'));


/*
 * THE BOUNDARY THE OWNER WAS SHOWN AND ACCEPTED, written on the column so that the next reader finds
 * it where he is looking rather than in a journal: a payment made from the EU STRAIGHT INTO THE
 * ACCOUNT has no word here and needs a decision of its own (PDL 23b, pointing at 20a). The outcome
 * which would have covered it was offered and REFUSED. Until that decision exists, money arriving
 * that way is recorded under one of these two by whoever recognises it, and this file does not
 * pretend otherwise.
 */
comment on column payment.method is
    'How the money arrived, and since V39 it is one of exactly two words: ips or paypal. The owner '
        'decided that on 27.09.2026 (PDL 23b), where ips is the QR payment slip into the dinar '
        'account and covers a slip somebody copied out by hand from the figures printed beside the '
        'code, because that money takes the same road. slip was renamed to ips by this migration; '
        'card and sepa were dropped, neither having ever been chosen. BOUNDARY: a payment made from '
        'the EU straight into the account has no word of its own and needs a decision, which PDL '
        '23b names and 20a holds. It is recorded under one of these two until then.';
