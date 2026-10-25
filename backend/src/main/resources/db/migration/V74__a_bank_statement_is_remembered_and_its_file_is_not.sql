/* A bank statement the Payments screen took, and every payment it said arrived.
 *
 * The owner, 24.10.2026 (PDL „Učitavanje izvoda iz banke na ekranu Uplate”), chose with my
 * recommendation: „Server pamti broj izvoda i stavke (da se isti izvod ne knjiži dvaput), a sam PDF ne
 * čuva.” So these two tables hold what was READ off a statement, and the file itself is kept nowhere:
 * not here, not on the disc (StatementApi reads it in memory and lets it go).
 *
 *
 * THE STATEMENT
 * -------------
 * Known by its account, its number and its day, because that is how the bank names one: „IZVOD BROJ 1,
 * Od: 23.10.2026”, on the account printed above its items. The number alone starts again every year, so
 * the day goes with it. Taking the same statement a second time finds this key and adds nothing.
 *
 * WHO TOOK IT, and his name frozen beside the key, for the reason V16 gives about `payment`: the account
 * may go (PDL P23) and the name stays.
 *
 *
 * ITS LINES
 * ---------
 * Only the payments that arrived. The owner: „Isplate (naknade banke) se preskaču.”, so the charges of
 * the bank are not kept at all.
 *
 * A LINE IS KNOWN BY THE BANK'S OWN ORDER NUMBER, „Nalog”, unique over every statement and not only
 * within one. That is what keeps one payment from being booked twice when it is printed on two
 * statements (a statement of a day and one of a month, say): the second finds its line already here.
 *
 * WHAT THE LINE SAYS IS KEPT AS THE BANK PRINTED IT: the payer (his name and the address after it), his
 * account, the amount in dinars (the only money account 105-0000000003284-71 holds, PDL P8 „Udruženje
 * ima jedan račun, u dinarima”), the payment code, the purpose and the reference when there is one.
 *
 * THE SEASON IT WAS TAKEN FOR is the one being paid for at the moment it was taken, off the clock and
 * never off the reference (PDL, POTVRDJENO 13.09.2026, „the day the money is booked”). Kept, so that
 * whether the line is already settled is asked about the season it was about, and not about whichever
 * season is on sale on the day somebody looks at it.
 *
 * BOOKED OR WAITING, and if waiting, why, as it stood when it was taken. `payment_id` names the payment
 * the statement booked by itself; `waits_because` names why it did not. Never both. Both empty is a line
 * whose payment was booked and has since been cancelled (PDL P8, „zapis o uplati se BRIŠE”): the key
 * goes to null with the payment, and the line is a line that waits again.
 *
 * WHETHER A WAITING LINE IS „ALREADY RECORDED” IS NOT KEPT, because it is not a fact about the
 * statement: it is the member's membership, which is asked of `membership` whenever the line is shown.
 *
 * Both tables are new, so no row stands in either for a constraint to meet.
 */

create table bank_statement (
    id             bigserial,
    account        text        not null,
    number         integer     not null,
    dated          date        not null,
    loaded_at      timestamptz not null,
    loaded_by      bigint,
    loaded_by_name text        collate sr_latn not null,

    constraint bank_statement_pk primary key (id),

    constraint bank_statement_loaded_by_fk foreign key (loaded_by) references account (id)
        on delete set null,

    constraint bank_statement_account_shape check (account ~ '^[0-9]{3}-[0-9]{13}-[0-9]{2}$'),
    constraint bank_statement_number_positive check (number > 0),
    constraint bank_statement_loaded_by_name_not_blank check (btrim(loaded_by_name) <> ''),

    constraint bank_statement_one_of_a_kind unique (account, number, dated)
);

create index bank_statement_loaded_by_idx on bank_statement (loaded_by);

create table bank_statement_line (
    id             bigserial,
    statement_id   bigint        not null,
    position       integer       not null,
    order_number   text          not null,
    payer          text          collate sr_latn not null,
    payer_account  text,
    amount         numeric(10,2) not null,
    payment_code   text,
    purpose        text          not null,
    reference      text,
    season         integer       not null,
    payment_id     bigint,
    waits_because  text,

    constraint bank_statement_line_pk primary key (id),

    constraint bank_statement_line_statement_fk foreign key (statement_id) references bank_statement (id)
        on delete cascade,
    constraint bank_statement_line_payment_fk foreign key (payment_id) references payment (id)
        on delete set null,

    constraint bank_statement_line_position_positive check (position > 0),
    constraint bank_statement_line_order_not_blank check (btrim(order_number) <> ''),
    constraint bank_statement_line_amount_positive check (amount > 0),
    constraint bank_statement_line_season_not_before_the_league check (season >= 2027),
    constraint bank_statement_line_waits_for_a_known_reason check (waits_because in
        ('noReference', 'unknownReference', 'anotherSeason', 'notInDinars', 'notTheExpectedAmount',
         'notBooked')),
    constraint bank_statement_line_booked_or_waiting check (payment_id is null or waits_because is null),

    constraint bank_statement_line_one_order_once unique (order_number),
    constraint bank_statement_line_one_position_once unique (statement_id, position)
);

create index bank_statement_line_payment_idx on bank_statement_line (payment_id);
