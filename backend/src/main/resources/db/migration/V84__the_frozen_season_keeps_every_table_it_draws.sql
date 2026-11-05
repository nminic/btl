/*
 * THE FROZEN SEASON KEEPS EVERY TABLE IT DRAWS, WRITTEN DOWN ONCE AT 16:00 ON 1 JANUARY.
 *
 * PDL, owner, 31.07.2026, „Zamrznuta sezona je materijalizovan zapis, ne izračun": „Od 1. januara u 16h
 * naredne godine, sve tabele prethodne sezone (Takmičari, Timovi, Rang liste, osvojena priznanja i
 * značke) su fiksni podaci." And the shape, PDL, „Oblik zamrzavanja (plan ZS od 09.10.2026)", point 1
 * (owner, 10.10.2026, written down 05.11.2026): „Snimak dopunjuje tri tabele iz V17 i dodaje po jednu
 * tabelu za sve rang liste i jednu za priznanja, uz sastav tima, mrežu lige i zapis o činu (oko šest
 * tabela)."
 *
 * WHAT IS HERE, against that sentence:
 *   - the three tables of V17 are filled out with what their screens draw and order by: the
 *     kilometres, the vertical and the time of a standing, and a member's place inside his category;
 *   - `season_board` is the table for ALL the top lists (the five by length, progress, kilometres,
 *     time on the course, and the best single races);
 *   - `season_award` is the table for the awards (PDL, owner, 05.11.2026, „Strana „Priznanja i
 *     nagrade" za zamrznutu sezonu crta lične, timske i pehare para");
 *   - `season_team_member` is the roster of a team, `season_league_column` and `season_league_cell`
 *     are the grid of a league;
 *   - and the record of the act is `season_frozen` (V83), which every row here is written under.
 *
 * ONE SHAPE CHOICE THAT IS MINE AND NOT THE OWNER'S, said here so a reviewer can refuse it: the board
 * of pairs is `season_pair` with its two halves in `season_pair_half`, and not rows of `season_board`.
 * A place on that board is two people, and a table whose rows each hold one member cannot carry it
 * without either a second member column or two rows for one place. The second pointer is the one
 * shape the job that deletes a member after five years cannot be written against (ADL, 05.11.2026,
 * „Posao od 1. januara: tri toka i jedan redosled": it empties THE pointer to a member in every table
 * the catalogue names), and two rows for one place would write the pair's totals twice.
 *
 * WHAT EVERY ROW OF A MEMBER CARRIES, and it is V17's rule kept in each new table rather than
 * reinvented: the pointer may be empty (`on delete set null`, and the job of five years empties it on
 * purpose before it deletes), the name is a column of its own and may be empty (the member asked to be
 * deleted), and the gender is a column because the word that stands for a deleted name is chosen by
 * it. No member number is kept: the one state that draws a number, „Neaktivan član" (PDL, 03.10.2026),
 * belongs to a member who still exists, so it is read off his row through the pointer; and the policy
 * says that after five years „u istorijskim tabelama ostaje samo ime i prezime" (V41), so a number kept
 * here would be the one thing that outlived what it promises.
 *
 * NOTHING STANDS IN ANY OF THESE TABLES TODAY, AND THE MIGRATION SAYS SO OUT LOUD RATHER THAN RELYING
 * ON IT. Nothing has ever written V17's three tables (V17 itself: „the service that freezes a season
 * has not been written"), and the first season the league has freezes on 1.1.2028. So the columns
 * below are added NOT NULL without a default, which no row can survive, and the block that follows
 * refuses by name the day that is not true, rather than letting PostgreSQL refuse with a sentence about
 * a column nobody would connect with this.
 */
do $$
begin
    if exists (select 1 from season_competitor) or exists (select 1 from season_team)
            or exists (select 1 from season_league_standing) then
        raise exception 'V84 found rows in the frozen tables of V17, which nothing was meant to have written: '
                'the columns this migration adds have no value for them';
    end if;
end
$$;


/*
 * THE STANDINGS: what the table of a season orders by after the points (PDL P12: kilometres, more
 * races, the vertical), the time it draws, and the place inside the category, which is a standing of
 * its own (PDL P16: „prva tri mesta u svakoj kategoriji").
 */
alter table season_competitor
    add column kilometers        numeric(12,4) not null,
    add column ascent            integer       not null,
    add column descent           integer       not null,
    add column seconds           integer       not null,
    add column category_position integer       not null,

    add constraint season_competitor_totals_not_negative
        check (kilometers >= 0 and ascent >= 0 and descent >= 0 and seconds >= 0),
    add constraint season_competitor_category_position_positive check (category_position > 0),

    /* One member per place inside one category of one season, the key V17 has for the gender. */
    add constraint season_competitor_one_per_place_in_category
        unique (season, gender, category, category_position);


/* The team standings order by points, more races, kilometres and the time on the course (PDL P12,
   owner 11.08.2026), and the team's page draws the vertical beside them. */
alter table season_team
    add column races      integer       not null,
    add column kilometers numeric(12,4) not null,
    add column ascent     integer       not null,
    add column descent    integer       not null,
    add column seconds    integer       not null,

    add constraint season_team_totals_not_negative
        check (races >= 0 and kilometers >= 0 and ascent >= 0 and descent >= 0 and seconds >= 0);


/*
 * THE ROSTER OF A TEAM IN ITS FROZEN SEASON, with each member's place on the team's page.
 *
 * Only the members who stand in the season (PDL, owner, 30.10.2026, „Na strani tima plasman sezone nose
 * samo članovi tima sa članarinom za tu sezonu i sa pravom rangiranja u njoj"); `season_team.members`
 * counts the others too, because the team counts them. Hung off the team's frozen row and not off
 * `team`, because a team deleted later still has its roster here.
 */
create table season_team_member (
    id             bigserial     not null,
    season_team_id bigint        not null,
    position       integer       not null,

    competitor_id  bigint,
    who            text          collate sr_latn,
    gender         text          not null,

    points         numeric(10,2) not null,
    races          integer       not null,
    kilometers     numeric(12,4) not null,
    ascent         integer       not null,
    descent        integer       not null,
    seconds        integer       not null,

    constraint season_team_member_pk primary key (id),
    constraint season_team_member_team_fk foreign key (season_team_id) references season_team (id)
        on delete cascade,
    constraint season_team_member_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete set null,

    constraint season_team_member_position_positive check (position > 0),
    constraint season_team_member_gender_known check (gender in ('M', 'F')),
    constraint season_team_member_who_not_blank check (who is null or btrim(who) <> ''),
    constraint season_team_member_totals_not_negative
        check (points >= 0 and races >= 0 and kilometers >= 0 and ascent >= 0 and descent >= 0
               and seconds >= 0),

    constraint season_team_member_one_per_place unique (season_team_id, position),
    constraint season_team_member_one_place_each unique (season_team_id, competitor_id)
);

create index season_team_member_competitor_idx on season_team_member (competitor_id);


/*
 * EVERY TOP LIST OF A FROZEN SEASON, ONE TABLE FOR ALL OF THEM.
 *
 * A row is one place on one list. `length` names which of the five lists by length (PDL P5's five) and
 * nothing else has one; `previous_points` is the season before on the list of progress and nothing
 * else has one; `race_name` is the race of a row on the list of best single races, whose totals are
 * then that one race's. The whole of each list is kept and not its first ten: how many places a list
 * draws is the page's, and a frozen list cut at ten would keep that number as well.
 */
create table season_board (
    id              bigserial     not null,
    season          integer       not null,
    board           text          not null,
    length          text,
    position        integer       not null,

    competitor_id   bigint,
    who             text          collate sr_latn,
    gender          text          not null,

    points          numeric(10,2) not null,
    races           integer       not null,
    kilometers      numeric(12,4) not null,
    ascent          integer       not null,
    descent         integer       not null,
    seconds         integer       not null,

    previous_points numeric(10,2),

    race_id         bigint,
    race_name       text          collate sr_latn,

    constraint season_board_pk primary key (id),
    constraint season_board_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete set null,
    constraint season_board_race_fk foreign key (race_id) references race (id) on delete set null,

    constraint season_board_season_not_before_the_league check (season >= 2027),
    constraint season_board_known
        check (board in ('byLength', 'progress', 'kilometers', 'timeOnCourse', 'bestRace')),
    constraint season_board_length_only_by_length check ((board = 'byLength') = (length is not null)),
    constraint season_board_length_known
        check (length is null or length in ('short', 'half', 'long', 'marathon', 'ultra')),
    constraint season_board_previous_only_on_progress
        check ((board = 'progress') = (previous_points is not null)),
    constraint season_board_race_only_on_best_race check ((board = 'bestRace') = (race_name is not null)),
    constraint season_board_race_id_only_on_best_race check (race_id is null or board = 'bestRace'),
    constraint season_board_race_name_not_blank check (race_name is null or btrim(race_name) <> ''),
    constraint season_board_position_positive check (position > 0),
    constraint season_board_gender_known check (gender in ('M', 'F')),
    constraint season_board_who_not_blank check (who is null or btrim(who) <> ''),
    constraint season_board_totals_not_negative
        check (points >= 0 and races >= 0 and kilometers >= 0 and ascent >= 0 and descent >= 0
               and seconds >= 0 and (previous_points is null or previous_points >= 0)),

    /* One row per place per list. NULLS NOT DISTINCT because `length` is empty on every list but five,
       and is never emptied later: it is not a pointer. */
    constraint season_board_one_per_place unique nulls not distinct (season, board, length, position)
);

/* AND ONE PLACE PER MEMBER ON A LIST, the other axis V17 keeps for its tables. Not on the list of best
   races, where a member may hold several places, one for each race. The length through `coalesce`,
   because on four lists it is empty and two empty lengths are one list; the pointer plain, because it
   empties when a member goes, for the reason V17 gives for `season_league_standing`. */
create unique index season_board_one_place_each
    on season_board (season, board, coalesce(length, ''), competitor_id)
    where board <> 'bestRace';

create index season_board_season_idx on season_board (season);
create index season_board_competitor_idx on season_board (competitor_id);
create index season_board_race_idx on season_board (race_id);


/*
 * THE BOARD OF PAIRS, and the pair standing a pair's award is read off. A pair stays in the table of the
 * season it ran (PDL: „par ostaje u tabli sezone koju je odtrčao"), which the live `/api/pairs` does
 * not keep: it answers only pairs whose two halves are both active, of every season.
 */
create table season_pair (
    id         bigserial     not null,
    season     integer       not null,
    position   integer       not null,
    pair_id    bigint,

    points     numeric(10,2) not null,
    races      integer       not null,
    kilometers numeric(12,4) not null,
    ascent     integer       not null,
    descent    integer       not null,
    seconds    integer       not null,

    constraint season_pair_pk primary key (id),
    constraint season_pair_fk foreign key (pair_id) references racing_pair (id) on delete set null,

    constraint season_pair_season_not_before_the_league check (season >= 2027),
    constraint season_pair_position_positive check (position > 0),
    constraint season_pair_totals_not_negative
        check (points >= 0 and races >= 0 and kilometers >= 0 and ascent >= 0 and descent >= 0
               and seconds >= 0),

    constraint season_pair_one_per_place unique (season, position),
    constraint season_pair_one_place_each unique (season, pair_id)
);

create index season_pair_season_idx on season_pair (season);

/* The two halves, the larger half first (owner, 04.08.2026), each with his own pointer and name. */
create table season_pair_half (
    id             bigserial not null,
    season_pair_id bigint    not null,
    half           integer   not null,

    competitor_id  bigint,
    who            text      collate sr_latn,
    gender         text      not null,

    constraint season_pair_half_pk primary key (id),
    constraint season_pair_half_pair_fk foreign key (season_pair_id) references season_pair (id)
        on delete cascade,
    constraint season_pair_half_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete set null,

    constraint season_pair_half_one_or_two check (half in (1, 2)),
    constraint season_pair_half_gender_known check (gender in ('M', 'F')),
    constraint season_pair_half_who_not_blank check (who is null or btrim(who) <> ''),

    constraint season_pair_half_once unique (season_pair_id, half),
    constraint season_pair_half_one_place_each unique (season_pair_id, competitor_id)
);

create index season_pair_half_competitor_idx on season_pair_half (competitor_id);


/*
 * THE GRID OF A FROZEN LEAGUE: its columns as they stood at the freeze, and what each member held in
 * each. PDL, „Oblik zamrzavanja", point 4: „spisak trka prati živi spisak, a mreža tabele ostaje ista".
 * The heading is the event's day and name as they were (PDL, 31.07.2026, „Iz istog razloga i kalendar
 * sme da se menja unazad"); the event itself stays a pointer, so its link works as any other does
 * (ADL A37, „Veze ka događajima u kalendaru se ne diraju").
 */
create table season_league_column (
    id          bigserial not null,
    season      integer   not null,
    league_id   bigint,
    position    integer   not null,

    event_id    bigint,
    date        date      not null,
    name        text      not null collate sr_latn,

    constraint season_league_column_pk primary key (id),
    constraint season_league_column_league_fk foreign key (league_id) references league (id)
        on delete set null,
    constraint season_league_column_event_fk foreign key (event_id) references btl_event (id)
        on delete set null,

    constraint season_league_column_season_not_before_the_league check (season >= 2027),
    constraint season_league_column_position_positive check (position > 0),
    constraint season_league_column_name_not_blank check (btrim(name) <> ''),

    constraint season_league_column_one_per_place unique (season, league_id, position),
    constraint season_league_column_once unique (season, league_id, event_id)
);

create index season_league_column_league_idx on season_league_column (league_id);
create index season_league_column_event_idx on season_league_column (event_id);

create table season_league_cell (
    season_league_standing_id bigint        not null,
    season_league_column_id   bigint        not null,
    points                    numeric(10,2) not null,

    constraint season_league_cell_pk primary key (season_league_standing_id, season_league_column_id),
    constraint season_league_cell_standing_fk foreign key (season_league_standing_id)
        references season_league_standing (id) on delete cascade,
    constraint season_league_cell_column_fk foreign key (season_league_column_id)
        references season_league_column (id) on delete cascade,

    constraint season_league_cell_points_not_negative check (points >= 0)
);

create index season_league_cell_column_idx on season_league_cell (season_league_column_id);


/*
 * THE AWARDS OF A FROZEN SEASON, one row per member who holds one.
 *
 * PDL, owner, 05.11.2026: „Lični pehari (prva tri generalno i prva tri u kategoriji), plus timski pehar
 * svakom članu koji je tom timu nosio bodove te sezone, i pehar para obema polovinama." So a team's
 * trophy is as many rows as the members who brought it points, and a pair's is two; `points` is what the
 * standing that gave it held (his own, the team's, the pair's), and `team_name` is the team's as it
 * stood, kept for the reason V17 keeps `season_team.name`.
 */
create table season_award (
    id            bigserial     not null,
    season        integer       not null,
    kind          text          not null,
    category      text,
    position      integer       not null,

    competitor_id bigint,
    who           text          collate sr_latn,
    gender        text          not null,

    points        numeric(10,2) not null,
    team_name     text          collate sr_latn,

    constraint season_award_pk primary key (id),
    constraint season_award_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete set null,

    constraint season_award_season_not_before_the_league check (season >= 2027),
    constraint season_award_kind_known check (kind in ('overall', 'category', 'team', 'pair')),
    constraint season_award_category_only_in_a_category check ((kind = 'category') = (category is not null)),
    constraint season_award_category_not_blank check (category is null or btrim(category) <> ''),
    constraint season_award_team_name_only_on_a_team check ((kind = 'team') = (team_name is not null)),
    constraint season_award_team_name_not_blank check (team_name is null or btrim(team_name) <> ''),
    /* Three places on a standing of people (P16), and one team and one pair (owner, 11.08.2026,
       „timski (1), trkački par (1)"). */
    constraint season_award_position_rewarded
        check (position between 1 and 3 and (kind in ('overall', 'category') or position = 1)),
    constraint season_award_gender_known check (gender in ('M', 'F')),
    constraint season_award_who_not_blank check (who is null or btrim(who) <> ''),
    constraint season_award_points_not_negative check (points >= 0)
);

/* One award of one kind per member per season (and per category, where it is one). Plain over the
   pointer, for V17's reason: it empties only when a member goes, after this was written. */
create unique index season_award_one_each on season_award (season, kind, coalesce(category, ''), competitor_id);

create index season_award_season_idx on season_award (season);
create index season_award_competitor_idx on season_award (competitor_id);


/*
 * AND THE NAME GOES WHEN THE PERSON ASKS TO GO, in every table this migration adds.
 *
 * A trigger of its own and not a new body for V17's `forget_the_name_of_a_deleted_member`, which V33
 * and V79 have each replaced whole: another branch replacing that function after this one would drop
 * these statements without a word, and the other way round. Two functions, each the only writer of its
 * own statements.
 *
 * The job that deletes a member after five years empties the pointer first and keeps the name (ADL,
 * 05.11.2026); this then finds no row of his, which is what that decision means it to do.
 */
create function forget_the_name_in_the_frozen_tables() returns trigger
    language plpgsql
as $body$
begin
    update season_team_member set who = null where competitor_id = old.id;
    update season_board set who = null where competitor_id = old.id;
    update season_pair_half set who = null where competitor_id = old.id;
    update season_award set who = null where competitor_id = old.id;
    return old;
end;
$body$;

create trigger competitor_deletion_forgets_the_name_in_the_frozen_tables
    before delete on competitor
    for each row
    execute function forget_the_name_in_the_frozen_tables();
