import type { Competitor, League, RacingPair, Team } from '../data/types'

/**
 * WHAT THE BACKEND ANSWERS WITH, WRITTEN DOWN ONCE.
 *
 * **Why one home and not two, which is the whole reason this file exists.** Two things
 * need to know the shape of an answer: the guard that holds it against the types and
 * against the generated file (`data/servedShape.test.ts`), and the harness that has to
 * STAND IN for the server when a case measures what a screen does with it
 * (`test/serverAnswers.ts`). Until 21.09.2026 the second kept its own list of the
 * fields to take away, and a hand-written list is a thing that goes short: `active` was
 * on it, `referredBy` was on it, and `membershipBasis` was not, so a member's own fee
 * screen read a field the server does not give him and the whole suite stayed green.
 *
 * **So the harness does not keep a list at all any more.** It keeps the KEYS of the
 * records below, and what is not on them is not in the answer. A field the server stops
 * sending is taken away here, in one place, and the harness follows without being told;
 * a field it starts sending is added here and the guard beside it says whether the
 * generated file agrees.
 *
 * **What a record here is a record OF, said exactly.** The set of field NAMES a row
 * carries and the SORT of each. The values are real ones read off `/api/...` on QA on
 * 20.09.2026 where a row existed to read, and built out of the record the server
 * declares (`backend/src/main/java/com/btl/portal/web`) where none did. Nothing reads a
 * value here for its own sake.
 */

/**
 * A member as a VISITOR is answered one, which is fourteen names and no more.
 *
 * The three conditional fields are not here and that is the shape rather than a
 * shortfall: `referralCode` and `referredCount` answer null unless the row is the
 * caller's own, `membershipBasis` answers null unless the CALLER is the
 * administration, and `@JsonInclude(NON_NULL)` leaves a null key out altogether
 * (`CompetitorApi`).
 */
export const aCompetitor = {
  memberNumber: '000001',
  firstName: 'Vladan',
  lastName: 'Đurišić',
  gender: 'M' as const,
  city: 'Beograd',
  country: 'RS',
  ageBand: '40-54' as const,
  firstSeason2027: false,
  firstSeason: 2014,
  bio: '',
  teamId: 1,
  teamSince: 2014,
  profileHidden: false,
  birthdayShown: 'none' as const,
}

/**
 * The same member's row as HE is answered it: his own code and his own count beside
 * the fourteen.
 *
 * **And NOT his basis, which is the correction of 21.09.2026 and the reason a screen
 * was wrong.** The condition on that field is the CALLER and never the row - written
 * `case when cast(:administration as boolean) then c.membership_basis end` - so a
 * member does not get it here even about himself. Where he does get it is `/api/me`,
 * which answers one row and that row is his (`MeApi.MyOwnRecord`), and that is the
 * owner's sentence of 20.09.2026 kept in both halves: „Clan vidi SVOJ osnov clanstva;
 * tudj ne vidi niko osim administracije."
 */
export const myOwnRow = {
  ...aCompetitor,
  referralCode: '7f07b38ff7ee7543',
  referredCount: 4,
}

/**
 * And a row as the ADMINISTRATION is answered one: the basis, on every row of the
 * answer rather than on its own.
 */
export const aCompetitorToTheAdministration = {
  ...aCompetitor,
  membershipBasis: 'payment' as const,
}

/** A team as the administration is answered one: the seat is a member number, and the
 *  mark and its square are both there, which is the only way a picture ever arrives
 *  (`TeamApi`, both halves or neither). */
export const aTeam = {
  id: 1,
  slug: 'dunavski-trkaci',
  name: 'Dunavski trkači',
  city: 'Novi Sad',
  country: 'RS',
  bio: '',
  logo: '/api/photos/7d1f0a2b',
  crop: { x: 0.5, y: 0.35, size: 0.72 },
  organizerMemberNumber: '000001',
}

/** And a team with no mark, answered to a signed in member who did not found it:
 *  nothing where the picture would be, nothing where its square would be, and no seat
 *  at all. The two nothings travel together, which is why this one is written down
 *  beside the row above. */
export const aTeamWithNoMark = {
  ...aTeam,
  id: 4,
  slug: 'novoosnovani-tim',
  name: 'Novoosnovani tim',
  logo: null,
  crop: null,
  organizerMemberNumber: undefined,
  foundedByMe: false,
}

/** Both of them, the man first, which is the order the schema stores them in. Named
 *  rather than written in place so the two are a PAIR and not a list that happens to
 *  hold two: ADL A14 refuses an assertion here, and a type annotation says the same
 *  thing without one. */
const twoMembers: [string, string] = ['000001', '000009']

/** A pair, which is three names and not four: the day it was made is answered to
 *  nobody (owner, 13.09.2026). */
export const aPair = {
  id: 1,
  season: 2019,
  memberNumbers: twoMembers,
}

/** A league. `raceIds` is on the answer and not on the type, which is the one direction
 *  the guard deliberately lets through: what the backend has and the portal has not is
 *  the owner's half. */
export const aLeague = {
  id: 1,
  slug: 'btl-liga-2019',
  name: 'BTL liga 2019',
  season: 2019,
  rules: '',
  prizes: '',
  raceIds: [275],
  eventIds: [273],
}

/* Handed to the names the screens read them through, here rather than in the guard, so
   that the compiler answers for this file on its own: a record that stops being
   readable as what the portal reads it as is a build that does not finish, whether or
   not anybody runs a case. */
export const readAsVisitorsMember: Competitor = aCompetitor
export const readAsMyOwnRow: Competitor = myOwnRow
export const readAsAdministrationsRow: Competitor = aCompetitorToTheAdministration
export const readAsTeam: Team = aTeam
export const readAsTeamWithNoMark: Team = aTeamWithNoMark
export const readAsPair: RacingPair = aPair
export const readAsLeague: League = aLeague

/**
 * THE CALLER'S OWN RECORD, as `GET /api/me` answers it.
 *
 * **Here and not beside the reader that needs it, which is the correction of
 * 21.09.2026.** The harness kept these seven names written out by hand
 * (`test/setup.ts`), and a hand-written list of what an answer carries is exactly the
 * shape that let `membershipBasis` through: measured that day, adding `active` to it -
 * a name `MeApi` does not carry - left all 179 files and 2959 cases green. The list had
 * not gone wrong yet; there was simply nothing that could tell.
 *
 * So `/api/me` joins the same home the fourteen resources are in, and the harness builds
 * its answer out of THESE keys. What holds the keys themselves is `data/contract.test.ts`,
 * which reads the components of `MeApi.MyOwnRecord` off the backend's own source and
 * requires the two to be the same set - so a name added here that the server has not got
 * fails by name, and a name the server has that is missing here fails the same way.
 *
 * **Not handed to a type, and that is said rather than left as an omission.** The portal
 * has no type for this record: it reads ONE field off it, how the caller's own membership
 * is held (`session/theServer.ts`), because that is the only one of the seven with no
 * other door. A type here would be six names nothing reads.
 */
export const myOwnRecordFromMe = {
  memberNumber: '000001',
  country: 'RS',
  firstSeason: 2014,
  teamId: 1,
  membershipBasis: 'payment',
  referralCode: '7f07b38ff7ee7543',
  referredCount: 4,
}

/**
 * One row of the generated file reduced to what the server would really answer with.
 *
 * The keys of the record above and nothing else, which is what replaces the list the
 * harness used to keep: a field the file carries and the answer does not simply has no
 * key to be copied into.
 */
export function asAnswered(
  row: Record<string, unknown>,
  shape: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(Object.keys(shape).filter((name) => name in row).map(
    (name) => [name, row[name]],
  ))
}
