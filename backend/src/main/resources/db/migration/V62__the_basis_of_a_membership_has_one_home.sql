/* THE BASIS OF A MEMBERSHIP HAS ONE HOME, AND IT IS THE ROW OF A SEASON.
 *
 * The owner, 18.10.2026 (PDL P8, "Osnov clanstva ima jedan dom, zapis po sezoni; stara kolona po
 * coveku se brise"): he was freed of the fee for 2027 in `membership`, and "Moja clanarina" asked
 * him to pay while the moderation of the members called him "Uplata", because both read the
 * per-person column `competitor.membership_basis` (V7). The fact had two homes since V22, and V22's
 * own header said how the second one goes: "the day it goes it goes with them in one change". This
 * is that change. Every reader moves to `membership` for the season on sale in the same pull
 * request, and no writer writes the column any more, so nothing reads or writes it when it goes.
 *
 * WHAT GOES, NAMED RATHER THAN LEFT TO `cascade`: the column, and with it the one constraint that
 * stands on it alone, `competitor_membership_basis_known` (V7). PostgreSQL drops a check that names
 * only the dropped column together with it. Nothing else depends on the column: no view, no
 * trigger, no function and no index names it. The drop is written WITHOUT `cascade` on purpose, so
 * that a view or a rule nobody counted stops this migration instead of going with it quietly; the
 * body of a function is text PostgreSQL does not track, so `TheBasisHasOneHomeTest` asks the
 * catalogue that no function or view still names the column.
 *
 * WHAT IS NOT CARRIED, AND WHY NOTHING IS LOST. The column held one word per person and no season,
 * and the decision of 13.09.2026 is that a basis is a fact about a season ("Oslobodjenje se odobrava
 * za svaku sezonu posebno, nikad zauvek"). A per-person word cannot say which season it was true
 * of, so there is no row it could honestly become; the rows of `membership` are already the record
 * of every season anybody holds, and this migration does not touch one of them. What a real
 * database holds was measured before this was written: the one member freed of the fee carried
 * `payment` in the column and `2027 | feeExempt` in the table, and the table is the one the owner
 * says is true.
 * `TheBasisHasOneHomeTest` runs this file over that shape and requires every row of `membership`
 * to come out as it went in.
 */

alter table competitor drop column membership_basis;
