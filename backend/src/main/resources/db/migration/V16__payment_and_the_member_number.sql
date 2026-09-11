/*
 * The money, and the one thing it hands out: a member number. Step thirteen.
 *
 * THIS MIGRATION STARTS BY UNDOING SOMETHING V7 SAID, and that is the whole reason it is first in
 * the file rather than last.
 *
 * V7 made `member_number` NOT NULL. PDL P8 says the opposite in as many words: "Clanski broj se
 * dodeljuje automatski u trenutku EVIDENTIRANJA UPLATE", and the consequence it spells out itself,
 * "registrovan a neplacen clan nema clanski broj". Those two cannot both be true, and what it meant
 * in practice is that somebody who registered and had not yet paid HAD NOWHERE TO STAND: he is not a
 * row in `competitor`, because that row demands a number he cannot have until he pays, and he is not
 * a row anywhere else either.
 *
 * The owner decided on 11.09.2026 that the number becomes optional, and the reason he chose it over
 * a separate `registration` table is the one this schema keeps paying for: thirteen columns and
 * their constraints would have lived in two places, so every correction would have had to be made
 * twice.
 *
 * WHAT THAT CHANGES FOR EVERY READER, and it is written here rather than left to be discovered: a
 * row in `competitor` is a PERSON WHO REGISTERED. A MEMBER is a row whose `member_number` is there.
 * Any query that counted members by counting rows now counts applicants too.
 */
alter table competitor
    alter column member_number drop not null;


/*
 * AND THE NUMBER IS NEVER HANDED OUT TWICE, which is a sequence and not a query.
 *
 * PDL P8, 31.07.2026: "Sledeci broj je jedan iznad NAJVISEG IKAD dodeljenog, nikad prvi slobodan."
 * That sentence exists because of a collision between two other ones: a member may ask to be deleted
 * (P23), and his number stands in old results, old tables and a printed card. Reusing it would give
 * his card to somebody else.
 *
 * A query cannot say it. `max(member_number) + 1` reads what is THERE, and what is there is missing
 * exactly the numbers of the people who left. A sequence only ever goes up, and it is the one shape
 * that survives a deleted row - which is the whole of why this is here rather than in the service.
 */
create sequence member_number_seq as integer start with 1 no cycle;


/*
 * What somebody owes or has paid, for one season.
 *
 * HOW A PAYMENT IS RECOGNISED (P8, 31.07.2026): by the reference number, and the bank statement is
 * reconciled by it in bulk. The reference is the season and the member number run together, digits
 * and nothing else - `202737` - because it is read off a statement by a machine and a separator is
 * one more thing that can be dropped or changed on the way.
 *
 * WHICH MEANS A FIRST PAYMENT HAS NO REFERENCE, and that is derived rather than decided here. The
 * number is handed out when the payment is recorded, so somebody paying for the first time does not
 * have one to write. P8 already says what happens then, twice over: an unpaid person "se u redu za
 * uplate vodi po imenu i adresi elektronske poste", and manual confirmation row by row stays
 * "jer uplata bez poziva na broj uvek trazi coveka". The QR payload leaves the reference tag out
 * rather than sending it empty. So the column is nullable, and a null is a payment a person matches.
 *
 * WHAT IT COSTS IS NOT COPIED HERE but pointed at: `price_row` is the price list (V4, seven rows),
 * and the row that applied is named. The AMOUNT is copied, because a price list is edited and what
 * somebody actually paid must not move when it is.
 */
create table payment (
    id            bigserial     not null,
    competitor_id bigint        not null,
    season        integer       not null,

    /* The reference, when there is one. */
    reference     text,

    /* What was asked and in what money, and the row of the price list it came from. */
    price_row_id  bigint        not null,
    amount        numeric(10,2) not null,
    currency      text          not null,

    /* And the processing fee, which is NOT membership and is shown as its own line (owner,
       03.08.2026: "stalo mi je da se naznaci da to nije clanarina nego obrada taksi"). It is only
       ever charged on euro payments, because it covers an intermediary the dinar account does not
       have. Nought is the ordinary value. */
    fee           numeric(10,2) not null default 0,

    method        text          not null,
    state         text          not null default 'awaited',

    /* Who recognised it and when. Both empty while it is waiting. The account may go (PDL P23) and
       the name stays, the same shape a decision has in V9 and a message in V13. */
    recorded_at      timestamptz,
    recorded_by      bigint,
    recorded_by_name text        collate sr_latn,

    constraint payment_pk primary key (id),

    constraint payment_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,
    /* A price row does not leave while a payment names it. */
    constraint payment_price_row_fk foreign key (price_row_id) references price_row (id)
        on delete restrict,
    constraint payment_recorded_by_fk foreign key (recorded_by) references account (id)
        on delete set null,

    /* Digits and nothing else, and unique when it is there: the whole point of a reference is that
       one line of a bank statement names one payment. */
    constraint payment_reference_shape check (reference is null or reference ~ '^[0-9]{7,}$'),
    constraint payment_reference_unique unique (reference),

    constraint payment_season_not_before_the_league check (season >= 2027),
    constraint payment_amount_positive check (amount > 0),
    constraint payment_fee_not_negative check (fee >= 0),

    /* Two currencies, and the fee belongs to one of them. */
    constraint payment_currency_known check (currency in ('EUR', 'RSD')),
    constraint payment_only_euro_carries_a_fee check (currency = 'EUR' or fee = 0),

    /* The four ways money arrives, and they are a list on purpose: each one is a different screen
       and a different thing the server has to do, not a value somebody adds. A member from Serbia
       sees the slip and the card, a member abroad sees PayPal and SEPA (P8, 31.07.2026). */
    constraint payment_method_known check (method in ('slip', 'card', 'paypal', 'sepa')),

    /* Waiting, recognised, or reversed. A reversal is its own state rather than a deletion, because
       "stornirana uplata: clanski broj propada, clan postaje neaktivan za tu sezonu" is a thing that
       HAPPENED and the portal has to be able to say so. */
    constraint payment_state_known check (state in ('awaited', 'recorded', 'reversed')),

    /* A payment that is still waiting has been recognised by nobody. */
    constraint payment_recognised_says_when check ((state = 'awaited') = (recorded_at is null)),
    constraint payment_recognised_says_who check ((state = 'awaited') = (recorded_by_name is null)),
    constraint payment_recorded_by_name_not_blank
        check (recorded_by_name is null or btrim(recorded_by_name) <> ''),

    /* One payment per member per season, whatever state it is in. Paying twice for one season is
       not two payments; it is one payment and a conversation. */
    constraint payment_one_a_season unique (competitor_id, season)
);

create index payment_competitor_idx on payment (competitor_id);
create index payment_price_row_idx on payment (price_row_id);
create index payment_recorded_by_idx on payment (recorded_by);
create index payment_season_state_idx on payment (season, state);
