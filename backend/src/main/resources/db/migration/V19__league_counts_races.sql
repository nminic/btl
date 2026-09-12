/* A LEAGUE COUNTS RACES, NOT DAYS.
 *
 * V14 tied a league to EVENTS (`league_event`), because that is what was known
 * then: "svaka Liga ima svoj spisak događaja koji tokom godine ulaze u nju".
 * On 12.09.2026 the owner said it in full, and it is narrower than a day:
 *
 *   „hoću da na Moderaciji lige imam mogućnost da dodajem neograničen broj
 *   događaja i trka (selekcijom događaja, selektujem automatski i sve njegove
 *   trke, a mogu i samo da selektujem neku od trka)."
 *
 * So a day with four distances can count two of them. Choosing the event is the
 * screen's convenience - it writes every race of that day - and the fact stored
 * is always the race.
 *
 * WHAT THIS MIGRATION DOES NOT DO. `league_event` stays for now and is dropped
 * by the migration that moves `LeagueApi` onto the new table. A migration is
 * immutable once merged (A2), so the two halves are two migrations rather than
 * one that cannot be split later. Nothing writes `league_race` yet; the schema
 * comes first so the screens and the API can be built against it.
 *
 * THE SEASON IS IN THE KEY, AND THAT IS THE POINT OF THE SHAPE. The owner:
 * a league of 2027 takes only events of 2027. A CHECK cannot say that - it
 * would have to read two other tables - so the season is carried in
 * `league_race` and both foreign keys are composite: `(league_id, season)`
 * against the league and `(race_id, season)` against the race. A row that
 * names a league of one year and a race of another satisfies neither, and
 * PostgreSQL refuses it without anybody remembering to check. This is the same
 * trick V7 already uses for `(race_id, race_date)` on a result, and it is why
 * `race` gets a generated season here: the year of a race is the year of its
 * day and is not a second fact to keep.
 *
 * ONE RACE MAY BE IN SEVERAL LEAGUES of the same season (owner, 12.09.2026),
 * so the key is over the pair and not over the race alone.
 *
 * AND `league.admin_id` GOES. It pointed at the competitor who administered a
 * league, for the role „Organizator lige". That role is not in the schema
 * (owner, 08.09.2026: „Šema nosi tačno četiri uloge, ne sedam") and leagues do
 * not have administrators at all (owner, 12.09.2026: „NE POSTOJI ADMINISTRATOR
 * PROPRATNE LIGE"). A league is edited by the superadmin or by a moderator with
 * the right over leagues ticked, which is an account's right and not a column
 * here. A foreign key with nothing behind it is an invitation to build the role
 * again, so it is dropped rather than left unused.
 */

/* The year a race is run, off the day it is run on. Generated, so it cannot
   disagree with the day and cannot be written by hand. */
alter table race
    add column season integer generated always as (extract(year from date)::integer) stored;

/* Not uniqueness, but the target the composite key below needs: the same reason
   `race_day_unique` exists in V7 over `(id, date)`. */
alter table race
    add constraint race_season_unique unique (id, season);

alter table league
    add constraint league_season_unique unique (id, season);

create table league_race (
    league_id bigint  not null,
    season    integer not null,
    race_id   bigint  not null,

    constraint league_race_pk primary key (league_id, race_id),

    /* Both halves of "a league of 2027 counts a race of 2027", and neither is a
       rule anybody has to remember. */
    constraint league_race_league_fk foreign key (league_id, season)
        references league (id, season) on delete cascade,
    constraint league_race_race_fk foreign key (race_id, season)
        references race (id, season) on delete cascade
);

/* Asked from the race's side by the standings: which leagues does this race
   count towards. The primary key already serves the league's side. */
create index league_race_race_idx on league_race (race_id);

comment on table league_race is 'Which races count towards which league. The season is in both foreign keys, so a league of one year cannot count a race of another.';

alter table league
    drop column admin_id;
