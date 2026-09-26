/**
 * WHAT THE ADMINISTRATION'S SCREEN OF TEAMS SENDS, AND WHAT THE ONE REFUSAL OF IT IS
 * CALLED.
 *
 * <p>Its own module rather than a constant beside the screen, which is the arrangement
 * `admin/leagueWrites.ts` and `pages/member/myAccount.ts` already have and the reason they
 * give: `react/only-export-components` asks for it, and a test reading a component file to
 * get at a table is a test that mounts React to ask a question about a list.
 *
 * <p><b>A `.ts` and never a `.tsx`, for the second of those two reasons rather than the
 * first.</b> `pages/league/componentWords.test.ts` sweeps every `.tsx` whose path names a
 * competition; this path names a team, so that sweep does not reach it either way. What
 * does reach it is the linter, and a table of dictionary keys is data rather than words on
 * a screen.
 *
 * <p><b>THIS SCREEN SENDS ONE VERB AND ONE ONLY, AND THAT IS A BOUNDARY RATHER THAN A
 * STAGE OF THE WORK.</b> See the note on `admin/AdminTeams.tsx`, which states it in full:
 * a team has no route to be made at or changed at, so `DELETE /api/teams/{id}` is the whole
 * of what this file has anything to say about. Measured on 26.09.2026 over
 * `backend/src/main/java`, which declares exactly four (verb, address) pairs for a team and
 * no `PUT` among them.
 */

/**
 * THE ONE REFUSAL `DELETE /api/teams/{id}` NAMES, and the sentence this screen turns it
 * into.
 *
 * <p>`TeamWriteApi` declares six reasons and they fall into three acts that no screen meets
 * more than one of: a member putting a team forward (`WHEN_PROPOSING_A_TEAM`, five of the
 * six), a member leaving his team (`WHEN_LEAVING_A_TEAM`, the sixth), and the team itself
 * being taken away, which is this one. `pages/account/refusals.test.ts` reads the Java
 * source and requires the union of the three to cover all six, so a seventh arrives as a
 * red gate rather than as a code somebody cannot read.
 *
 * <p><b>`theWindowIsShut` IS IN TWO TABLES UNDER TWO DIFFERENT KEYS, WHICH IS THE POINT
 * RATHER THAN A DUPLICATION.</b> This is the shape `leagueWrites.ts` already uses for
 * `theSeasonIsFrozen` and states the reason for: the route answers one word, and what it
 * means to the reader depends on what he pressed. Pressed on the membership page it means
 * „you are staying in the team you are in", and `membership.transferShut` ends on exactly
 * that clause - „Ako se do tada ništa ne dogovori, ostaješ tamo gde jesi." Pressed here it
 * means „this team is not going anywhere until October", and the reader is not in it. One
 * sentence covering both would be half wrong in each place, and the half that was wrong
 * here would be the half that tells the administration it stays somewhere.
 *
 * <p><b>AND THE SENTENCE SAYS THAT THE ADMINISTRATION IS NOT EXEMPT, because that is the
 * decision and not a nicety.</b> PDL P13b, 25.09.2026, owner, choosing between three
 * offered outcomes: „Van prozora 1.10-31.12 ruta vraca 409, i to <b>i administratoru tima i
 * administraciji</b>", and the outcome he refused by name was „rok vazi za clana, ne za
 * administraciju". The cost he was shown and accepted is what the sentence has to carry:
 * „tim koji je u martu ostao bez svrhe <b>stoji do oktobra</b>". A sentence that only said
 * „the window is shut" would leave a moderator pressing again tomorrow.
 *
 * <p><b>It is the ONLY reason this route names.</b> Everything else it turns away - a team
 * that is not there, a team he is in but does not administer, a team he has nothing to do
 * with, and an account naming no member at all - is one empty 404 by ADL A8, so there is
 * nothing for a screen to look up and `ServerSaid` says what it honestly can with the
 * number in it.
 */
export const WHEN_DELETING_A_TEAM: Record<string, string> = {
  theWindowIsShut: 'admin.teamDeleteRefused.theWindowIsShut',
}

/**
 * WHETHER THIS TEAM IS ONE THE DATABASE HANDED OUT, WHICH IS THE QUESTION „MAY THIS ROW'S
 * DELETE BE SENT ANYWHERE" REDUCED TO SOMETHING ANSWERABLE OFF ONE LOOK.
 *
 * <p><b>Why the question exists at all, and it is a measurement rather than caution.</b>
 * A team entered on this screen is still remembered as a session overlay (see the note on
 * `admin/AdminTeams.tsx`), and an entity filed under `id` takes its identity from
 * `admin/entityForms.ts`'s `idFor`, which counts DOWN from nought so that nothing it hands
 * out can collide with a `bigserial`. So the first team entered during a visit is number
 * `-1`, and a delete pressed on its row without this would send
 * `DELETE /api/teams/-1`. That is the very fault PR 368 closed one number along, where the
 * panel of races posted to `/api/leagues/-1/races`; it is written down here rather than
 * rediscovered, because this screen is the one where both kinds of row stand in one table.
 *
 * <p><b>A whole number ABOVE NOUGHT, which is the same range `leagueWrites.identityIn`
 * refuses outside of and for the same reason.</b> `team.id` is a `bigserial` and starts at
 * one; nought and below is precisely the range the overlay hands out.
 *
 * <p><b>Read without an assertion (ADL A14), and `typeof` first.</b> What a row carries
 * here is `unknown` as far as this question goes: a served team carries a number, and a row
 * folded back out of the overlay may carry the text it was filed under. Both are answered
 * correctly by looking rather than by coercing - and coercing is the trap, because
 * `Number('-1')` is a number and `Number('')` is nought, so a string that went through
 * `Number` would be judged on a value this function never saw. A row whose identity is not
 * a number is not the database's, which is the honest answer and the safe one.
 */
export function standsOnTheServer(id: unknown): boolean {
  return typeof id === 'number' && Number.isInteger(id) && id > 0
}
