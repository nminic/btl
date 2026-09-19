/* THE LENGTH A RACE WAS MEASURED AT IS KEPT AS IT WAS TYPED, AND THE CATEGORY IS WORKED
 * OUT OF THAT AND NOT OF A ROUNDED COPY OF IT.
 *
 * PDL, owner, 19.09.2026, in his own words: „Hocu da mogu da unosim tacnu duzinu, ali se
 * prikazuje zaokruzeno na dve ili manje decimala. Dakle 42.203 treba da zaokruzi na 42.2,
 * ali da vodi kao ultramaraton."
 *
 * That one sentence separates three things this portal had held as one:
 *
 *   - WHAT IS WRITTEN is the exact measured length, and it is this migration's half;
 *   - WHAT IS SHOWN is that length rounded to at most two decimals, which is the
 *     browser's and is not here and not anywhere on this server;
 *   - WHAT IT IS CLASSIFIED BY is the written value, never the shown one.
 *
 *
 * WHAT WAS WRONG, AND IT WAS A CONTRADICTION RATHER THAN A FAULT
 * --------------------------------------------------------------
 * Two decisions of PDL P5 stood, both of them still standing today:
 *
 *   „Nema tolerancije. Svrstavanje ide po tacnoj unetoj vrednosti: maraton je trka uneta
 *   kao 42.2, polumaraton kao 21.1."
 *
 *   „Posledica koja je namerna i treba da je svi znaju: uneto 42.195 nije maraton nego
 *   „duze trke", a 21.0975 nije polumaraton nego „krace trke"."
 *
 * and `distance_km numeric(6,2)` could not obey them. PostgreSQL does not refuse 42.195,
 * it ROUNDS it to 42.20, and the generated `category` then says `marathon` - the exact
 * opposite of the sentence above, written by the schema itself, with no constraint broken
 * and nothing to say so. B74 closed that hole by making the route REFUSE a third decimal
 * (`WhatARaceCarries.distanceIsKeptExactly`), which kept the portal honest but left an
 * administrator unable to enter a length he had really measured. The owner was shown the
 * conflict by the independent review of PR 300 and settled it the other way: the value is
 * kept, not refused.
 *
 *
 * WHY FOUR DECIMALS, WHICH IS A CHOICE AND NOT A ROUND NUMBER
 * -----------------------------------------------------------
 * Four is the smallest scale in which every length the two decisions NAME is exact.
 * P5 names 21.0975 - the true half marathon, four decimals - and calls it a race that must
 * come out as „krace trke" rather than as a half. At three decimals that value cannot be
 * written down at all: it would round to 21.098 and `distanceIsKeptExactly` would refuse
 * it, which is the very thing the owner has just decided against. At four it is stored as
 * it was typed and categorised `short`, which is what P5 asks for. A fifth decimal is a
 * tenth of a metre over a course nobody measures to, and it would cost the sweep in
 * `RaceCategoryMatchesWhatThePortalServesTest` another factor of ten.
 *
 * THE DIGITS BEFORE THE POINT DO NOT MOVE. numeric(6,2) held four of them and
 * numeric(8,4) holds four of them, so the largest distance there is goes from 9999.99 to
 * 9999.9999 and nothing that fitted yesterday stops fitting. This widens and never
 * narrows, which is what lets it run over a table that already has rows in it.
 *
 *
 * WHY THE COLUMN IS DROPPED AND PUT BACK, WHICH IS MEASURED AND NOT PREFERRED
 * ---------------------------------------------------------------------------
 * `alter table race alter column distance_km type numeric(8,4)` on its own is REFUSED by
 * PostgreSQL 18:
 *
 *     ERROR:  cannot alter type of a column used by a generated column
 *     DETAIL:  Column "distance_km" is used by generated column "category".
 *
 * So the generated column comes off first and goes back afterwards, with the same
 * expression it has carried since V7, word for word. Putting it back is also what
 * RECOMPUTES it: a stored generated column is written once, at insert and update, and
 * widening the column underneath it would otherwise leave every existing row carrying the
 * category its OLD value produced.
 *
 * WHAT WAS MEASURED TO SURVIVE THIS, against postgres:18 and not read off the file.
 * `race_day_unique (id, date)` and `race_season_unique (id, season)` are both still there
 * afterwards, and so are the three foreign keys aimed at them from elsewhere -
 * `result_race_fk` and `result_submission_race_fk` over (race_id, race_date), and
 * `league_race_race_fk` over (race_id, season). None of the four keys names
 * `distance_km`, which is why they are untouched; that they are untouched is the measured
 * part. The other generated column, `season`, is computed from `date` and is not
 * disturbed either. Every CHECK on the table comes back, `race_distance_not_negative` and
 * `race_only_a_length_race_fixes_a_distance` included, and PostgreSQL revalidates both
 * against the widened type.
 *
 * THE ONE THING THAT DOES MOVE is where `category` sits in the column list: dropped and
 * re-added, it goes to the end, after `season`. Nothing reads this table by position -
 * every statement on this server names its columns and every floor asks
 * `information_schema` by name - so this is written down as a known effect rather than
 * guarded against.
 *
 *
 * WHAT THIS DELIBERATELY DOES NOT TOUCH, AND IT IS A BOUNDARY RATHER THAN AN OMISSION
 * -----------------------------------------------------------------------------------
 * `result.distance_km` and `result_submission.distance_km` are `numeric(6,2)` and STAY
 * `numeric(6,2)` here. The owner's decision names one column, `race.distance_km`, and
 * nothing on this server can yet put a distance into either of the other two: `/api/results`
 * is a GET and no route anywhere inserts into `result` or `result_submission`. So the
 * disagreement this would create is unreachable today.
 *
 * It will not stay unreachable, and the increment that first WRITES a result has to close
 * it in the same commit as the route, both halves:
 *
 *   - widen both columns to numeric(8,4) the way this widens `race`, or a result of a
 *     42.195 km race is stored as 42.20 and its own generated `category` says `marathon`
 *     while its race says `long` - two rows about one run, disagreeing, silently;
 *   - and teach `com.btl.portal.domain.ranking.Totals`, which REFUSES a third decimal by
 *     design („Two decimals, and a third one throws") and names `numeric(6,2)` as its
 *     reason. Widened underneath it, it turns a profile into a 500 instead.
 *
 * That is left here rather than done here because it is a change to scoring and to the
 * standings, and the same decision of 19.09.2026 says „Zlatni test set bodovanja je na dve
 * decimale i ostaje netaknut". */

alter table race
    drop column category;

alter table race
    alter column distance_km type numeric(8, 4);

/* V7's expression, word for word. The two literals are the whole of PDL P5: equal to
   42.2 is a marathon and equal to 21.1 is a half, and everything else falls into one of
   the remaining three by being above or below them. 42.2030 is now a different value from
   42.2000 and lands one branch higher, which is the point of the migration. */
alter table race
    add column category text generated always as (
        case
            when distance_km = 42.2 then 'marathon'
            when distance_km = 21.1 then 'half'
            when distance_km > 42.2 then 'ultra'
            when distance_km > 21.1 then 'long'
            else 'short'
        end
    ) stored;
