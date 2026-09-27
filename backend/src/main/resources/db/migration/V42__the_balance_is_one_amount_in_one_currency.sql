/*
 * THE BALANCE IS ONE AMOUNT IN ONE CURRENCY, AND THE CURRENCY IS THE MEMBER'S COUNTRY.
 *
 * THE DECISION, PDL section 25, owner 27.09.2026, in his own words: „balans je uvek u valuti
 * zavisno od drzave. Ukoliko je Srbija, to su dinari, ukoliko nije to su evri za sada. Balans uvek
 * skida u svojoj valuti, tako da nije ni bitno koliko je to u drugoj valuti. Nema ni potrebe da cuva
 * par, nego moze da cuva samo iznos i valutu, to je bolje."
 *
 * AND ITS OTHER HALF, PDL section 26, owner 27.09.2026, chosen between three outcomes: „Dvojka, 120
 * je kurs i tako ostaje do daljnjeg." So when a member changes country his balance is TRANSLATED
 * into the currency of the new one at 1 EUR = 120 RSD.
 *
 * WHAT THIS REPLACES, NAMED ONE BY ONE, BECAUSE IT IS A GREAT DEAL AND BECAUSE EVERY PIECE OF IT WAS
 * CORRECT UNDER THE SHAPE IT WAS WRITTEN FOR. `V38` (merged 27.09.2026, after three rounds of
 * review) gave the book a PAIR - `eur` and `rsd` side by side - and wrote at length that nothing
 * ever converts between them, off ADL's „Dve valute su dva zasebna cenovnika, ne jedan sa
 * konverzijom". Everything built on that pair was the only right answer while the pair stood:
 *
 *   - `balance_entry_a_referral_adds` and `balance_entry_a_membership_takes` bound the sign of BOTH
 *     halves, because a line that moved one currency and not the other was money said once and
 *     lost once;
 *   - `GrantingAMembership.whatComesOffTheBook` carried a BINARY rule with twenty lines of reason on
 *     it (covered in both currencies, take the fee; otherwise take the whole book), precisely
 *     because `min` taken per currency answered „40 EUR and 600 RSD" for a balance of 50/600
 *     against a fee of 40/4.800, which is a rate of fifteen to one and therefore a conversion the
 *     portal was forbidden to perform;
 *   - `Balance.Money.isMoneyInBothCurrencies` and the refusal
 *     `GrantingAMembership.Outcome.NOTHING_WOULD_COME_OFF_THE_BOOK` existed for the one-sided state
 *     a pair can land in, 15.00/0.00, which satisfied neither „is nothing" nor „is money".
 *
 * ALL FOUR ARE GONE WITH THE PAIR, AND THAT IS THE DECISION BEING CARRIED OUT RATHER THAN SOMEBODY
 * ELSE'S WORK BEING UNDONE. One amount has no second currency to be nothing in while the first is
 * not, so the state those three guarded CANNOT BE REACHED any more; `whatComesOffTheBook` collapses
 * to `min(balance, fee)`, which is what `Balance.Settlement.fromTheBalance` already is, so the
 * method disappears rather than shrinking. `V38` itself predicted exactly this, in the note on
 * `NOTHING_WOULD_COME_OFF_THE_BOOK`: „Once the book is one amount in one currency rather than a
 * pair, there is no second currency left to be nothing while the first is not, and this road closes
 * with the pair it depends on."
 *
 * AND ADL IS NOT CONTRADICTED, WHICH IS THE ONE THING THAT WOULD STOP THIS FILE. „Dve valute su dva
 * zasebna cenovnika, ne jedan sa konverzijom" is about the PRICE LIST, and the price list is
 * untouched here: PDL P12d says so in its own words under „Obim ove odluke je CENOVNIK" - the
 * cenovnik is never converted and its two columns are typed freely and independently, while the
 * balance at a change of country IS converted. `MembershipPrice` carries the sentence „Anything HERE
 * that worked one out of the other would be the rule he refused", and the word „here" is that
 * boundary. Nothing below computes any price from any other price.
 *
 * WHAT ZATECENO STATE THIS RUNS AGAINST, measured on the QA database on 28.09.2026 and not guessed,
 * with the query beside the answer so the next reader does not have to measure it again:
 *
 *     select count(*) from balance_entry     -> 0
 *     select count(*) from balance_promise   -> 0
 *     select count(*) from payment           -> 0
 *     select count(*) from membership        -> 1
 *     select count(*) from competitor        -> 1
 *
 * QA is the ONLY database that exists; there is no production one, because the portal is not
 * launched. THAT IS WHY EVERY CONSTRAINT BELOW IS PLAIN AND NOT `not valid`: `not valid` (V35) is a
 * true sentence about a row that EXISTS and cannot be put right, and there is no such row here to
 * spare. The one `membership` row is the owner's own and it is the row that stopped V35 on QA this
 * very week; nothing below touches that table, which is measured rather than assumed - the column
 * `membership.balance_entry_id` and its constraint
 * `membership_basis_says_whether_a_book_entry_is_named` name no currency and need no change.
 *
 * AND THE BACKFILL BELOW IS STILL WRITTEN AS THOUGH ROWS STOOD, AND MEASURED THAT WAY
 * (`db/BalanceBecameOneAmountTest`), because „empty today" is not „empty wherever this is ever
 * applied": a developer's database holds whatever his tests last committed, and the rule written on
 * 27.09.2026 asks that a migration be measured over rows its own tests did not make.
 */


/* ---------------------------------------------------------------------------------------------
 * THE BOOK: ONE AMOUNT, ONE CURRENCY
 * ------------------------------------------------------------------------------------------ */

alter table balance_entry
    add column amount   numeric(10,2),
    add column currency text;


/*
 * AND WHICH OF THE TWO HALVES SURVIVES IS DECIDED BY THE MEMBER'S COUNTRY, never by which column
 * happens to be larger and never by a rate.
 *
 * THE COUNTRY IS READ BY BOTH ROADS V7 ALLOWS, and that is the whole reason this is a join and not a
 * column read. `competitor_town_is_from_the_codebook_or_typed` and
 * `competitor_typed_town_names_its_country` (V7) make a member's country arrive EITHER through
 * `place_id` into the town codebook OR through `country_id` beside a town he typed by hand, exactly
 * one of the two on every row. `coalesce` over both is the reading `PaymentsDueApi` already uses for
 * the same question, and a backfill that read only `country_id` would have given every member of a
 * codebook town the euro column - which is most of them, and all of the Serbian ones.
 *
 * `'RS'` IS THE ONLY COUNTRY BILLED IN DINARS, which is the owner's sentence („Ukoliko je Srbija, to
 * su dinari, ukoliko nije to su evri za sada") and is the same literal `PaymentsDueApi` holds. From
 * this branch onwards it has ONE home in the code, `domain.pricing.Currency`, and this file is the
 * second place the word appears at all - which it must be, because a migration cannot call Java.
 *
 * WHAT ABOUT A MEMBER WHO NO LONGER EXISTS: there is none. `balance_entry_competitor_fk` is ON
 * DELETE CASCADE, so every row here names a living competitor and the join cannot drop one. That is
 * why this is a plain `update ... from` and not a `left join` with a fallback: a fallback would be
 * code for a state the schema forbids, and `not null` below is what says so out loud.
 */
update balance_entry e
set amount   = case when whose.country_code = 'RS' then e.rsd else e.eur end,
    currency = case when whose.country_code = 'RS' then 'RSD' else 'EUR' end
from (select c.id,
             coalesce(town_country.code, typed_country.code) as country_code
      from competitor c
               left join place town on town.id = c.place_id
               left join country town_country on town_country.id = town.country_id
               left join country typed_country on typed_country.id = c.country_id) whose
where whose.id = e.competitor_id;


alter table balance_entry
    alter column amount set not null,
    alter column currency set not null;


/*
 * THE TWO SIGN RULES OVER THE PAIR ARE DROPPED BY HAND, although dropping the columns would take
 * them anyway.
 *
 * Measured on 27.09.2026 (`BalanceCarriedOverTest`, on `cascade`): PostgreSQL drops a table
 * constraint together with a column it names, asked to or not. They are named here because they are
 * being REPLACED by rules of the same name over `amount`, and a reader who finds the new ones
 * without finding the old ones going has to work out for himself that they are not two rules but
 * one rewritten.
 */
alter table balance_entry
    drop constraint balance_entry_a_referral_adds,
    drop constraint balance_entry_a_membership_takes;

alter table balance_entry
    drop column eur,
    drop column rsd;


/* ---------------------------------------------------------------------------------------------
 * TWO NEW REASONS, AND THE BOOK NOW HAS FOUR
 * ------------------------------------------------------------------------------------------ */

/*
 * `V38` allowed exactly two, with the sentence „Two reasons and not more: the portal can only put
 * money on a balance by a referral being activated, and can only take it off by a membership
 * standing on it." Both halves of that sentence were true when it was written and both have been
 * overtaken by a decision of the owner's, each by its own:
 *
 *   `overpayment` - PDL section 19, case 7, owner 27.09.2026: money can now arrive in EXCESS of
 *   what was expected, and „visak ulazi u balans kao kredit". PDL records why that outcome was
 *   chosen over the other two offered: „balans vec postoji kao mesto gde stoji clanov novac kod
 *   nas, pa se visak ne izmislja nigde drugde i clan ne gubi ono sto je poslao." PDL section 24
 *   named this very gap as the technical consequence of the spec - „slucaj 7 nema `reason` pod kojim
 *   bi se upisao: `V38` dozvoljava samo `referral` i `membership`" - and this is it being filled.
 *
 *   `conversion` - PDL section 26. A change of country moves money between currencies, which is
 *   neither earning nor spending: the member has exactly what he had, said in the other money.
 *
 * AND WHY A CONVERSION IS TWO ROWS AND NOT ONE NETTED ROW. Every row now carries its own currency,
 * so the balance is `sum(amount)` over the rows IN HIS CURRENCY - a sum across two currencies is not
 * a number. A single netting row would therefore leave the old currency's rows standing with a
 * positive sum nobody ever cancelled, and the balance would depend on the reader remembering to
 * filter. Two rows - the whole old balance OUT of the old currency, the translated amount IN to the
 * new one - leave the old currency summing to exactly nought, which is the honest statement that
 * there is nothing left there, and they leave every row saying truthfully what currency it was
 * written in. `a_balance_entry_is_written_once` is why the alternative was never open: rewriting the
 * old rows into the new currency is refused by the trigger, and rightly - ADL asks for
 * „nepromenljive stavke", and a book whose past can be restated in another money is not one.
 *
 * SO THIS IS THE ONE REASON THAT MAY MOVE THE BALANCE EITHER WAY, and nought is still refused: a
 * conversion of nothing is not a fact about money, and a member whose book is empty when he moves
 * country has nothing to translate and gets no row at all.
 */
alter table balance_entry
    drop constraint balance_entry_reason_known;

alter table balance_entry
    add constraint balance_entry_reason_known
        check (reason in ('referral', 'membership', 'overpayment', 'conversion'));


alter table balance_entry
    add constraint balance_entry_currency_known check (currency in ('EUR', 'RSD'));


/*
 * WHICH WAY EACH REASON MAY MOVE THE BALANCE, the same rule `V38` wrote over the pair and for the
 * identical reason it gave: „a referral written negative would silently rob the member who earned it
 * and nothing else in the schema would notice." Nought is refused everywhere, because an entry that
 * moves nothing is not a fact about money.
 */
alter table balance_entry
    add constraint balance_entry_a_referral_adds
        check (reason <> 'referral' or amount > 0),

    add constraint balance_entry_a_membership_takes
        check (reason <> 'membership' or amount < 0),

    /* A credit, for the reason it exists: he sent more than he owed and gets it back as balance. */
    add constraint balance_entry_an_overpayment_adds
        check (reason <> 'overpayment' or amount > 0),

    /* Either way, and never nothing. Out of the old currency it is negative, into the new one
       positive, and which of the two a row is cannot be said in advance. */
    add constraint balance_entry_a_conversion_moves_something
        check (reason <> 'conversion' or amount <> 0);


/*
 * AND WHICH REASONS BELONG TO A SEASON, WIDENED IN BOTH DIRECTIONS AT ONCE.
 *
 * `V38` read `(reason = 'membership') = (season is not null)` and gave the reason it is a
 * biconditional rather than half of one: „nothing ever nulls this column, so there is no moment at
 * which half of it stops being true." That property is unchanged and so is the shape; what changes
 * is WHICH reasons are on the season side of it, and both new ones had to be decided rather than
 * defaulted:
 *
 *   `overpayment` IS about a season. It arises only while a payment for one season is being booked,
 *   and the surplus is the difference between what arrived and what that season expected. A credit
 *   with no season would be money whose origin nothing records.
 *
 *   `conversion` is NOT about a season. It is about the member's country changing, which happens on
 *   whatever day he edits his own record (`PUT /api/me`) and has nothing to do with what he has
 *   bought. PDL section 26: „Trenutak je promena zemlje na zapisu clana, ne prijava i ne pocetak
 *   sezone."
 */
alter table balance_entry
    drop constraint balance_entry_membership_names_the_season;

alter table balance_entry
    add constraint balance_entry_what_names_the_season
        check ((reason in ('membership', 'overpayment')) = (season is not null));


comment on column balance_entry.amount is
    'How much this line moves the balance, in the currency beside it, with the sign saying which way: '
        'positive earns, negative spends, and which a row is allowed to be is said by `reason` '
        'through four constraints rather than left to whoever writes the insert. Since V42 this is ONE '
        'amount and not the pair V38 held: the owner decided on 27.09.2026 (PDL 25) that „balans je '
        'uvek u valuti zavisno od drzave ... Nema ni potrebe da cuva par, nego moze da cuva samo iznos '
        'i valutu".';

comment on column balance_entry.currency is
    'Which money this line is in, and it is the member''s country that decides: Serbia means RSD, '
        'everything else EUR (owner, 27.09.2026, PDL 25). The balance is therefore the sum of his '
        'lines IN HIS CURRENT CURRENCY, and a change of country writes two `conversion` lines at 1 EUR '
        '= 120 RSD (PDL 26) rather than rewriting what already stands, which '
        '`a_balance_entry_is_written_once` forbids anyway.';

comment on table balance_entry is
    'The book of balance changes (ADL, virtuelni balans): every movement as its own immutable row, and '
        'the balance itself is always the sum of them and never a stored number. Since V42 a row is '
        'one amount in one currency, and the sum is taken over the rows in the member''s current '
        'currency.';


/* ---------------------------------------------------------------------------------------------
 * AND THE PROMISE, WHICH IS A DIFFERENT KIND OF FACT AND MOVES FOR A DIFFERENT REASON
 * ------------------------------------------------------------------------------------------ */

/*
 * `balance_promise` records WHAT A PAYMENT CODE SAID, not what a member has, so the owner's sentence
 * about the balance does not reach it by itself. It converts for a reason of its own, and the reason
 * is measured:
 *
 * FIRST, LEAVING IT A PAIR WOULD CARRY OUT THE DECISION HALFWAY. `Balance.asThePromiseStands`
 * settles a promise against a fee by handing it to the same arithmetic a balance goes through, so a
 * promise that stayed a pair would keep `Balance.Money` a pair for that one road, and „nema ni
 * potrebe da cuva par" would be true of one table and false of the other.
 *
 * SECOND, AND THIS IS WHAT DECIDES WHAT HAPPENS TO A STANDING PROMISE WHEN A MEMBER MOVES COUNTRY:
 * `V38` wrote, in as many words, that this table deliberately carries NO immutability trigger,
 * „because the day a decision does call for re-minting a code, that is a decision about a screen and
 * not a schema migration". So the schema already permits a promise to be taken away and minted
 * again, and the book does not. That is the difference between the two tables, and it is why the
 * route that changes a member's country DELETES his standing promise instead of translating it.
 *
 * AND THE COST OF THAT IS MEASURED AND NOT ARGUED: he loses the number his season's code was pinned
 * to and his next look mints a new one. It costs him nothing real, because the slip in his hand is
 * not payable either way - `frontend/src/data/paymentQr.ts` mints a Serbian member an IPS slip whose
 * amount field is literally prefixed `RSD`, and a foreign member a PayPal link carrying
 * `currency_code: 'EUR'`, and its own note says a euro account „would be a second account". Those
 * are two different instruments on two different accounts, not one slip in two currencies. A member
 * who has moved cannot pay the old one however much the portal remembers about it.
 */
alter table balance_promise
    add column amount   numeric(10,2),
    add column currency text;

update balance_promise p
set amount   = case when whose.country_code = 'RS' then p.rsd else p.eur end,
    currency = case when whose.country_code = 'RS' then 'RSD' else 'EUR' end
from (select c.id,
             coalesce(town_country.code, typed_country.code) as country_code
      from competitor c
               left join place town on town.id = c.place_id
               left join country town_country on town_country.id = town.country_id
               left join country typed_country on typed_country.id = c.country_id) whose
where whose.id = p.competitor_id;

alter table balance_promise
    alter column amount set not null,
    alter column currency set not null;

alter table balance_promise
    drop constraint balance_promise_not_negative;

alter table balance_promise
    drop column eur,
    drop column rsd;

/*
 * NEVER NEGATIVE AND ALLOWED TO BE NOUGHT, which is `V38`'s rule unchanged and its reason with it: „a
 * member with an empty book is promised nothing, and „nothing" is an honest answer to record rather
 * than an absent row that a reader has to guess about." The zero row is load-bearing - the mere
 * PRESENCE of a row is what says this season's code has been minted and its number fixed.
 */
alter table balance_promise
    add constraint balance_promise_not_negative check (amount >= 0);

alter table balance_promise
    add constraint balance_promise_currency_known check (currency in ('EUR', 'RSD'));

comment on column balance_promise.currency is
    'Which money the code was minted in, which is the member''s country at the moment of minting: '
        'Serbia means RSD, everything else EUR. A promise in a currency that is no longer his is not '
        'translated but DELETED when he changes country, because the slip it describes is a different '
        'instrument on a different account and is not payable either way (V38 left this table without '
        'an immutability trigger for exactly this kind of decision).';

comment on table balance_promise is
    'What this season''s payment code promised a member his balance would cover, written at the first '
        'look and never rewritten while it stands. Not a movement and not part of the balance: the '
        'balance falls only when a payment is booked (owner, 26.09.2026). Since V42 one amount in one '
        'currency (PDL 25), and a change of country removes it rather than converting it (PDL 26).';


/* ---------------------------------------------------------------------------------------------
 * AND A PAYMENT NOW RECORDS WHAT ARRIVED, BESIDE WHAT WAS ASKED
 * ------------------------------------------------------------------------------------------ */

/*
 * PDL section 19, owner 27.09.2026, the definitive specification of the activation row: a moderator
 * types an amount into a field beside the label „Ocekivan iznos", and five of its seven cases turn on
 * how that number compares with what was expected - equal, less with the balance covering the
 * difference, less with the balance spent to the end, less with the balance switched off, and
 * greater. The owner wrote that this „obara sve ranije nacrte tog ekrana, ukljucujuci moj zakljucak
 * iz odeljka 14 da zapis o uplati nema iznos."
 *
 * SO WHY A SECOND COLUMN AND NOT A NEW MEANING FOR `amount`. Because `amount` already has a meaning
 * and it was decided with its cost stated. `V16` writes beside it „What was ASKED and in what money",
 * and `PaymentApi` says at length: „WHAT THIS ROUTE DOES NOT DO IS REDUCE `payment.amount`. The row
 * keeps the whole membership fee, because that is what he was CHARGED and ADL says an amount comes
 * off the price list ... Written the other way round - the reduced figure in `payment.amount` - the
 * books would show a membership sold for less than the price list says it costs, and there would be
 * nowhere to see that the association settled part of it out of what it already owed the member."
 *
 * PDL 19 says the RECORD carries an amount. It does not say that column changes meaning, and these
 * are the only two sentences in play, so the reading in which BOTH stay true is the one taken here:
 * `amount` is what the price list charged, `received` is what the bank statement showed, and the
 * difference between them is either what a balance discharged or what a moderator accepted as short.
 * THE TWO COLUMNS ARE NOT ONE FACT SAID TWICE and the sentence saying so lives on the column itself,
 * because this is the first place a next reader will think one of them is a mistake.
 *
 * NULLABLE, AND EXACTLY WHEN THE ROW IS STILL AWAITED, which is the shape `payment_recognised_says_when`
 * and `payment_recognised_says_who` (V16) already have in this table: a payment nobody has recognised
 * has no day, no name and now no arrived amount, and one that was recognised has all three. A
 * `reversed` row keeps its `received` for the same reason it keeps its day - the money did arrive, and
 * then it went back.
 *
 * WHAT THE BACKFILL WRITES, AND WHY IT IS NOT INVENTED DATA. A row written before today was written
 * under the rule that the member sends exactly what he was asked for; `PaymentsDueApi` computes that
 * expectation as `amount + fee` and nothing anywhere recorded a departure from it. So `amount + fee`
 * is not a guess about such a row, it IS what the row meant. Measured: there are no such rows on QA
 * (`select count(*) from payment` -> 0, 28.09.2026), so this statement is for a developer's database
 * and for `db/BalanceBecameOneAmountTest`.
 */
alter table payment
    add column received numeric(10,2);

update payment
set received = amount + fee
where state <> 'awaited';

alter table payment
    add constraint payment_received_positive check (received is null or received > 0),

    add constraint payment_recognised_says_what_arrived
        check ((state = 'awaited') = (received is null));

comment on column payment.received is
    'What actually arrived, in the currency beside it, as a moderator read it off the bank statement '
        'and typed it (owner, 27.09.2026, PDL 19). NOT the same fact as `amount`, which is what the '
        'price list CHARGED: the difference between them is what a balance discharged, or what a '
        'moderator knowingly accepted as short, or - when `received` is the larger - a surplus that '
        'went onto his balance as an `overpayment` line. Empty exactly while the payment is still '
        'awaited, the same shape `recorded_at` and `recorded_by_name` have.';
