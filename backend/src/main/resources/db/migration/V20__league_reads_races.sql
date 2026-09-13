/* THE LEAGUE IS READ OFF ITS RACES, AND `league_event` GOES.
 *
 * V19 built `league_race` and said out loud what would finish the job:
 * "`league_event` stays for now and is dropped by the migration that moves
 * `LeagueApi` onto the new table". This is that migration. From here the fact
 * stored is the RACE, and the events a league shows are the different events of
 * the races it counts - which is the owner's sentence of 12.09.2026, that a day
 * with four distances may count one of them and still be on the list.
 *
 * WHAT IS CARRIED OVER. Everything `league_event` means today: every race of
 * every event that is in a league. Choosing an event was always "write every
 * race of that day" (V19), so reading the old table that way is not an
 * interpretation of it, it is the same sentence in the new shape.
 *
 * THE ROW THAT CANNOT SATISFY THE SEASON, AND WHAT IS DONE WITH IT. This is the
 * decision this migration exists to record, so it is written here rather than
 * left to be read out of the SQL.
 *
 * `league_event` carries no season at all: its only key is `league_id` against
 * `league (id)`, so a league of 2027 may today hold an event - and through it a
 * race - of 2028. `league_race` refuses exactly that, through two composite
 * foreign keys, and the season written below is the LEAGUE'S. So a race whose
 * year is not its league's cannot be written, and there are three things that
 * could be done about it:
 *
 *   - skip it, `where r.season = l.season`. One word, and the league quietly
 *     gets smaller on the day this runs, with nothing anywhere saying a race
 *     left it. REFUSED: the standings would change and no one would know why.
 *   - put it aside in a table of its own. REFUSED: a table nothing owns,
 *     nothing migrates and no screen reads is exactly what V3 dropped its
 *     staging table to avoid, and `ConventionsTest` refuses one on sight.
 *   - LET IT FAIL, which is what happens below. The select carries no filter,
 *     so PostgreSQL is handed the row and `league_race_race_fk` refuses it.
 *     Flyway runs a migration in one transaction, so nothing is half done: the
 *     insert rolls back, the drop never happens, the server does not start, and
 *     the message names the constraint and the row. A season that was written
 *     wrong is a decision somebody has to make about real data, and a migration
 *     is not the place to make it for them.
 *
 * AND THE ONE LOSS THAT IS DELIBERATE, named here because it is silent. An
 * event in a league that has NO races under it carries nothing into
 * `league_race` and so leaves the league's list. That is not a row being
 * dropped, it is the new fact having no instance: from here a league's events
 * ARE the events of its races, and an event with no race has no result, no
 * points and nothing to count. Naming it costs a sentence; finding it later
 * costs a report that a day went missing.
 *
 * `on conflict do nothing` AND WHAT IT DOES AND DOES NOT PROMISE. `league_race`
 * has shipped since V19, so a pair may in principle already be there and the
 * primary key already says that writing it twice is not a second fact. This
 * clause says that to the carry instead of letting it fail over a row that is
 * already exactly what it wants to write. It hides nothing else: a row that
 * breaks a FOREIGN KEY still stops the migration, clause or no clause, which is
 * what the season case below relies on.
 *
 * It is NOT a claim that the two sources agree. Nothing writes `league_race`
 * today, because the moderation screens are their own increment and do not
 * exist yet. The day they do, this carry would WIDEN a selection somebody had
 * narrowed: a league that moderation had set to one race of an event would come
 * out of here counting all of them, because `league_event` names the event and
 * the carry believes it. This migration runs once, before those screens ship,
 * so that state cannot occur - but the sentence belongs here rather than in a
 * report written afterwards.
 *
 * HOW THE CARRY IS MEASURED, and where the boundary really is.
 * `LeagueRacesCarriedOverTest` builds `league_event` back as a fixture, fills it
 * with rows a league really holds, and then EXECUTES THIS FILE, all inside a
 * transaction that is rolled back. Deleting the insert below, dropping the
 * `on conflict`, widening the join or filtering by season all turn it red. A
 * second measurement exists beside it and is cheaper to describe than to keep:
 * Flyway can replay every migration into a SECOND DATABASE of the same
 * container, which was tried and takes about seven seconds. A second SCHEMA is
 * what cannot be done, because V11 runs `create extension btree_gist` with no
 * `if not exists` and an extension is per database, not per schema.
 *
 * What is measured around the carry: `league_event` is no longer a table
 * (`ConventionsTest`, out of `pg_tables`), its two deletion rules are gone
 * (`CompetitorEventRaceAndResultTest`, out of `pg_constraint`), its key and
 * index are gone (`KeysAndIndexesTest`), and the composite key still refuses a
 * league of one year counting a race of another (`LeagueConstraintsTest`).
 */

insert into league_race (league_id, season, race_id)
select le.league_id, l.season, r.id
from league_event le
    join league l on l.id = le.league_id
    join race r on r.event_id = le.event_id
on conflict on constraint league_race_pk do nothing;

drop table league_event;
