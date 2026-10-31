/*
 * THE POINTS A SEASON HELD AT ITS FREEZE, KEPT, SO THE THRESHOLD OF TWELVE IS READ OFF THEM AND NOT OFF
 * WHATEVER THE SEASON HOLDS LATER.
 *
 * PDL, owner, 30.10.2026, „Prag od 12 bodova koji zatvara početničku broji bodove sezone u trenutku
 * njenog zamrzavanja", on the example of a member with 10 points in 2027 to whom a moderator adds a
 * forgotten race of 3 points on 15.2.2028: „Jos ostrije od preporuke. Ana ni 2029 u ovom slucaju nece
 * biti u starosnoj ako 2028 ne bude imala 12 ili vise bodova. Dakle mora u trenutku zamrzavanja sezone
 * da ima 12 bodova da bi presla u starosnu trajno (odnosno izgubila izbor da bude Pocetnik)."
 *
 * WHY A SNAPSHOT AND NOT A MOMENT ON EACH RESULT. After a season freezes its rows of `result` still
 * move: the league enters, changes and deletes a result of any past year (PDL, 21.10.2026), an approval
 * after 16:00 writes or amends one, a member deletes his own run, and deleting a race or an event takes
 * its results with it. A moment of entry on the row answers the first of those and none of the others,
 * so a deletion after the freeze would open the category again and a correction upward would close it.
 * PDL, 31.07.2026, „Zamrznuta sezona je materijalizovan zapis, ne izračun": what the season held at
 * 16:00 is written down once and read from then on.
 *
 * TWO TABLES, BECAUSE „NO ROW" MUST MEAN „NO POINTS AT THE FREEZE". `season_frozen` says that a season
 * was frozen and when the job did it; `season_points_at_freeze` holds one row per member who had points
 * in it. A member with no row in a season that has a row in `season_frozen` had no points in it at the
 * freeze, whatever was entered for him afterwards. A season with no row in `season_frozen` has not been
 * snapshotted yet and is read live, as every season was before this migration.
 *
 * THE MEMBER WITHOUT THE RIGHT TO RANK IS HERE TOO. PDL, 30.10.2026, „Sprovođenje „bez prava
 * rangiranja", odgovori pre izrade": „Njegovi bodovi se računaju u prag od 12 bodova koji zatvara
 * početničku kategoriju (izabrao uz moju preporuku)." So this is not `season_competitor` (V17), which
 * holds the ranked table only.
 *
 * NOTHING STANDS IN EITHER TABLE ON THE DAY THIS RUNS. The first season the league has (2027) freezes on
 * 1.1.2028 at 16:00, so no row already in the database is touched and no constraint here meets a row
 * it did not see written.
 */
create table season_frozen (
    season    integer     not null,

    /* When the job wrote the snapshot, which is the moment the snapshot is of: a write between 16:00
       and this instant is in it (the boundary `ASeasonFreezes` carries). */
    frozen_at timestamptz not null,

    constraint season_frozen_pk primary key (season),

    constraint season_frozen_season_not_before_the_league check (season >= 2027)
);

create table season_points_at_freeze (
    season        integer       not null,
    competitor_id bigint        not null,

    /* The sum of his results of that season at the freeze, the width `season_competitor.points` has. */
    points        numeric(10,2) not null,

    constraint season_points_at_freeze_pk primary key (season, competitor_id),

    /* Only a season that was frozen holds points at its freeze. */
    constraint season_points_at_freeze_season_fk foreign key (season) references season_frozen (season)
        on delete restrict,

    /* It goes with him: a deleted member has no category to work out (V79 keeps only the rows of
       money). */
    constraint season_points_at_freeze_competitor_fk foreign key (competitor_id) references competitor (id)
        on delete cascade,

    constraint season_points_at_freeze_points_not_negative check (points >= 0)
);

/* A member's own seasons are asked by member, and the key leads with the season. */
create index season_points_at_freeze_competitor_idx on season_points_at_freeze (competitor_id);
