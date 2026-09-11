/*
 * The frozen season, which is a record and not a calculation. Step fourteen, and the last of the
 * schema.
 *
 * ADL A37, in the owner's words: "za prethodne sezone svaka tabela, rang lista, poredak budu
 * zamrznuti, odnosno da sve vrednosti budu zakucane i da se otvaraju trenutno kad se poseti link",
 * and then, the same morning, about the shape: "Zapravo ne zelim Jason, nego neke dodatne tabele u
 * bazi koje drze konstantne zakucane vrednosti."
 *
 * WHAT THAT MEANS FOR EVERY COLUMN HERE. The page of a frozen season does NO JOIN and NO SUM. It
 * reads one table by season and draws it. So every number a reader sees is a column, and so is
 * every name - a snapshot that joined `competitor` for the name would be a calculation again, and
 * would also change the moment somebody edited his profile.
 *
 * THREE TABLES AND NOT FIVE. `PDL.md:935` lists five things that freeze: Takmicari, Timovi, Rang
 * liste, osvojena priznanja i znacke. Two of those five need no table of their own, and it is worth
 * writing down why, because the absence would otherwise read as an omission:
 *
 *   - ZNACKE are already frozen. `ducat_award` (V15) is one stored row per badge won, carrying its
 *     own snapshot of the quantity, the threshold and what was reached, and it already knows which
 *     season it belongs to. Reading it by season is a plain select. A second table would be a
 *     second home for one fact, and the two would drift the first time one of them was corrected.
 *
 *   - PRIZNANJA follow from the standings below and are not decided separately: a trophy goes to
 *     the winning team, the best racing pair, the first three overall by gender and the first three
 *     in each category (P16, as amended 04.08 and 15.08.2026). All of those are the first rows of
 *     these tables. What does NOT follow is the "nagradna figura za posebna priznanja", which a
 *     person decides rather than a table - and that has no home anywhere in this schema yet. It is
 *     written down as an open question rather than guessed at here.
 */


/*
 * The member whose row it is, kept without a join, and the one thing that has to disappear when he
 * asks to be deleted.
 *
 * TWO DECISIONS PULL AGAINST EACH OTHER HERE and the trigger at the end of this file is where they
 * are reconciled. A37 says the page joins nothing, so the name is a column. PDL P23 says a member
 * may have himself deleted, and A12 says his name then has to go. A foreign key can empty the
 * POINTER - that is what ON DELETE SET NULL does - but it cannot empty a second column, so the name
 * would survive the deletion and the page would go on saying it.
 *
 * A trigger can, and it is the only thing here that cannot be forgotten. The alternative was to
 * leave it to whoever writes the deletion, and a legal obligation that depends on somebody
 * remembering is not an obligation the schema keeps.
 *
 * WHAT THE READER DRAWS, in the three states A37 names:
 *   - the member is there and active: `who` is his name and it is a link;
 *   - the member is there and deactivated: `who` is his name and it is NOT a link;
 *   - the member is gone: `who` is empty, and the reader writes <Obrisani clan> or <Obrisana
 *     clanica> out of `gender`, which is why `gender` is a column and not a join either.
 */
create table season_competitor (
    id            bigserial     not null,
    season        integer       not null,
    position      integer       not null,

    competitor_id bigint,
    who           text          collate sr_latn,
    gender        text          not null,

    /* The category he was in THAT season, frozen with everything else: a member ages into another
       one and the table of 2027 must not follow him. */
    category      text          not null,

    points        numeric(10,2) not null,
    races         integer       not null,

    constraint season_competitor_pk primary key (id),
    constraint season_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete set null,

    constraint season_competitor_season_not_before_the_league check (season >= 2027),
    constraint season_competitor_position_positive check (position > 0),
    constraint season_competitor_gender_known check (gender in ('M', 'F')),
    constraint season_competitor_who_not_blank check (who is null or btrim(who) <> ''),
    constraint season_competitor_category_not_blank check (btrim(category) <> ''),
    constraint season_competitor_points_not_negative check (points >= 0),
    constraint season_competitor_races_not_negative check (races >= 0),

    /* One row per place per gender per season: the standings are drawn by gender and nothing else
       (31.08.2026, and it is the same rule leagues follow). */
    constraint season_competitor_one_per_place unique (season, gender, position)
);

create index season_competitor_season_idx on season_competitor (season);
create index season_competitor_competitor_idx on season_competitor (competitor_id);


/*
 * The team standings, frozen the same way.
 *
 * A team has no right to be forgotten - it is not a person - so its name stays whatever happens to
 * it, and the pointer empties if it is deleted so that the row can still be read.
 */
create table season_team (
    id       bigserial     not null,
    season   integer       not null,
    position integer       not null,

    team_id  bigint,
    name     text          not null collate sr_latn,
    points   numeric(10,2) not null,
    members  integer       not null,

    constraint season_team_pk primary key (id),
    constraint season_team_fk foreign key (team_id) references team (id) on delete set null,

    constraint season_team_season_not_before_the_league check (season >= 2027),
    constraint season_team_position_positive check (position > 0),
    constraint season_team_name_not_blank check (btrim(name) <> ''),
    constraint season_team_points_not_negative check (points >= 0),
    constraint season_team_members_positive check (members > 0),

    constraint season_team_one_per_place unique (season, position)
);

create index season_team_season_idx on season_team (season);
create index season_team_team_idx on season_team (team_id);


/*
 * And one standing per league, which is the third of the five and the only one that is per
 * something else as well as per season.
 *
 * The league itself may be deleted and the standing stays, with the league's name on it, for the
 * same reason a team's does.
 */
create table season_league_standing (
    id            bigserial     not null,
    season        integer       not null,

    league_id     bigint,
    league_name   text          not null collate sr_latn,

    position      integer       not null,
    competitor_id bigint,
    who           text          collate sr_latn,
    gender        text          not null,
    points        numeric(10,2) not null,

    constraint season_league_standing_pk primary key (id),
    constraint season_league_standing_league_fk foreign key (league_id) references league (id)
        on delete set null,
    constraint season_league_standing_competitor_fk foreign key (competitor_id)
        references competitor (id) on delete set null,

    constraint season_league_standing_season_not_before_the_league check (season >= 2027),
    constraint season_league_standing_league_name_not_blank check (btrim(league_name) <> ''),
    constraint season_league_standing_position_positive check (position > 0),
    constraint season_league_standing_gender_known check (gender in ('M', 'F')),
    constraint season_league_standing_who_not_blank check (who is null or btrim(who) <> ''),
    constraint season_league_standing_points_not_negative check (points >= 0)
);

create index season_league_standing_season_idx on season_league_standing (season);
create index season_league_standing_league_idx on season_league_standing (league_id);
create index season_league_standing_competitor_idx on season_league_standing (competitor_id);


/*
 * AND THE NAME GOES WHEN THE PERSON DOES.
 *
 * This is the reconciliation described above, and it is written as BEFORE DELETE rather than AFTER
 * because it has to run while the row is still findable: by the time the foreign keys have emptied
 * the pointers there is nothing left to find the snapshot rows by.
 *
 * It empties the name rather than writing <Obrisani clan> into it. Two reasons, and both matter:
 * the replacement differs by gender and `gender` is already here, so writing it would be a second
 * copy of something derivable; and a column that is EMPTY cannot be mistaken for a name by anything
 * that reads this table without knowing the rule.
 *
 * THIS IS THE FIRST TRIGGER IN THE SCHEMA, and it is here rather than in the service for one
 * reason: everything else this schema keeps, it keeps whoever writes the statement. A name that
 * survives a deletion is not a bug somebody notices; it is a promise the portal made in its privacy
 * policy and did not keep.
 */
create function forget_the_name_of_a_deleted_member() returns trigger
    language plpgsql
as $body$
begin
    update season_competitor set who = null where competitor_id = old.id;
    update season_league_standing set who = null where competitor_id = old.id;
    return old;
end;
$body$;

create trigger competitor_deletion_forgets_the_name
    before delete on competitor
    for each row
    execute function forget_the_name_of_a_deleted_member();
