# -*- coding: utf-8 -*-
"""Writes the reference-data migrations from the codebooks the portal already ships.

Two things this script does, and they are not the same thing:

    python backend/tools/generate_reference_migrations.py
        Writes the migration that first creates a codebook table and fills it.
        Runs only for a migration `main` does not carry yet.

    python backend/tools/generate_reference_migrations.py --delta
        Writes the NEXT migration, carrying only what changed in the codebook
        since `main`. This is how a codebook is maintained after its migration
        has been merged, and it is the only way. A row that has LEFT a codebook
        is the one change it will not write: V7 points at both codebooks ON
        DELETE RESTRICT and only the database knows which rows are worn, so that
        one is refused by name. See no_codebook_row_leaves.

`--delta` also takes `--before <dir>`, `--after <dir>` and `--stdout`, and those
three exist for one caller: `DeltaMigrationAppliesTest` hands it two codebooks
with one thing changed between them and applies the migration it gets back to a
real PostgreSQL. A generated migration nothing ever runs is a guess about the
order its statements have to be in, and that guess was wrong until 09.09.2026.

It writes, under `backend/src/main/resources/db/migration`:

    V2__country.sql     246 countries, out of frontend/src/data/countries.json
    V3__place.sql    47,016 towns,     out of frontend/public/mock/places.json
    V4__price_list.sql    7 price rows (see PRICE_ROWS below for where they come from)


WHY A MIGRATION IS NEVER REWRITTEN, measured rather than asserted
----------------------------------------------------------------
ADL A2: a migration is immutable once it is committed. That is not a style rule.
Flyway records a checksum of every migration it applies, so a database that has
already run V2 refuses to start against a changed V2:

    Validate failed: Migrations have failed validation

Measured on 08.09.2026: a one-character fix in `countries.json` followed by a
plain re-run of this script leaves `./mvnw --batch-mode verify` at BUILD SUCCESS,
locally and on CI, because Testcontainers starts every run from an empty
database. The same two commits stop the backend from starting on QA, where V2
has been applied since the day it merged. A green build is therefore no evidence
at all about the one place it matters, which is exactly why the refusal below is
in the tool and not in a sentence somebody has to remember.

So this script asks git, not the person running it. A migration `main` already
carries is never rewritten, with no flag to say otherwise: `main` is the branch
QA follows (ADL A4a), so a file on it has been applied somewhere and a file that
is not on it has been applied nowhere. A migration written on a branch and not
yet merged is rewritten freely, and the script says out loud that it did.

`MigrationsAreImmutableTest` holds the same line from the other side: it pins the
checksum Flyway itself computed for every applied migration, so a rewrite by any
hand, this script or an editor, fails the build.


WHY THIS SCRIPT IS IN THE REPOSITORY at all
-------------------------------------------
The mock JSON under `frontend/public/mock` was committed as an artefact with its
generator kept outside the repository, and the entry in the decision journal that
records what that cost says it plainly: when the shape of the data changes, and
it changes for as long as the schema is being designed, there is nothing to build
it again with, and a hand edit of forty seven thousand rows is not an edit but a
rewrite. A generated migration with no generator next to it is the same fault one
layer down, so the generator lives here.

`ReferenceDataMatchesCodebookTest` reads the same source files this script reads
and compares them against what actually loaded, so a codebook changed without a
delta migration fails the build, and the failure names the command above.

Both source files are read, never written. Nothing under `frontend/` is touched.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

# Everything this script says, it says in UTF-8, named rather than left to the
# machine. The refusals below name a country, and a country is named in Serbian:
# `Kongo - Kinšasa` written to a redirected stderr on Windows goes out in cp1252,
# because that is what Python takes the preferred encoding to be, and whoever
# reads it back as UTF-8 gets `MalformedInput`. Measured on 09.09.2026, by
# DeltaMigrationAppliesTest, on the refusal that says two countries may not
# exchange names. The same reasoning is written out again over `--stdout`, which
# writes bytes for the same reason and cannot use this.
sys.stderr.reconfigure(encoding='utf-8')

REPO = Path(__file__).resolve().parents[2]
COUNTRIES = REPO / 'frontend' / 'src' / 'data' / 'countries.json'
PLACES = REPO / 'frontend' / 'public' / 'mock' / 'places.json'
MIGRATIONS = REPO / 'backend' / 'src' / 'main' / 'resources' / 'db' / 'migration'

BANNER = """--
-- GENERATED FILE, and immutable from the day it merges (ADL A2).
--
-- Written by backend/tools/generate_reference_migrations.py out of
--   {source}
--
-- Do not edit this file and do not regenerate it over itself. A database that
-- has applied it remembers its checksum, so a changed byte here stops the
-- backend from starting: "Validate failed: Migrations have failed validation".
-- The build would not see it, because the tests start from an empty database.
--
-- To change a codebook: change the source above and write the difference as the
-- next migration,
--
--   python backend/tools/generate_reference_migrations.py --delta
--
-- which is what the script does anyway once this file is on main; before that it
-- rewrites this one and says so. MigrationsAreImmutableTest fails on a rewrite
-- whatever hand made it.
--
"""


# --------------------------------------------------------------------------
# What git already knows
# --------------------------------------------------------------------------

def git(*arguments):
    """Runs git inside this repository. The output, or None if git said no.

    None and empty string are different answers and both matter: `cat-file -e`
    succeeds with no output at all, which is how it says the file is there.
    """
    finished = subprocess.run(('git', '-C', str(REPO)) + arguments,
                              capture_output=True, text=True, encoding='utf-8')

    return finished.stdout if finished.returncode == 0 else None


def released_branch():
    """The name of the branch QA is served from, as this clone can see it.

    `origin/main` first, because that is the branch the server pulls and the one
    a stale local `main` would lie about; the local name is the fallback for a
    clone with no remote. None when neither resolves, and then nothing is
    written: a tool that cannot tell what has been released must not guess that
    nothing has.
    """
    for name in ('origin/main', 'main'):
        if git('rev-parse', '--verify', '--quiet', name + '^{commit}') is not None:
            return name

    return None


def relative(path):
    return path.relative_to(REPO).as_posix()


def carried_by(revision, path):
    """Does that revision hold this file."""
    return git('cat-file', '-e', f'{revision}:{relative(path)}') is not None


def read_at(revision, path):
    """The file as it stood at that revision, parsed as JSON."""
    text = git('show', f'{revision}:{relative(path)}')

    if text is None:
        raise SystemExit(f'{relative(path)} is not in {revision}, so there is nothing to compare against')

    return json.loads(text)


def codebooks(revision=None, directory=None):
    """Both codebooks together, out of a directory, out of git, or off the disk.

    One reader for the two sides of a delta, so that neither side can be read a
    way the other cannot. A directory holds them under the names they have in
    the repository, which is what lets a test hand the generator a codebook with
    one thing changed in it and get the migration that change would produce,
    without writing anything under `frontend/`.
    """
    if directory is not None:
        return (json.loads((directory / COUNTRIES.name).read_text(encoding='utf-8')),
                json.loads((directory / PLACES.name).read_text(encoding='utf-8')))

    if revision is not None:
        return read_at(revision, COUNTRIES), read_at(revision, PLACES)

    return (json.loads(COUNTRIES.read_text(encoding='utf-8')),
            json.loads(PLACES.read_text(encoding='utf-8')))


def say(message):
    """Progress, on the error stream.

    Not on the output stream, because --stdout puts the migration there and a
    caller reading it must get SQL and nothing else.
    """
    print(message, file=sys.stderr)


def next_version():
    """One past the highest V number on disk.

    Read from the directory rather than remembered, so the number cannot fall
    behind a migration somebody else added in the same branch.
    """
    numbers = [int(match.group(1))
               for match in (re.match(r'V(\d+)__', found.name) for found in MIGRATIONS.glob('V*.sql'))
               if match]

    return max(numbers, default=0) + 1


# --------------------------------------------------------------------------
# Writing
# --------------------------------------------------------------------------

def sql_text(value):
    """A text literal. Doubling the quote is the whole of the escaping SQL asks for."""
    if value is None:
        return 'null'

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


def write(name, body, released):
    """Writes one migration, unless it is one that has already been released.

    LF endings whatever machine this runs on. `.gitattributes` normalises line
    endings on the way into the repository, so a file written with CRLF here is
    stored as LF anyway; writing LF means running this script on Windows leaves
    no diff of its own.
    """
    target = MIGRATIONS / name

    if released is None:
        raise SystemExit('neither origin/main nor main resolves in this clone, so nothing can be said about '
                         'which migrations have been released; refusing to write anything')

    if carried_by(released, target):
        raise SystemExit(f'{relative(target)} is on {released} and has been applied to every database that '
                         f'follows it, so rewriting it would stop Flyway from starting (ADL A2). Write the '
                         f'difference as the next migration instead:\n'
                         f'    python {relative(Path(__file__).resolve())} --delta')

    if target.exists():
        print(f'{relative(target)}: rewriting, {released} does not carry it yet')

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding='utf-8', newline='\n')
    print(f'{relative(target)}: {target.stat().st_size / 1024:.0f} KB')


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

    /* Deferrable, and initially immediate, because this one carries an order and
       an order is maintained by moving a range of it. A country inserted into
       the eleven of the region moves every country below it, which the next
       delta migration writes as one UPDATE, and a plain UNIQUE checks its index
       row by row inside a statement and refuses the first move. Deferrable means
       checked when the statement ends; initially immediate means that is still
       the statement it is written in, and not the commit two hundred statements
       later. Said in full in V3, over `place.rank`, where it was measured. */
    constraint country_sort_order_unique unique (sort_order) deferrable initially immediate,

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


def country_values(row):
    code, name, in_region, order = row

    return f"({sql_text(code)}, {sql_text(name)}, {'true' if in_region else 'false'}, {order})"


def country_migration(rows):
    values = ',\n'.join('    ' + country_values(row) for row in rows)

    return (BANNER.format(source=relative(COUNTRIES))
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
   twenty three towns of the forty seven thousand have one.

   There is deliberately no unique key over (name, country). It would not hold:
   one thousand six hundred and sixteen name and country pairs occur more than
   once in the codebook, three towns in China are all called Zhongshan, and they
   are three towns.

   WHAT `geonames_id` IS, AND WHY A TOWN HAS ONE
   ---------------------------------------------
   `id` is a bigserial and `geonames_id` is the speaking mark beside it (ADL A36
   O1), which is the same shape `country.code` has one table over. It is the
   number GeoNames gives the town in the export this codebook is cut from, and it
   is the town's identity (owner, 08.09.2026, ADL A16).

   Until 08.09.2026 there was nothing beside the bigserial, and this comment said
   so and drew a boundary from it. The codebook shipped each town as
   ["name", "COUNTRY"], and the pair is no identity either, for the reason a
   paragraph up. So a delta migration had to line the two states of the codebook
   up by `rank`, which is a position in a file and not a fact about a town:
   measured on 09.09.2026, taking one town out of the top produced 46,877 changed
   rows, and the row that held Shanghai ended up holding Chongqing under the same
   `id`. Nothing could point at a town, and ADL A36 O5, which gives an event a
   foreign key to a place, could not be built at all.

   With the mark, a delta lines the two states up by the mark and `rank` is an
   ordinary column it updates. A town that is renamed, moved in the order, or
   given a different country is the same row throughout, and its `id` is the same
   number afterwards. DeltaMigrationAppliesTest measures exactly that, by
   renaming a town and moving it in the same delta.

   THE KEY OVER THE MARK IS PLAIN AND NEVER DEFERRABLE. That is the decision the
   comment over `place_rank_unique` below took in advance and it is why: a mark
   exists to be pointed at, and no foreign key may name a deferrable unique
   constraint. PlaceIdentityTest holds both halves. */
create table place (
    id           bigserial not null,
    geonames_id  bigint    not null,
    name         text      not null collate sr_latn,
    country_id   bigint    not null,
    english_name text      collate sr_latn,
    rank         integer   not null,

    constraint place_pk primary key (id),
    constraint place_country_fk foreign key (country_id) references country (id),

    /* Plain, for the reason written above, and it is the one key in this table
       anything outside it may name. */
    constraint place_geonames_id_unique unique (geonames_id),

    /* Unique, and deferrable, and initially immediate. All three of those are
       decisions and the middle one was measured on 08.09.2026 rather than
       reasoned about.

       Unique, because `rank` is the only thing left of the population and two
       towns holding one position is an order that answers differently depending
       on which row the reader met first.

       Deferrable, because an order is maintained by moving a range of it, and a
       plain UNIQUE makes that impossible rather than merely awkward. Inserting a
       town at position 46,900 is

           update place set rank = rank + 1 where rank >= 46900;

       and under a plain UNIQUE that is `ERROR: duplicate key value violates
       unique constraint "place_rank_unique", Key (rank)=(46901)`: PostgreSQL
       checks a non-deferrable unique index as each row is written, so the first
       row to move lands on a neighbour that has not moved yet. There is no order
       of rows that avoids it and no way to ask for it to be put off, because a
       constraint that was not declared DEFERRABLE cannot be deferred. Declared
       deferrable, the same statement goes through, because the check happens
       when the statement ends and by then the ranks are unique again.

       Initially immediate, so that everything else is exactly as strict as it
       was: a second town claiming rank 1 is still rejected by the INSERT that
       writes it, not at some COMMIT far away with no statement to blame. A
       maintenance transaction that needs a whole sequence of statements to be
       taken together can still say `set constraints place_rank_unique deferred`,
       which is the point of DEFERRABLE, and the check then fires at COMMIT.

       What this costs, measured and named rather than discovered later. There
       are two prices, not one, and the second is the larger of them:

       1. An `insert ... on conflict (rank)` no longer compiles against this
          table, `ON CONFLICT does not support deferrable unique constraints/
          exclusion constraints as arbiters`. Nothing does that today and a delta
          migration has no business doing it either, because it must say which
          rows it means.

       2. No foreign key may point at a deferrable unique key at all: `create
          table t (r integer references place (rank))` is `ERROR: cannot use a
          deferrable unique constraint for referenced table "place"`, refused
          when the referring table is created rather than when a row is written.
          So a column declared deferrable is a column nothing can ever refer to.

       Which decided a question this table did not have when that was written and
       has now: `place_geonames_id_unique`, three lines up, IS PLAIN. The mark
       exists to be referred to, that is the whole of what ADL A36 O5 wants it
       for, and price 2 says a deferrable key cannot be. The rule the schema
       follows is the same one said from the other side: a key over an order is
       deferrable because a range of it moves; a key that is looked up stays
       plain. The three that are looked up, `country_code_unique`,
       `place_geonames_id_unique` and `price_row_key_unique`, stay plain and stay
       available as arbiters, and KeysAndIndexesTest measures both prices against
       every deferrable key in the schema. */
    constraint place_rank_unique unique (rank) deferrable initially immediate,

    /* A GeoNames identifier is a positive integer, and the same kind of
       statement `country_code_shape` makes about a country code: this column
       carries a mark from somebody else's catalogue, so what a mark may look
       like is written down where a row that is not one cannot get in. */
    constraint place_geonames_id_positive check (geonames_id > 0),

    constraint place_rank_positive check (rank > 0),
    constraint place_name_not_blank check (btrim(name) <> ''),
    constraint place_english_name_not_blank check (english_name is null or btrim(english_name) <> ''),

    /* An English name equal to the name is not a second name, it is the same
       name written twice; the generator only records one when the two really
       differ. */
    constraint place_english_name_differs check (english_name is null or english_name <> name)
);

/* Every town of one country, which is the one question this table is asked that
   the primary key cannot answer: the country field on a form narrows the town
   field. Forty seven thousand rows is far past the size at which the planner
   would rather read the whole table, and it does read the whole table without
   this line. KeysAndIndexesTest holds the plan, not the line. */
create index place_country_idx on place (country_id);

/* Loaded through a staging table rather than straight in, for one reason: the
   codebook names a country by its code and the table holds a country by its id.
   The foreign key on the staging table means a code the country list does not
   know fails here, loudly, at the line that carries it, instead of quietly
   dropping that town on the join below. */
create table place_import (
    geonames_id  bigint  not null,
    name         text    not null,
    country_code text    not null references country (code),
    english_name text,
    rank         integer not null
);
"""

PLACE_TAIL = """
insert into place (geonames_id, name, country_id, english_name, rank)
select i.geonames_id, i.name, c.id, i.english_name, i.rank
  from place_import i
  join country c on c.code = i.country_code
 order by i.rank;

drop table place_import;
"""


def places(data):
    """The codebook as rows: (mark, name, country code, English name, rank).

    The mark comes first because it is the town's identity and the rank is a
    position in the file (ADL A16). Both are read here rather than one of them
    being counted to somewhere else.
    """
    rows = []

    for index, place in enumerate(data, start=1):
        mark = place[0]
        name = place[1]
        code = place[2]
        english = place[3] if len(place) > 3 else None
        assert isinstance(mark, int) and mark > 0, f'town {index} has no GeoNames mark'
        assert name.strip() != '', f'town {index} has no name'
        assert english != name, f'town {index} repeats its name in English'
        rows.append((mark, name, code, english, index))

    marks = [row[0] for row in rows]
    assert len(set(marks)) == len(marks), 'two towns share a GeoNames mark, which is the one thing it may not do'

    return rows


def place_migration(rows):
    lines = [BANNER.format(source=relative(PLACES)), PLACE_DDL,
             '\ncopy place_import (geonames_id, name, country_code, english_name, rank) from stdin;']

    for mark, name, code, english, rank in rows:
        lines.append('\t'.join((str(mark), copy_field(name), copy_field(code), copy_field(english), str(rank))))

    lines.append('\\.')
    lines.append(PLACE_TAIL)

    return '\n'.join(lines)


# --------------------------------------------------------------------------
# Price list
# --------------------------------------------------------------------------

PRICE_DDL = """
/* The price list as one table with a kind of row on it (ADL A36, O12): four
   periods, one level, one fee, one referral. Seven rows, and the kind is what
   tells them apart rather than four tables answering one question.

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
   seven rows by PriceListRowsTest instead, which is the stronger statement of
   the two. */
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

    /* Deferrable for the reason `place.rank` is: this column is an order, and an
       order is maintained by moving a range of it. Initially immediate, so the
       ordinary insert is checked exactly where it is written. */
    constraint price_row_sort_order_unique unique (sort_order) deferrable initially immediate,

    constraint price_row_kind_known check (kind in ('period', 'level', 'fee', 'referral')),
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
       (Clan 11), the fee buys nothing in the rulebook at all, and the referral
       is credited rather than sold, so all three leave the column empty rather
       than saying Da or Ne. */
    constraint price_row_only_period_is_ranked check ((ranking is not null) = (kind = 'period'))
);
"""

# The seven rows of the price list.
#
# Their source is `frontend/src/data/pricing.ts`, which is TypeScript and not
# data: there is no `pricing.json` under `frontend/public/mock`, so unlike the
# two codebooks above this list cannot be derived from a file. It is written out
# here, with the decision each figure comes from named, and PriceListRowsTest
# holds the shape of it against ADL A36 O12 rather than against a source file.
# The day pricing moves into a file of its own, this reads it.
#
# For the same reason `--delta` does not cover this table: a delta is a
# difference against the source as git holds it, and running an older copy of
# this script to find out what it used to say is not a comparison, it is
# executing history. Seven rows changed by hand are a hand written migration.
#
#   early / regular / late / season   PDL P8, four periods, EUR and RSD
#   junior                            PDL P8, a level and not a period
#   processing                        PDL, 03.08.2026 and 04.08.2026: 3 EUR on a
#                                     payment in euro, its own row, no dinar side
#   referral                          PDL P16, owner 12.08.2026 and 11.08.2026:
#                                     5 EUR / 600 RSD credited for a member
#                                     brought in, a row of the price list and not
#                                     a number on a screen, with no period of its
#                                     own and no bearing on the right to rank.
#                                     `REFERRAL` in frontend/src/data/pricing.ts.
PRICE_ROWS = [
    ('early', 'period', '10-01', '10-05', 35, 4200, True),
    ('regular', 'period', '10-06', '11-30', 40, 4800, True),
    ('late', 'period', '12-01', '12-31', 50, 6000, True),
    ('season', 'period', '01-01', '09-30', 40, 4800, False),
    ('junior', 'level', None, None, 20, 2400, None),
    ('processing', 'fee', None, None, 3, None, None),
    ('referral', 'referral', None, None, 5, 600, None),
]


def price_migration():
    def literal(value):
        if value is True:
            return 'true'
        if value is False:
            return 'false'
        if isinstance(value, str):
            return sql_text(value)
        if value is None:
            return 'null'
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


# --------------------------------------------------------------------------
# The difference between two states of a codebook
# --------------------------------------------------------------------------

DELTA_HEAD = """
/* What changed in the two codebooks between {since} and this working tree.

   Written by --delta rather than by rewriting the migration that first loaded
   them, because that one has been applied and its checksum is remembered
   (ADL A2). Data only: a column that has to appear or a constraint that has to
   change is a migration somebody writes by hand, and this script does not
   pretend otherwise.

   `set constraints all deferred` is the first statement and it is the whole
   reason the three order keys were declared DEFERRABLE. V3 says so over
   `place.rank`: an order is maintained by moving a range of it, and a
   maintenance transaction that needs a sequence of statements taken together
   asks for the check once, at the end, when the order is final. Nothing else is
   loosened. `country_code_unique`, `country_name_unique`,
   `place_geonames_id_unique` and `price_row_key_unique` were never declared
   deferrable, so SET CONSTRAINTS does not touch them and they are still checked
   as each row is written. The mark is on that list on purpose and V3 says why:
   a key that is looked up and referred to cannot be deferrable at all, because
   no foreign key may point at one.

   NOR DOES IT TOUCH WHAT POINTS AT THE CODEBOOKS, and until 09.09.2026 that
   sentence was missing from here while four such keys stood in V7.
   `competitor_place_fk`, `competitor_country_fk`, `btl_event_place_fk`,
   `btl_event_country_fk`, `result_submission_place_fk`,
   `result_submission_country_fk`, `team_place_fk`, `team_country_fk`,
   `team_proposal_place_fk` and
   `team_proposal_country_fk` are ON DELETE RESTRICT, so a member, an event, a
   team, a run still waiting to be judged or a team somebody has only proposed
   holds the town and the country it names, and RESTRICT is checked where it is
   written, which is the half of the pair no deferral reaches at all.

   They arrived in threes rather than all at once, and that is the whole reason
   this sentence is read by a test rather than trusted: four in V7, two more with
   V10 on 11.09.2026, four more with V11 the same day. Each time, a delta that
   dropped one town would have stopped halfway through on a live database naming
   a key this header had never heard of.

   SO A DELTA NEVER TAKES A ROW OUT OF A CODEBOOK. It adds rows and it changes
   them, and that is the whole of it. Which towns and which countries are worn is
   something only the database knows, this script reads two files, and a DELETE
   written blind comes back as `update or delete on table "place" violates
   foreign key constraint "competitor_place_fk" on table "competitor"` in the
   middle of a migration on a live database. So a codebook that drops a row is
   refused before a file is written, with the town or the country named, and that
   one is a migration written by hand: where the member goes instead has an
   answer only a person has, and the shape of it is fixed: in one statement
   `place_id` is emptied, and `city` and `country_id` are filled. A country that
   leaves has no typed-text answer at all, because whoever stands on it has the
   name typed already.
   ADL A40 is where that migration is written down, and
   it is three things rather than one: that answer; the renumbering of the order
   column of every row below the one that leaves, `place.rank` for a town and
   `country.sort_order` for a country, since ReferenceDataMatchesCodebookTest
   reads the expected value as the position of the row in its file; and the count
   written by hand into that same test. The refusal names all three, because a
   sentence that says only "written by hand" leaves the second one to be found by
   a red build. Note what this makes of a country changing its
   `code`: the code is the identity, so that is one country leaving and another
   arriving, and it is refused with the rest.

   What is left of the order is `place_country_fk`, which is not deferrable and
   cannot be, and it alone decides the three lines below. Each is a case that was
   run against a real database, and DeltaMigrationAppliesTest runs this migration
   against one rather than reading it:

     - countries arrive first, because a town may be moving to a country that is
       arriving in this same migration;
     - towns change and arrive next;
     - and the countries that stayed are updated last, which is also where the
       order columns settle before the COMMIT that checks them.

   There were six statements here until 09.09.2026 and the two DELETEs decided
   most of the order. `country_deletes` stood second, ahead of `place_updates`,
   and a town was then lined up by its position in the file rather than by
   anything about the town: removing a country with its only town wrote the
   DELETE against the LAST rank in the file and left the row that actually named
   that country to be rewritten three statements later. Both that and a country
   changing its code came back `update or delete on table "country" violates
   foreign key constraint "place_country_fk" on table "place"`. The sentence that
   used to stand here, that this was the only order that runs and was found by
   running it, was true of the inputs it had been run on and of no others, which
   is what a generator with no test over its output is worth. Both DELETEs are
   gone now, for the reason in the paragraph above and not because that order was
   ever made to work.

   HOW THE TWO STATES ARE LINED UP. A country by its `code` and a town by its
   `geonames_id`, and both of those are the row's identity rather than its
   position (ADL A16). So a town that is renamed, moved in the order or given a
   different country is one UPDATE of one row and keeps its `place.id`, and
   `rank` is an ordinary column this migration writes. Until 08.09.2026 a town
   had no mark and was lined up by `rank` instead, and then taking one town out
   of the top of the codebook rewrote the contents of every row below it.

   What this does not cover, said here rather than left to be found. It is one
   thing in two shapes: a country taking a name that is still worn at the moment
   the statement runs. `country_name_unique` is plain, so it was never declared
   deferrable, SET CONSTRAINTS cannot put it off, and PostgreSQL checks it as
   each row is written, inside the statement.

     - A country ARRIVING with a name the codebook has not released yet. Its
       INSERT is the first statement, and moving it later is no answer, because a
       town may be moving to that country.
     - Two countries EXCHANGING names, which is what somebody writes the day they
       work out which Congo is which. `country_updates` is a single UPDATE over a
       VALUES list, so the first of the two rows to be written lands on a name the
       second has not given up yet, `duplicate key value violates unique
       constraint "country_name_unique"`, and the order rows are written inside a
       statement is not something to lean on even where a chain would come out
       right one way round.

   The script refuses both, names the countries, and those are migrations written
   by hand. A country that LEAVES frees its name and is not one of those two
   shapes, and that is still asked before the refusal above it: a delta in which
   CD leaves and CG takes the name it gives up is turned away for the removal,
   naming CD, rather than for an exchange that is not happening. Getting that
   wrong would send whoever writes the migration by hand looking for a name
   clash that will not be there once CD is gone. */
"""


def difference(before, after, key):
    """Three lists: rows that moved, rows that arrived, keys that left.

    `key` picks the field the two sides are lined up by, and it is the field that
    is the row's identity: the country code, and the town's GeoNames mark.
    Everything else about a row, its name, its country and its place in the
    order, is a change to that row rather than a different row.
    """
    was = {key(row): row for row in before}
    now = {key(row): row for row in after}

    changed = [row for name, row in now.items() if name in was and was[name] != row]
    added = [row for name, row in now.items() if name not in was]
    removed = [name for name in was if name not in now]

    return changed, added, sorted(removed)


def values_list(rows, render):
    return ',\n'.join('           ' + render(row) for row in rows)


def country_updates(changed):
    return ('update country as c\n'
            '   set name = v.name::text,\n'
            '       in_region = v.in_region::boolean,\n'
            '       sort_order = v.sort_order::integer\n'
            '  from (values\n'
            + values_list(changed, country_values)
            + '\n       ) as v (code, name, in_region, sort_order)\n'
            ' where c.code = v.code::text;\n') if changed else None


def country_inserts(added):
    return ('insert into country (code, name, in_region, sort_order) values\n'
            + values_list(added, country_values) + ';\n') if added else None


PLACE_COLUMNS = '\n       ) as v (geonames_id, rank, name, country_code, english_name)\n'


def place_values(row):
    mark, name, code, english, rank = row

    return f'({mark}, {rank}, {sql_text(name)}, {sql_text(code)}, {sql_text(english)})'


def place_updates(changed):
    """Everything about a town except which town it is.

    `rank` is written here like any other column, because a town is found by its
    mark: moving a town in the order is that town's row changing, and the order
    key is deferred by the first statement of the migration so a whole range of
    it may move in this one UPDATE.
    """
    return ('update place as p\n'
            '   set name = v.name::text,\n'
            '       country_id = c.id,\n'
            '       english_name = v.english_name::text,\n'
            '       rank = v.rank::integer\n'
            '  from (values\n'
            + values_list(changed, place_values)
            + PLACE_COLUMNS
            + '  join country c on c.code = v.country_code::text\n'
            ' where p.geonames_id = v.geonames_id::bigint;\n') if changed else None


def place_inserts(added):
    return ('insert into place (geonames_id, name, country_id, english_name, rank)\n'
            'select v.geonames_id::bigint, v.name::text, c.id, v.english_name::text, v.rank::integer\n'
            '  from (values\n'
            + values_list(added, place_values)
            + PLACE_COLUMNS
            + '  join country c on c.code = v.country_code::text;\n') if added else None


def every_town_names_a_country(country_rows, place_rows):
    """No town may name a country the list does not carry.

    V3 says this with a foreign key on the staging table it loads through, so the
    first load has always said it. A delta has no staging table, and the sentence
    it would otherwise be told in is `violates foreign key constraint
    "place_country_fk"` in the middle of a migration on a live database. Said
    here it is a codebook that has not been finished, and it is said before a
    file is written.
    """
    listed = {code for code, _, _, _ in country_rows}
    orphans = sorted({code for _, _, code, _, _ in place_rows if code not in listed})

    if orphans:
        raise SystemExit('the town codebook names countries the country list does not carry: '
                         + ', '.join(orphans)
                         + '\nremove those towns as well, or put the countries back')


def no_country_takes_a_name_still_worn(before, added, changed, removed):
    """No country may take a name that is still worn when its statement runs.

    `country_name_unique` is plain: it was never declared deferrable, so SET
    CONSTRAINTS cannot put it off and PostgreSQL checks it as each row is
    written, inside the statement. That makes two shapes of delta unwritable, and
    the second of them is the one this refused to see until 09.09.2026:

    1. A country ARRIVING with a name another country has not given up.
       `country_inserts` is the first statement, so every country of `before` is
       still there. Moving the insert later is no answer, because a town moving to
       that country has to find it there.

    2. Two countries EXCHANGING names, which is the ordinary shape of somebody
       working out which Congo is which. `country_updates` is a single UPDATE over
       a VALUES list, and a plain unique index is checked per row inside a
       statement, so whichever of the two rows is written first lands on a name
       the other has not released. Measured: swapping the names of CG and CD in
       `countries.json` left this script at exit code 0 and produced a migration
       that fails with `duplicate key value violates unique constraint
       "country_name_unique"`, while the DELTA_HEAD text it wrote into that same
       file said the script refuses to write such a delta.

    Not refused here: a name freed by a country that LEAVES. That is
    `code not in leaving` below, and it is what tells CG taking the name CD gives
    up apart from the two shapes above.

    Since 09.09.2026 no country may leave at all - no_codebook_row_leaves is the
    next question asked and it turns that delta away - so this condition no
    longer decides whether a file is written. It decides WHICH refusal the person
    reading gets, and that is the whole of its job: without it, a delta in which
    CD leaves and CG takes its name is turned away for an exchange that is not
    happening, and whoever writes that migration by hand goes looking for a name
    clash that disappears with CD. The order of the two questions is therefore
    load bearing and is measured that way: "a country changes its code and keeps
    its name" is refused HERE, for the name, while "a country leaves and another
    takes the name it gives up" gets past this and is refused below, for the
    removal.

    Said here, before a file is written, rather than as a migration that stops
    halfway through on a live database.
    """
    worn = {name for _, name, _, _ in before}
    arriving = sorted({name for _, name, _, _ in added if name in worn})

    if arriving:
        raise SystemExit('a country arrives carrying a name another country has not given up yet: '
                         + ', '.join(arriving)
                         + '\nthe first statement of a delta is the insert, and country_name_unique is plain, '
                           'so this one is a migration written by hand')

    # And who wears what by the time `country_updates` runs: the ones that left
    # are gone by then, the ones that arrived are in.
    leaving = set(removed)
    wearer = {name: code for code, name, _, _ in before if code not in leaving}
    wearer.update({name: code for code, name, _, _ in added})

    exchanging = sorted({name for code, name, _, _ in changed
                         if wearer.get(name, code) != code})

    if exchanging:
        raise SystemExit('a country takes a name another country gives up in the very same statement: '
                         + ', '.join(exchanging)
                         + '\ncountry_updates is one UPDATE and country_name_unique is plain, so it is checked '
                           'row by row inside it; this one is a migration written by hand')


def no_codebook_row_leaves(country_before, country_removed, place_before, place_removed):
    """A delta adds rows to a codebook and changes them. It never takes one out.

    V7 points at both codebooks ON DELETE RESTRICT, four times over:
    `competitor_place_fk` and `competitor_country_fk` from the member,
    `btl_event_place_fk` and `btl_event_country_fk` from the event. So a town or
    a country that leaves is a DELETE the database refuses the moment one member
    or one event names it, and which rows those are is something only that
    database knows. This script is handed two files.

    A DELETE written blind is therefore a migration that stops halfway through on
    a live database with `update or delete on table "place" violates foreign key
    constraint "competitor_place_fk" on table "competitor"`, and the same shape
    from the country side. Refused here instead, with the town or the country
    named, exactly as no_country_takes_a_name_still_worn refuses the two shapes
    it cannot write.

    Written by hand rather than made cleverer, because the missing half is not
    SQL. Where the member goes when his town leaves the codebook - another town,
    or the same name typed as text with its country beside it - is a question
    with an answer only a person has, and ADL A36 O5 is why it cannot be answered
    by clearing the key: a town that is not the codebook's stays as TEXT, and a
    foreign key action writes one column and not the other.

    WHICH IS NOT THE WHOLE OF THAT MIGRATION, and until 09.09.2026 this said
    "written by hand" and stopped there, naming the door and nothing behind it.
    ADL A40 is where it is written down and it is three things:

      1. the question above, answered out loud rather than by default, and the
         two codebooks answer it differently. A town goes onto another row or
         into typed text, and typed text is `city` AND `country_id` with
         `place_id` empty: three columns, because
         `competitor_typed_town_names_its_country` makes the typed name and the
         country conditions of each other. A country has no typed-text answer at
         all, since whoever stands on it already has the name typed, so only
         another country lets the row go. This point read "`city` with
         `place_id` empty" until a round on 09.09.2026 ran it against the schema
         and it broke the check - and the paragraph two above this one, written
         a day earlier, had said "with its country beside it" all along;
      2. RENUMBERING the order column of every row below the one that leaves,
         `place.rank` for a town and `country.sort_order` for a country, because
         ReferenceDataMatchesCodebookTest builds the expected value as the
         position of the row in its file (index + 1) and compares it with that
         column, so a DELETE on its own fails on every row under the one that
         went;
      3. moving the count written by hand into that same test.

    The refusal below says all three, and the second one loudest, because whoever
    reads it has just been stopped and the renumbering is the half that is not
    guessed. A36 O18 was narrowed the same day: a generated migration is how a
    codebook gains a row and how a row changes, and a row leaving is this.

    A country changing its `code` is caught here as well and that is worth saying
    out loud. The code is what the two states of the list are lined up by, so
    changing it is one country leaving and another arriving, and the leaving half
    is a row members and events are standing on.
    """
    country_names = {code: name for code, name, _, _ in country_before}
    place_names = {mark: name for mark, name, _, _, _ in place_before}

    leaving = ([f'{country_names[code]} ({code})' for code in country_removed]
               + [f'{place_names[mark]} ({mark})' for mark in place_removed])

    if leaving:
        raise SystemExit('the codebook drops a row a member or an event may be standing on: '
                         + ', '.join(leaving)
                         + '\ncompetitor and btl_event point at both codebooks ON DELETE RESTRICT (V7) and this '
                           'script reads two files, so it cannot see which rows are worn; this one is a '
                           'migration written by hand, and ADL A40 is where what it has to do is written down.'
                           '\n\nThree things rather than one, and the second is the half nobody works out '
                           'unaided:'
                           '\n  1. decide where the members and the events standing on that row go, and the '
                           'two codebooks part company here. A TOWN leaving: onto another row of the '
                           'codebook, or into typed text, and typed text is THREE columns and not two. '
                           'In one statement: `place_id` is emptied, and `city` and `country_id` are '
                           'filled. Both halves are needed, because '
                           '`competitor_town_is_from_the_codebook_or_typed` and '
                           '`competitor_typed_town_names_its_country` make those three conditions of '
                           'each other (V7, and `btl_event` the same). A COUNTRY '
                           'leaving: typed text is not an option at all, because whoever stands on that '
                           'country already has the name typed, and only ANOTHER country lets the row '
                           'go. Neither may be chosen in silence.'
                           '\n  2. RENUMBER the order column of every row BELOW the one that leaves - '
                           '`place.rank` for a town, `country.sort_order` for a country. '
                           'ReferenceDataMatchesCodebookTest builds the expected value as the position of '
                           'the row in its file (index + 1) and compares it with that column, so a DELETE '
                           'on its own fails on every row under the one that went.'
                           '\n  3. move the count written by hand into that same test.')


def delta_migration(since, before=None, after=None):
    """The next migration, or None when the two codebooks already agree with git."""
    country_file_before, place_file_before = codebooks(revision=since, directory=before)
    country_file_now, place_file_now = codebooks(directory=after)

    country_before = countries(country_file_before)
    country_now = countries(country_file_now)
    place_before = places(place_file_before)
    place_now = places(place_file_now)

    every_town_names_a_country(country_now, place_now)

    country_changed, country_added, country_removed = difference(country_before, country_now, lambda row: row[0])
    place_changed, place_added, place_removed = difference(place_before, place_now, lambda row: row[0])

    # The name comes first on purpose: the removal below would otherwise answer
    # for a country that arrives with a name still worn, and that is a different
    # migration to write by hand. Its docstring says which case holds each half.
    no_country_takes_a_name_still_worn(country_before, country_added, country_changed, country_removed)
    no_codebook_row_leaves(country_before, country_removed, place_before, place_removed)

    say(f'countries: {len(country_changed)} changed, {len(country_added)} added')
    say(f'places: {len(place_changed)} changed, {len(place_added)} added')

    # The order is explained in DELTA_HEAD and measured by DeltaMigrationAppliesTest.
    parts = [part for part in (country_inserts(country_added),
                               place_updates(place_changed),
                               place_inserts(place_added),
                               country_updates(country_changed)) if part]

    if not parts:
        return None

    return (BANNER.format(source=f'{relative(COUNTRIES)} and {relative(PLACES)}')
            + DELTA_HEAD.format(since=before or since)
            + '\nset constraints all deferred;\n\n'
            + '\n'.join(parts))


# --------------------------------------------------------------------------

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--delta', action='store_true',
                        help='write the next migration with what changed in the codebooks, '
                             'instead of rewriting the migrations that first loaded them')
    parser.add_argument('--since', default=None,
                        help='the revision the delta is measured against; the released branch by default, '
                             'which is what every database that matters has applied')
    parser.add_argument('--before', default=None,
                        help='a directory holding countries.json and places.json to measure the delta against, '
                             'instead of git; for a test that has to hand the generator a state git does not hold')
    parser.add_argument('--after', default=None,
                        help='a directory holding the two codebooks as they should end up, instead of this '
                             'working tree')
    parser.add_argument('--stdout', action='store_true',
                        help='write the migration to standard output instead of into the migration directory')
    options = parser.parse_args(argv)

    released = released_branch()

    if options.delta:
        before = Path(options.before).resolve() if options.before else None
        after = Path(options.after).resolve() if options.after else None
        since = options.since or released

        if since is None and before is None:
            raise SystemExit('neither origin/main nor main resolves in this clone; say --since <revision>')

        body = delta_migration(since, before, after)

        if body is None:
            say(f'the codebooks already say what {before or since} says; nothing to write')
            return 0

        if options.stdout:
            # Bytes, and UTF-8 named rather than left to the machine. Town names
            # carry every accent Europe has and the default encoding of a Windows
            # console is cp1252, which stops at the first c-with-caron with
            # `UnicodeEncodeError: 'charmap' codec can't encode character`. The
            # files this reads are UTF-8 and the file it would otherwise write is
            # UTF-8, so this is the same file by another way out.
            sys.stdout.buffer.write(body.encode('utf-8'))
            return 0

        write(f'V{next_version()}__reference_data_update.sql', body, released)
        return 0

    country_file, place_file = codebooks()
    country_rows = countries(country_file)
    place_rows = places(place_file)
    every_town_names_a_country(country_rows, place_rows)

    write('V2__country.sql', country_migration(country_rows), released)
    write('V3__place.sql', place_migration(place_rows), released)
    write('V4__price_list.sql', price_migration(), released)

    print(f'countries: {len(country_rows)}, places: {len(place_rows)}, price rows: {len(PRICE_ROWS)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
