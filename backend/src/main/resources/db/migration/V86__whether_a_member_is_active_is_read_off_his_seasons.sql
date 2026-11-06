/* WHETHER A MEMBER IS ACTIVE HAS NO COLUMN: IT IS READ OFF HIS SEASONS.
 *
 * The owner, PDL "Clanstvo je cinjenica po sezoni" (IZVEDENO 13.09.2026): "Zastavica "aktivan" prestaje
 * da bude podatak i postaje izvedena: aktivan je onaj ko ima zapis za tekucu sezonu, a u prelaznom roku i
 * onaj ko ga ima za narednu." `competitor.active` (V7) is one boolean with no season in it, and V22 said in
 * its own header that it answers only "now". AF-1 (PR 678) moved every reader to the rows of `membership`
 * (`AMemberIsActive`, `SeasonClock.seasonsAMemberIsActiveIn`); since then eight statements went on
 * WRITING the flag and nothing read it. This change stops the writers and takes the column away in one
 * pull request, so that nothing reads or writes it when it goes. It is the shape of V62, which took the
 * per-person basis away the same way.
 *
 * WHAT GOES: the column, and nothing else. No view, no function, no trigger, no index and no constraint
 * stands on it (V7 names it in the column list only). The drop is written WITHOUT `cascade` on purpose,
 * so that a view or a rule nobody counted stops this migration instead of going with it quietly; the body
 * of a function is text PostgreSQL does not track, so `NothingInTheSchemaReadsTheFlagTest` asks the
 * catalogue that none names the column.
 *
 * WHAT IS NOT CARRIED, AND WHY NOTHING IS LOST. The flag held a "now" and no season; the rows of
 * `membership` are already the record of every season anybody holds and this migration does not touch
 * one of them, nor any other column of `competitor`. `TheFlagHasNoColumnTest` runs this file over rows
 * written as V7 wrote them and requires every membership and every other column to come out as it went in.
 *
 * BEFORE THIS GOES TO PRODUCTION a snapshot of the database is taken, because a dropped column cannot be
 * brought back by the migration that took it; the flag of a member whose fee lapsed at New Year said the
 * opposite of the rows, which is the reason it goes and not a reason to keep it.
 */

alter table competitor drop column active;
