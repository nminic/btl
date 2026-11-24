/*
 * A LEAGUE MAY HIGHLIGHT ITS EVENTS IN THE CALENDAR, AND THE HIGHLIGHT IS A FACT ABOUT THE LEAGUE.
 *
 * Owner, PDL 24.11.2026, „Liga ima kućicu „Istakni događaje”": „Želim još jednu stvar... da imam na nivou lige
 * checkbox u podešavanjima kao Admin Istakni događaje. Ukoliko je to štiklirano, svi događaji te lige automatski
 * dobijaju istaknutost u kalendaru. Ako ih izbacim iz lige, istaknutost se gubi.”
 *
 * The plan he approved the same day: „istaknutost se računa pri čitanju kalendara iz ručnog izbora ili iz lige,
 * bez prepisivanja na događaj; nova kolona na ligi, podrazumevano isključena". So this column is the whole of what
 * is kept. Nothing is written onto `btl_event.featured`, which stays the event's own choice („Ručno „Istaknuto: Da”
 * na događaju je zaseban izbor i ostaje kad se događaj izbaci iz lige"), and `CalendarApi` works the highlight out
 * on every read from the two. A race taken out of the league, or the league deleted with its `league_race` rows,
 * is the end of the highlight with nothing to undo.
 *
 * NOT NULL WITH A DEFAULT OF FALSE, and the default is the owner's „podrazumevano isključena" rather than a
 * convenience: a league is a yes or a no about this, never an unknown, and every insert that does not name the
 * column (`LeagueWriteApi.add` given no answer, every fixture written before this file) makes a league that does
 * not highlight.
 *
 * THE LEAGUES ALREADY THERE (CLAUDE.md, section 11). `add column ... not null default false` fills every row
 * standing with false in the same statement, so no row can break the rule and none of them starts highlighting
 * anything; measured over rows written as a database holds them before V109 by LeagueHighlightCarriedOverTest.
 */
alter table league
    add column highlights_events boolean not null default false;
