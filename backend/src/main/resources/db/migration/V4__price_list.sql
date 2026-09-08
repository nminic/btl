--
-- GENERATED FILE. Do not edit by hand.
--
-- Written by backend/tools/generate_reference_migrations.py out of
--   frontend/src/data/pricing.ts (by hand, see PRICE_ROWS)
-- Run that script again after changing the source; a hand edit here is undone
-- by the next run, and ReferenceDataMatchesCodebookTest fails on either.
--

/* The price list as one table with a kind of row on it (ADL A36, O12): four
   periods, one level, one fee. Six rows, and the kind is what tells them apart
   rather than three tables answering one question.

   Amounts are numeric and never a float (ADL A12), and the two currencies are
   two price lists rather than one with a rate on it: the dinar price is fixed
   for the season at 120 to the euro and does not follow the exchange rate.

   `day_from` and `day_to` are a day of the year, mm-dd, and not a date. The
   list repeats: membership for 2027 is sold until 30 September 2027, and on 1
   October the same four periods open again for 2028. Written as dates it would
   have been four rows that expire, and the portal would quietly stop having a
   price on a morning nobody was watching.

   What this table does not enforce, said out loud rather than left to be found:
   that the four periods tile the year with no gap and no overlap. No overlap is
   expressible as an exclusion constraint over a range; no gap is not, and half
   a rule in the schema reads as the whole of it. Both halves are held over the
   six rows by PriceListRowsTest instead, which is the stronger statement of the
   two. */
create table price_row (
    id         bigserial     not null,
    key        text          not null,
    kind       text          not null,
    day_from   text,
    day_to     text,
    eur        numeric(10,2) not null,
    rsd        numeric(10,2),
    ranking    boolean,
    sort_order integer       not null,

    constraint price_row_pk primary key (id),
    constraint price_row_key_unique unique (key),
    constraint price_row_sort_order_unique unique (sort_order),

    constraint price_row_kind_known check (kind in ('period', 'level', 'fee')),
    constraint price_row_key_not_blank check (btrim(key) <> ''),
    constraint price_row_sort_order_positive check (sort_order > 0),

    /* A period is the only kind of row sold in a window of the year, and it is
       never sold outside one. Both directions, because a level with dates on it
       and a period without them are two different faults. */
    constraint price_row_period_has_days
        check ((day_from is not null) = (kind = 'period')
           and (day_to is not null) = (kind = 'period')),

    constraint price_row_day_from_shape
        check (day_from is null or day_from ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
    constraint price_row_day_to_shape
        check (day_to is null or day_to ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
    constraint price_row_days_in_order check (day_from is null or day_from <= day_to),

    constraint price_row_eur_not_negative check (eur >= 0),
    constraint price_row_rsd_not_negative check (rsd is null or rsd >= 0),

    /* The fee is the one row with no dinar side, because there is no payment
       intermediary on that side to pay (PDL, 04.08.2026). It is shown to
       everybody and paid by those who pay in euro, so it is a row of the list
       and not a sentence on a screen. */
    constraint price_row_only_fee_has_no_rsd check ((rsd is null) = (kind = 'fee')),

    /* Only a period answers whether what it buys is ranked. The junior fee
       holds whenever it is paid and follows the period it was paid in
       (Clan 11), and the fee buys nothing in the rulebook at all, so both leave
       the column empty rather than saying Da or Ne. */
    constraint price_row_only_period_is_ranked check ((ranking is not null) = (kind = 'period'))
);

insert into price_row (key, kind, day_from, day_to, eur, rsd, ranking, sort_order) values
    ('early', 'period', '10-01', '10-05', 35, 4200, true, 1),
    ('regular', 'period', '10-06', '11-30', 40, 4800, true, 2),
    ('late', 'period', '12-01', '12-31', 50, 6000, true, 3),
    ('season', 'period', '01-01', '09-30', 40, 4800, false, 4),
    ('junior', 'level', null, null, 20, 2400, null, 5),
    ('processing', 'fee', null, null, 3, null, null, 6);
