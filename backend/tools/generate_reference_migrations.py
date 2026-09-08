# -*- coding: utf-8 -*-
"""Writes the reference-data migrations from the codebooks the portal already ships.

Run from anywhere:

    python backend/tools/generate_reference_migrations.py

It writes, under `backend/src/main/resources/db/migration`:

    V2__country.sql     246 countries, out of frontend/src/data/countries.json
    V3__place.sql    46,906 towns,     out of frontend/public/mock/places.json
    V4__price_list.sql    6 price rows (see PRICE_ROWS below for where they come from)

Why this script is in the repository rather than beside the data. The mock JSON
under `frontend/public/mock` was committed as an artefact with its generator
kept outside the repository, and the entry in the decision journal that records
what that cost says it plainly: when the shape of the data changes, and it
changes for as long as the schema is being designed, there is nothing to build
it again with, and a hand edit of forty seven thousand rows is not an edit but a
rewrite. A generated migration with no generator next to it is the same fault
one layer down, so the generator lives here.

**Do not edit the generated .sql files by hand.** Change this script and run it
again. `ReferenceDataMatchesCodebookTest` reads the same source files this
script reads and compares them against what actually loaded, so a hand edit, or
a run of this script that was forgotten, fails the build rather than shipping.

Both source files are read, never written. Nothing under `frontend/` is touched.
"""

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
COUNTRIES = REPO / 'frontend' / 'src' / 'data' / 'countries.json'
PLACES = REPO / 'frontend' / 'public' / 'mock' / 'places.json'
MIGRATIONS = REPO / 'backend' / 'src' / 'main' / 'resources' / 'db' / 'migration'

BANNER = """--
-- GENERATED FILE. Do not edit by hand.
--
-- Written by backend/tools/generate_reference_migrations.py out of
--   {source}
-- Run that script again after changing the source; a hand edit here is undone
-- by the next run, and ReferenceDataMatchesCodebookTest fails on either.
--
"""


def sql_text(value):
    """A text literal. Doubling the quote is the whole of the escaping SQL asks for."""
    return "'" + value.replace("'", "''") + "'"


def copy_field(value):
    r"""One field of a COPY line in the text format postgres reads.

    A backslash, a tab, a newline or a carriage return inside a name would end
    the field or the line, so each is written as its escape. `\N` on its own is
    how the text format spells a null, which is why the backslash has to be
    escaped first: a name containing `\N` would otherwise arrive as nothing.
    """
    if value is None:
        return r'\N'

    return (value.replace('\\', '\\\\')
                 .replace('\t', '\\t')
                 .replace('\n', '\\n')
                 .replace('\r', '\\r'))


def write(name, body):
    """Writes one migration, with LF endings whatever machine this runs on.

    `.gitattributes` normalises line endings on the way into the repository, so
    a file written with CRLF here is stored as LF anyway; writing LF means
    running this script on Windows leaves no diff of its own.
    """
    target = MIGRATIONS / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding='utf-8', newline='\n')
    print(f'{target.relative_to(REPO)}: {target.stat().st_size / 1024:.0f} KB')


# --------------------------------------------------------------------------
# Countries
# --------------------------------------------------------------------------

COUNTRY_DDL = """
/* The countries a place can be in, and the list the country field on a form is
   filled from (ADL A16).

   `id` is a bigserial and `code` is the speaking mark beside it (ADL A36, O1):
   nothing outside the portal is ever shown a row number, and everything that
   names a country from outside names it by its ISO 3166-1 alpha-2 code.

   `name` carries the ICU collation from V1, so `order by name` is the Serbian
   Latin alphabet and not whatever the database was created with (ADL A36, O21).

   `sort_order` is the order the portal lists them in and cannot be worked out
   from the other columns: the eleven of the region stand at the top in an order
   the owner set, and the rest of the world follows in alphabetical order. Two
   different orders in one list, so the order is stored. */
create table country (
    id         bigserial not null,
    code       text      not null,
    name       text      not null collate sr_latn,
    in_region  boolean   not null,
    sort_order integer   not null,

    constraint country_pk primary key (id),
    constraint country_code_unique unique (code),
    constraint country_name_unique unique (name),
    constraint country_sort_order_unique unique (sort_order),

    constraint country_code_shape check (code ~ '^[A-Z]{2}$'),

    /* Kosovo is carried as part of Serbia and the code does not appear anywhere
       (owner, 11.08.2026, ADL A16). GeoNames publishes it as XK and the
       generator that builds the town codebook rewrites it to RS on the way
       through; this says the same thing where it cannot be forgotten. */
    constraint country_code_not_kosovo check (code <> 'XK'),

    constraint country_name_not_blank check (btrim(name) <> ''),
    constraint country_sort_order_positive check (sort_order > 0)
);
"""


def countries(data):
    rows = []
    order = 0

    for in_region, listed in ((True, data['region']), (False, data['rest'])):
        for one in listed:
            order += 1
            rows.append((one['code'], one['name'], in_region, order))

    codes = [row[0] for row in rows]
    names = [row[1] for row in rows]
    assert len(set(codes)) == len(codes), 'two countries share a code'
    assert len(set(names)) == len(names), 'two countries share a name'
    assert 'XK' not in codes, 'XK is carried as RS and must not be listed (ADL A16)'

    return rows


def country_migration(rows):
    values = ',\n'.join(
        f"    ({sql_text(code)}, {sql_text(name)}, {'true' if in_region else 'false'}, {order})"
        for code, name, in_region, order in rows
    )

    return (BANNER.format(source=COUNTRIES.relative_to(REPO).as_posix())
            + COUNTRY_DDL
            + '\ninsert into country (code, name, in_region, sort_order) values\n'
            + values
            + ';\n')


# --------------------------------------------------------------------------
# Places
# --------------------------------------------------------------------------

PLACE_DDL = """
/* The town codebook: forty seven thousand towns out of the GeoNames export
   under CC BY 4.0, cut down to the size a form may send (ADL A16). The credit
   the licence asks for is on the terms of use page and stays there.

   `rank` is the codebook's own order and is not decoration. The file is ordered
   largest town first, and the field that suggests towns walks it and stops at
   the first eight matches, which is why typing "beo" ends at Beograd rather
   than at the village of Beotince. The population itself is not in the codebook
   and is not stored; the order is all that is left of it, so the order is a
   column.

   `english_name` is only there for a town that really is called something else
   in English: Beograd is Belgrade, Novi Sad is Novi Sad in both. Two hundred and
   two towns of the forty seven thousand have one.

   There is deliberately no unique key over (name, country). It would not hold:
   one thousand six hundred and fourteen name and country pairs occur more than
   once in the codebook, three towns in China are all called Zhongshan, and they
   are three towns. */
create table place (
    id           bigserial not null,
    name         text      not null collate sr_latn,
    country_id   bigint    not null,
    english_name text      collate sr_latn,
    rank         integer   not null,

    constraint place_pk primary key (id),
    constraint place_country_fk foreign key (country_id) references country (id),
    constraint place_rank_unique unique (rank),

    constraint place_rank_positive check (rank > 0),
    constraint place_name_not_blank check (btrim(name) <> ''),
    constraint place_english_name_not_blank check (english_name is null or btrim(english_name) <> ''),

    /* An English name equal to the name is not a second name, it is the same
       name written twice; the generator only records one when the two really
       differ. */
    constraint place_english_name_differs check (english_name is null or english_name <> name)
);

create index place_country_idx on place (country_id);

/* Loaded through a staging table rather than straight in, for one reason: the
   codebook names a country by its code and the table holds a country by its id.
   The foreign key on the staging table means a code the country list does not
   know fails here, loudly, at the line that carries it, instead of quietly
   dropping that town on the join below. */
create table place_import (
    name         text    not null,
    country_code text    not null references country (code),
    english_name text,
    rank         integer not null
);
"""

PLACE_TAIL = """
insert into place (name, country_id, english_name, rank)
select i.name, c.id, i.english_name, i.rank
  from place_import i
  join country c on c.code = i.country_code
 order by i.rank;

drop table place_import;
"""


def places(data):
    rows = []

    for index, place in enumerate(data, start=1):
        name = place[0]
        code = place[1]
        english = place[2] if len(place) > 2 else None
        assert name.strip() != '', f'town {index} has no name'
        assert english != name, f'town {index} repeats its name in English'
        rows.append((name, code, english, index))

    return rows


def place_migration(rows):
    lines = [BANNER.format(source=PLACES.relative_to(REPO).as_posix()), PLACE_DDL,
             '\ncopy place_import (name, country_code, english_name, rank) from stdin;']

    for name, code, english, rank in rows:
        lines.append('\t'.join((copy_field(name), copy_field(code), copy_field(english), str(rank))))

    lines.append('\\.')
    lines.append(PLACE_TAIL)

    return '\n'.join(lines)


# --------------------------------------------------------------------------
# Price list
# --------------------------------------------------------------------------

PRICE_DDL = """
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
"""

# The six rows of the price list.
#
# Their source is `frontend/src/data/pricing.ts`, which is TypeScript and not
# data: there is no `pricing.json` under `frontend/public/mock`, so unlike the
# two codebooks above this list cannot be derived from a file. It is written out
# here, with the decision each figure comes from named, and PriceListRowsTest
# holds the shape of it against ADL A36 O12 rather than against a source file.
# The day pricing moves into a file of its own, this reads it.
#
#   early / regular / late / season   PDL P8, four periods, EUR and RSD
#   junior                            PDL P8, a level and not a period
#   processing                        PDL, 03.08.2026 and 04.08.2026: 3 EUR on a
#                                     payment in euro, its own row, no dinar side
PRICE_ROWS = [
    ('early', 'period', '10-01', '10-05', 35, 4200, True),
    ('regular', 'period', '10-06', '11-30', 40, 4800, True),
    ('late', 'period', '12-01', '12-31', 50, 6000, True),
    ('season', 'period', '01-01', '09-30', 40, 4800, False),
    ('junior', 'level', None, None, 20, 2400, None),
    ('processing', 'fee', None, None, 3, None, None),
]


def price_migration():
    def literal(value):
        if value is None:
            return 'null'
        if value is True:
            return 'true'
        if value is False:
            return 'false'
        if isinstance(value, str):
            return sql_text(value)
        return str(value)

    values = ',\n'.join(
        '    (' + ', '.join(literal(field) for field in (*row, order)) + ')'
        for order, row in enumerate(PRICE_ROWS, start=1)
    )

    return (BANNER.format(source='frontend/src/data/pricing.ts (by hand, see PRICE_ROWS)')
            + PRICE_DDL
            + '\ninsert into price_row (key, kind, day_from, day_to, eur, rsd, ranking, sort_order) values\n'
            + values
            + ';\n')


def main():
    country_rows = countries(json.loads(COUNTRIES.read_text(encoding='utf-8')))
    place_rows = places(json.loads(PLACES.read_text(encoding='utf-8')))

    write('V2__country.sql', country_migration(country_rows))
    write('V3__place.sql', place_migration(place_rows))
    write('V4__price_list.sql', price_migration())

    print(f'countries: {len(country_rows)}, places: {len(place_rows)}, price rows: {len(PRICE_ROWS)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
