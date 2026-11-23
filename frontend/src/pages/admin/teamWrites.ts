/**
 * WHAT THE ADMINISTRATION'S SCREEN OF TEAMS SENDS, AND WHAT THE ONE REFUSAL OF IT IS
 * CALLED.
 *
 * <p><b>Read by TWO screens since 28.09.2026, and the second one is not the
 * administration's.</b> `pages/TeamDetail.tsx` sends the same verb to the same address, because
 * PDL P13b calls the two „ista radnja"; it is this file rather than a copy beside that screen
 * for the reason the whole portal keeps one home per fact. The name stands as it was written
 * because the administration is where this delete first got a route, not because it is the only
 * caller.
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
 * <p><b>THREE VERBS SINCE 23.11.2026, AND ALL THREE GO TO THE SERVER.</b> ~~This screen sent one
 * verb and one only~~, because a team had no route to be made or changed at, so the making and the
 * changing lived in the browser's session and a team made there did not exist (PDL P13,
 * „[ZATEČENO 23.11.2026 ...]", measured on production). The administration now makes a team at
 * `POST /api/teams/direct` and changes one at `PUT /api/teams/{id}`
 * (`TeamAdministrationWriteApi`), both directly, by the decision of 09.10.2026 („Administracija
 * pravi i menja tim direktno, bez reda za moderaciju").
 */

/**
 * WHERE THE ADMINISTRATION'S FORM GOES: a team being made to the making, a team that exists to its
 * own change. Asked of the identity the form was opened with, never of what the form holds.
 */
export function whereTheTeamGoes(id: number | null): { path: string; method: 'POST' | 'PUT' } {
  return id === null
    ? { path: '/api/teams/direct', method: 'POST' }
    : { path: `/api/teams/${String(id)}`, method: 'PUT' }
}

/**
 * WHAT THE FORM SENDS, NAMED FIELD BY FIELD AND NEVER SPREAD, so a value the form holds for its own
 * reasons (the identity, the address) cannot ride along. The six are `admin-tim.form.json`'s, which
 * `TeamAdministrationWriteApiTest` holds to the route's record.
 */
export function theTeamAsWritten(values: Record<string, unknown>): Record<string, string> {
  return {
    name: String(values.name ?? ''),
    city: String(values.city ?? ''),
    country: String(values.country ?? ''),
    organizerMemberNumber: String(values.organizerMemberNumber ?? ''),
    bio: String(values.bio ?? ''),
    link: String(values.link ?? ''),
  }
}

/**
 * THE REASONS THE ADMINISTRATION'S TWO WRITES OF A TEAM NAME, each to a sentence.
 *
 * <p>Five are the member's own sentences, because they are the same fact about the same form
 * (`WHEN_PROPOSING_A_TEAM`): a name taken, a name that makes no address, a country nobody serves, a
 * link that is not one, and the window (`teams.proposeShut`, the portal's sentence for the window a
 * team is founded in, which binds the administration too: PDL P13, 26.09.2026). Two are the
 * moderator's sentences, word for word, because this reader is the one who decides and the founder
 * is somebody else: „Osnivač je već u nekom timu." and the owner's „Osnivač nije platio članarinu
 * za sezonu [sezona]." (PDL, 31.10.2026). The four left are this form's own, worded by me.
 */
export const WHEN_THE_ADMINISTRATION_WRITES_A_TEAM: Record<string, string> = {
  theFormIsNotComplete: 'admin.teamRefused.theFormIsNotComplete',
  theCountryIsNotKnown: 'teams.proposeCountryUnknown',
  theNameMakesNoAddress: 'teams.proposeNoAddress',
  theAddressIsTaken: 'teams.proposeTaken',
  heIsNotInTheTeam: 'admin.teamRefused.heIsNotInTheTeam',
  theLinkIsNotShaped: 'teams.proposeLinkNotShaped',
  theTextIsTooLong: 'admin.teamRefused.theTextIsTooLong',
  theWindowIsShut: 'teams.proposeShut',
  theOrganizerIsNotKnown: 'admin.teamRefused.theOrganizerIsNotKnown',
  heIsAlreadyInATeam: 'admin.teamRefused.heIsAlreadyInATeam',
  theSeasonIsNotPaid: 'admin.teamRefused.theSeasonIsNotPaid',
}

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
 * that clause - „Ako se do tada ništa ne dogovori, ostaješ tamo gde jesi." Pressed on a
 * DELETE it means „this team is not going anywhere until October", which is a fact about the
 * team rather than about where the reader stands. One sentence covering both would be half
 * wrong in each place, and the half that was wrong here would be the half that tells
 * somebody deleting a team that he stays somewhere.
 *
 * <p><b>AND IT IS THE SAME SENTENCE FOR BOTH OF THE TWO SCREENS THAT PRESS THIS DELETE,
 * SINCE 28.09.2026.</b> ~~The reader is not in it.~~ `pages/TeamDetail.tsx` imports this map
 * too, and that reader is the team's own administrator, standing in the team he is taking
 * away. The sentence did not move with him, because what it says is true of both: the team
 * is not going anywhere until October, and „ni iz administracije" is the clause that keeps a
 * moderator from pressing again tomorrow. A second Serbian sentence for the team's own page
 * would have been a second place to change and the first of the two to drift - which is the
 * fault the two keys above exist to prevent, not to licence.
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
 * WHERE „DODAJ ČLANA” AND „IZBACI” GO (PDL P13, „[ODLUKA 23.11.2026 ...] Administracija dodaje i izbacuje
 * članove tima direktno”): the team's own address and the member's number on it, which is how
 * `TeamAdministrationWriteApi` names both. The number is put into the path as it is, since a member number
 * is digits and nothing else.
 */
export function membersOfTheTeam(team: number): string {
  return `/api/teams/${String(team)}/members`
}

export function memberOfTheTeam(team: number, memberNumber: string): string {
  return `${membersOfTheTeam(team)}/${memberNumber}`
}

/**
 * THE REASONS THOSE TWO ROUTES NAME, each to a sentence of this panel's own (worded by me, shown to the owner
 * with the screen). `theWindowIsShut` has a key of its own here and not the deletion's, for the reason
 * `WHEN_DELETING_A_TEAM` gives: what the reader has to know is about what he pressed. `theSeasonIsNotPaid`
 * carries `{season}`, the season a change of team takes effect in.
 */
export const WHEN_THE_ADMINISTRATION_MOVES_A_MEMBER: Record<string, string> = {
  theWindowIsShut: 'admin.teamMemberRefused.theWindowIsShut',
  theFormIsNotComplete: 'admin.teamMemberRefused.theFormIsNotComplete',
  theMemberIsNotKnown: 'admin.teamMemberRefused.theMemberIsNotKnown',
  heIsAlreadyInATeam: 'admin.teamMemberRefused.heIsAlreadyInATeam',
  theSeasonIsNotPaid: 'admin.teamMemberRefused.theSeasonIsNotPaid',
  heIsNotInTheTeam: 'admin.teamMemberRefused.heIsNotInTheTeam',
}
