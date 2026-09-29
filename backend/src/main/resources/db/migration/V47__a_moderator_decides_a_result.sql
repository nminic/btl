/* THE HALF OF V25'S DEBT THAT COMES DUE THE DAY AN APPROVAL FIRST WRITES A RESULT.
 *
 * This migration is not chosen, it is CALLED FOR BY NAME, twice, in two migrations that are
 * already applied and therefore immutable. Both sentences are quoted rather than summarised,
 * because the whole reason they were written into a migration header was so that whoever
 * arrived here would not have to be told.
 *
 * V25, which widened `race.distance_km` on the owner's decision of 19.09.2026:
 *
 *     It will not stay unreachable, and the increment that first WRITES a result has to
 *     close it in the same commit as the route, both halves:
 *       - widen both columns to numeric(8,4) the way this widens `race`, or a result of a
 *         42.195 km race is stored as 42.20 and its own generated `category` says
 *         `marathon` while its race says `long` - two rows about one run, disagreeing,
 *         silently;
 *       - and teach `com.btl.portal.domain.ranking.Totals` ...
 *
 * V32, which widened `result_submission.distance_km` and left the other column alone:
 *
 *     THE BOUNDARY, WRITTEN HERE RATHER THAN LEFT TO BE FOUND: `result.distance_km` is
 *     still numeric(6,2), so the increment that teaches a moderator to APPROVE a result
 *     carries both halves of V25's debt - the widening AND `Totals` - and until then an
 *     approval would round the length it copies.
 *
 * `VerificationWriteApi` learns to carry out the `results` tab in the same commit as this
 * file, so this is that increment and this is that commit.
 *
 *
 * WHY IT IS NOW REACHABLE AND WAS NOT WHEN V25 WAS WRITTEN, measured and not assumed
 * ----------------------------------------------------------------------------------
 * V25 could say „the disagreement this would create is unreachable today" because nothing
 * inserted into either table. That has changed twice since, and both ends of the road now
 * exist:
 *
 *   - `race.distance_km` is numeric(8,4) since V25, so a race measured at 42.195 is a row
 *     the calendar can hold today;
 *   - `ResultWriteApi` copies `race.distance_km` straight into `result_submission` - the
 *     member never types a length for a race in the calendar (PDL, owner, 03.08.2026:
 *     „Duzina, uspon i spust se ne unose, nego se uzimaju sa izabrane trke") - and V32
 *     widened that column to match, so the submission carries 42.1950 exactly.
 *
 * The only narrowing left on that road is the last step, and it is the one this file
 * removes: an approval copying the submission into `result` would put 42.1950 into a
 * numeric(6,2) column, PostgreSQL would round it to 42.20 without a word, and the stored
 * generated `category` computed from it would say `marathon` while the race the run was run
 * at says `long`. Nobody would ever be told; nothing would be violated.
 *
 *
 * WHY THE GENERATED COLUMN COMES OFF AND GOES BACK, which is V25's measurement and not a
 * preference
 * ---------------------------------------------------------------------------------------
 * `alter table result alter column distance_km type numeric(8,4)` on its own is REFUSED by
 * PostgreSQL 18, exactly as it was refused for `race`:
 *
 *     ERROR:  cannot alter type of a column used by a generated column
 *     DETAIL:  Column "distance_km" is used by generated column "category".
 *
 * So the column is dropped and put back with V7's expression word for word. Putting it back
 * is also what RECOMPUTES it: a stored generated column is written at insert and update, so
 * widening the column underneath it would otherwise leave every existing row carrying the
 * category its OLD value produced. There are no such rows today - `result` is empty on every
 * database this has run against, because nothing has ever inserted into it - but a migration
 * that is only correct over an empty table is a migration that is correct by accident.
 *
 * WHAT WAS MEASURED TO SURVIVE THIS, against the real schema and not read off the file. The
 * two keys aimed at `result` name `competitor_id` and the pair `(race_id, race_date)`, and
 * the index `result_competitor_race_date_idx` names `(competitor_id, race_date)`. None of
 * the three names `distance_km`, which is why they are untouched; `KeysAndIndexesTest` is
 * what says so afterwards rather than this comment. Every CHECK on the table comes back,
 * `result_distance_positive` included, and PostgreSQL revalidates it against the widened
 * type. `CompetitorEventRaceAndResultTest` holds the foreign keys and their delete
 * behaviour, and is the floor that would notice if one of them had gone.
 *
 * THE ONE THING THAT DOES MOVE is where `category` sits in the column list: dropped and
 * re-added, it goes to the end. Every statement on this server names its columns and every
 * floor asks `information_schema` by name, so this is written down as a known effect rather
 * than guarded against - the same sentence V25 wrote for `race`.
 *
 *
 * WHAT THIS DELIBERATELY DOES NOT DO, and each is a boundary rather than an omission
 * ----------------------------------------------------------------------------------
 * NOT `result.points`. Points are numeric(8,2) and stay numeric(8,2). The owner's decision
 * of 19.09.2026 says so in as many words (PDL): „Zlatni test set bodovanja je na dve
 * decimale i ostaje netaknut, ali se bodovi od tada racunaju na precizniju" length.
 * `BtlScoreCalculator` already takes the length as a double and rounds only its ANSWER to
 * two decimals, so a more exact length reaches the formula and the golden set does not move
 * a digit. Nothing in this commit touches the calculator or its test.
 *
 * NOT a column recording who decided or when, on `result`. PDL P9 does ask for one - „Rezultat
 * nosi polje poslednja izmena (datum i ime administratora), prikazano na profilu" - but that
 * decision is about an ADMINISTRATOR EDITING somebody's result, a road that does not exist on
 * this server at all, and `verification` already records who decided and when for the road
 * that does (V9: `decided_at`, `decided_by`, `decided_by_name`). Adding a second home for it
 * here, ahead of the route that would fill it, is the shape ADL P-javno refuses.
 *
 * NOT a constraint saying an approved submission has a result. It cannot be expressed: which
 * `result` row an approval wrote is not a fact `result_submission` carries, and inventing a
 * column to carry it would be a pointer this increment has no reader for.
 *
 *
 * RENUMBERED 45 -> 47 ON 29.09.2026, AFTER THIS FILE HAD ALREADY MERGED TO MAIN. Migrations
 * are immutable once applied (ADL A2) and this is the narrow case where that does not yet
 * bite, so the condition is written down rather than left to be trusted.
 * ----------------------------------------------------------------------------------------
 * WHAT WENT WRONG: nothing in this file. It merged as 45, and then
 * V46__the_rulebook_stops_claiming_a_penalty_that_is_gone.sql merged AFTER it but reached the
 * QA database FIRST. Flyway does not allow a migration to arrive out of order by default, so
 * with 46 recorded in `flyway_schema_history` and 45 only resolved on disk, startup refused:
 *
 *     Detected resolved migration not applied to database: 45.
 *     Validate failed: Migrations have failed validation
 *
 * The backend went into a restart loop behind a static page that still answered 200. The
 * cause is the order two branches merged in, not anything either migration says.
 *
 * WHY RENUMBERING IS ALLOWED HERE AND IS NOT A REWRITE OF HISTORY: ADL A2 protects APPLIED
 * migrations, because their checksum is recorded in `flyway_schema_history` and changing them
 * stops Flyway against every database that ran the old one. This file is applied NOWHERE -
 * QA's history goes 43, 44, 46 and has no 45, and production has no backend yet. That was
 * measured against the server, not assumed. A later migration could not have repaired this
 * either: Flyway fails validation before it runs anything, so it never reaches one.
 *
 * WHY 47 AND NOT 45 AGAIN: 46 is applied, so this file has to sort ABOVE it, and the next
 * number after that is 47. It takes 47 rather than waiting because it is already on main and
 * therefore has to be applied first; the unmerged branch that had claimed 47 moves off it.
 *
 * WHAT THE RENAME ITSELF CHANGES, AND WHAT THIS COMMIT CHANGES ON TOP OF IT: the rename moves
 * no content at all - git reports it as a pure rename of 0 changed lines, and Flyway computes
 * a checksum over what a migration SAYS and not what it is called, so the rename alone would
 * have left the pinned checksum untouched. THIS PARAGRAPH IS ITSELF THE EXCEPTION: writing
 * the note down changes the bytes, so the checksum DOES move, and it is repinned in
 * {MigrationsAreImmutableTest} last, with the file final. Anyone correcting one sentence of
 * this header afterwards moves it again and the gate will say so.
 */

alter table result
    drop column category;

alter table result
    alter column distance_km type numeric(8, 4);

/* V7's expression, word for word, and the two literals are the whole of PDL P5: equal to
   42.2 is a marathon and equal to 21.1 is a half, and everything else falls into one of the
   remaining three by being above or below them. The comparison is numeric, so 42.2000 and
   42.2 are one value and a marathon stays a marathon; 42.1950 is now a different value from
   42.2000 and lands one branch lower, which is the point of the migration. */
alter table result
    add column category text generated always as (
        case
            when distance_km = 42.2 then 'marathon'
            when distance_km = 21.1 then 'half'
            when distance_km > 42.2 then 'ultra'
            when distance_km > 21.1 then 'long'
            else 'short'
        end
    ) stored;
