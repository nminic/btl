import { clearResourceCache } from '../data/client'
import { askTheServer, type Answer } from './account/askTheServer'

/**
 * WHAT IS WAITING ON A TEAM, READ OFF THE SERVER AND ANSWERED THERE.
 *
 * <p>The other half of `TeamJoiningApi`, which answers the two lists, and of the two verbs
 * of `TeamJoiningWriteApi` a team can send about them. Until this module the team's own page
 * drew both lists out of `session/SessionProvider.tsx` - a copy that dies with the tab - and
 * sent nothing at all: measured 29.09.2026, `grep -rn "api/teams/" frontend/src` found the
 * deleting of a team and the answering of an invitation, and not one caller of either
 * address here.
 *
 * <p><b>A module of its own rather than functions inside the screen</b>, which is
 * `member/teamExit.ts`'s own shape and its own reason: `askTheServer` lives under
 * `pages/account` and `data/` imports from `pages/` nowhere in this repo, so the one place
 * that may hold both these writes and the caches they invalidate is a module on this side of
 * that line. `react/only-export-components` asks for the same thing from the other
 * direction, and `TeamDetail.tsx` is a component file.
 *
 * <p><b>Beside `TeamDetail.tsx` rather than under `pages/member/`, and named for the ACT
 * rather than for the screen</b>, because its one
 * caller is the team's own public page and not the member area: the reader is whoever leads
 * the team, standing on the team's page, and `pages/profileAddress.ts` and `pages/sent.ts`
 * are already modules of this level for the same reason. The name is `joiningThisTeam` and
 * not `teamQueue` for a reason `tsc` gives out loud (TS1149): `pages/TeamQueue.tsx` is the
 * drawing, and on a case-insensitive filesystem two files whose names differ only in a
 * capital letter are one file as far as the compiler is concerned.
 *
 * <p><b>THE TWO LISTS ARE NOT RESOURCES AND CANNOT BE.</b> `data/client.ts` builds every
 * resource address as `/api/<name>` out of a closed list, and both of these carry a team in
 * the path. So they are read the way `member/myCategory.ts` reads `/api/me/category`: a
 * plain `fetch` with no token, narrowed by looking at what came back, and every failure one
 * outcome (a list that could not be read, which is NOT an empty list: see {@link Queue}). A read
 * needs no token - `ApiSecurity` protects what changes something - and cookies go with it
 * because the address is our own.
 *
 * <p><b>WHO IS ANSWERED, AND MOVING THIS TO THE SERVER NARROWS IT.</b> `TeamJoiningApi`
 * answers whoever LEADS the team and the administration, and 404 to everybody else, the
 * invited member included. The session prototype this replaces showed the invitations it had
 * sent to EVERY member of the team. That narrowing is not a choice made here: it follows the
 * owner's decision of 27.09.2026, „Poziv u tim salje **samo administrator tog tima**", and
 * its recorded consequence „[IZVEDENO, ne pitano] Povlacenje poziva takodje sme samo
 * administrator. Pravo da se poziv povuce prati pravo da se posalje." A member who may
 * neither send nor take back has nothing to do with a list of what is out.
 */

/** Somebody asking this team to take him, as `GET /api/teams/{id}/applications` answers it. */
export type TeamApplication = {
  id: number
  /** Who is asking, never his `competitor.id`. */
  memberNumber: string
  /** The day he asked, in the league's own zone, as a calendar day. */
  date: string
}

/**
 * Somebody this team has asked in, as `GET /api/teams/{id}/invitations` answers it.
 *
 * <p><b>The `null` is the whole asymmetry between the two lists and it is the server's,
 * quoted rather than reasoned about here.</b> `TeamJoiningApi.Invitation#memberNumber`:
 * „whom it asked, or NULL where his fee has since lapsed - see the class note for why the
 * row stays and the name goes". The row stays because it is what refuses a second invitation
 * to that man; dropped, the team would be shown an empty place, ask again and be refused.
 * The NAME goes because of PDL, 13.09.2026: „Nijedan javni odgovor ne sme da imenuje člana
 * kome je članarina istekla, NI POSREDNO".
 *
 * <p>An application from such a member is the opposite and needs nothing here: it is not
 * listed at all, because the route that would decide it carries `c.active` and the team
 * could not answer it either way.
 */
export type TeamInvitation = {
  id: number
  memberNumber: string | null
  date: string
}

/** Where the applications addressed to a team are read, and where one of them is answered. */
export function theApplicationsOf(team: number): string {
  return `/api/teams/${String(team)}/applications`
}

/** Where the invitations a team has sent are read, and where one of them is taken back. */
export function theInvitationsOf(team: number): string {
  return `/api/teams/${String(team)}/invitations`
}

/**
 * THE TEAM'S ANSWER TO ONE APPLICATION.
 *
 * <p>Built out of {@link theApplicationsOf} rather than written again, so the read and the
 * write of one row are one text: `TeamJoiningWriteApi.decide` is declared on exactly this
 * path, and a second spelling here is the drift the route's own heading calls „the read and
 * the write of one row are one address apart and cannot drift into naming different sets".
 */
export function theDecisionGoesTo(team: number, application: number): string {
  return `${theApplicationsOf(team)}/${String(application)}`
}

/**
 * Where a team takes one of its own invitations back.
 *
 * <p><b>Taking an invitation back is DERIVED, and was NOT ASKED.</b> PDL records it as a
 * consequence of the owner's decision of 27.09.2026 that only the administrator of a team sends
 * an invitation, and marks it so: „[IZVEDENO, ne pitano] Povlacenje poziva takodje sme samo
 * administrator."
 */
export function theWithdrawalGoesTo(team: number, invitation: number): string {
  return `${theInvitationsOf(team)}/${String(invitation)}`
}

/**
 * THE TWO REFUSALS `PUT /api/teams/{id}/applications/{application}` CAN NAME, each to a
 * sentence.
 *
 * <p><b>Read off the route rather than remembered.</b> `TeamJoiningWriteApi` declares six
 * `static final String` constants and only two of them can come back from THIS route:
 * `THE_FORM_IS_NOT_COMPLETE` for a body naming neither „Primi u tim" nor „Odbij", and
 * `THE_WINDOW_IS_SHUT` for taking somebody in on a day nothing may be written about a squad.
 * `HE_IS_ALREADY_IN_A_TEAM` is the OTHER `PUT` of that class, the one the invited member
 * sends; an applicant who has meanwhile got a team is not refused here by name but is
 * invisible to this route entirely, „for refusing as much as for accepting", which is the
 * decision of 06.09.2026 read out in `TeamJoiningWriteApi.decide`. The remaining three belong
 * to the two `POST` routes and to a subject line. `pages/account/refusals.test.ts` holds all
 * six, split exactly that way.
 *
 * <p><b>NEITHER SENTENCE IS ONE THE SCREEN ALSO DRAWS BEFORE ANYTHING IS SENT, which is
 * where this differs from `member/teamWrites.ts`.</b> There, two of three refusals point at
 * sentences that already stand where „Prihvati" would have been. Here the screen simply does
 * not draw „Primi u tim" outside the window and has nothing to say in its place, because the
 * reader is the TEAM and the window is not a fact about the team. So both of these are only
 * ever refusals and both are filed under a refusal key, which is the arrangement
 * `member/teamWrites.ts` gives the reason for: „a sentence filed under `answerRefused` that a
 * screen draws when nothing has been refused would be a lie about where it belongs."
 *
 * <p><b>`theWindowIsShut` gets a sentence of its own rather than `membership.transferShut`,
 * and that is measured rather than tidiness.</b> That sentence ends „Ako se do tada ništa ne
 * dogovori, ostaješ tamo gde jesi", which addresses the member whose membership it is. The
 * reader here is the team, and the one it is about is somebody else, so the portal would be
 * telling the wrong person he stays where he is.
 *
 * <p><b>DELIBERATELY NOT ANNOTATED `Record<string, string>`</b>, which is `member/teamWrites.ts`'s
 * own reasoning: left as the literal it is, renaming a key on one side alone does not build,
 * while an index signature would answer `string | undefined` and need a fallback no case can
 * reach. It is still handed to `ServerSaid` and to `refusals.test.ts` as a
 * `Record<string, string>`, which a literal is assignable to.
 */
export const WHEN_DECIDING_AN_APPLICATION = {
  theFormIsNotComplete: 'teams.decideRefused.theFormIsNotComplete',
  theWindowIsShut: 'teams.decideRefused.theWindowIsShut',
}

/**
 * ONE OF THE TWO LISTS AS A READ LEFT IT: THE ROWS, OR THE PLAIN FACT THAT THEY COULD NOT BE READ.
 *
 * <p>A list that holds nothing and a list that was never read are different facts, and until
 * 02.10.2026 this module had no way to say so: every failure came back as an empty array, which
 * the screen drew as no section at all. Owner, 02.10.2026 (PENDING stavka 368): „Spisak koji ne
 * moze da se ucita KAZE to, umesto da izgleda prazan, uz dugme „Pokusaj ponovo"." So the two are
 * told apart here, at the one place that knows, and the screen is handed the difference.
 *
 * <p>`unreadable` carries nothing, and that is the point: there are six ways a read can fail and
 * the screen has one sentence for all of them (`theRowsAt` says why it has one).
 */
export type Queue<T> = { got: 'rows'; rows: T[] } | { got: 'unreadable' }

const UNREADABLE = { got: 'unreadable' } as const

/**
 * The rows off one of the two lists, or the fact that they could not be read.
 *
 * <p><b>EVERY FAILURE IS ONE OUTCOME, AND IT IS NO LONGER THE OUTCOME OF AN EMPTY LIST</b>
 * (owner, 02.10.2026, PENDING stavka 368). It was both until that day, and the cost was named and
 * accepted when it was written: a team whose administrator could not reach the server was shown no
 * section, exactly as a team with nothing waiting is, so a portal that was down read as a portal
 * with nothing to decide. Measured on the team's page, that was not the safe direction it was
 * taken for: after a press that worked both reads failed, and the two applications the team had
 * never answered went from the page with nothing to say the server had not been reached. The
 * owner chose the other side of it, after the cost was shown to him.
 *
 * <p><b>What stays is that the failures are ONE outcome among themselves.</b>
 * `member/myCategory.ts` settles the same question for the same kind of read and in the same
 * words: no server, 401, 404 for a caller this address is not for, a body that is not JSON, a row
 * missing a field - „none of them is a category, and a screen that told them apart would be
 * offering the reader five sentences about one absent box." And the 404 in particular cannot be
 * told apart even if it were wanted: „the team may not read this" and „there is no such team" are
 * the SAME answer by ADL A8, `TeamJoiningApi` answering 404 to a team that does not exist and to a
 * caller who does not lead it, „so no answer here is an oracle for which teams exist". The sentence
 * says that the list could not be read and does not say why.
 *
 * <p><b>One bad row makes the whole list unreadable rather than dropping itself.</b> A list that
 * quietly left out the row it could not read would show a team fewer questions than it has, and
 * the team would answer the ones it was shown and never learn of the rest. It used to be silent
 * about all of them, which was at least honest about being silence; it says so now.
 */
async function theRowsAt<T>(path: string, oneOf: (row: unknown) => T | null): Promise<Queue<T>> {
  let answer: Response

  try {
    answer = await fetch(path)
  } catch {
    return UNREADABLE
  }

  if (!answer.ok) {
    return UNREADABLE
  }

  let body: unknown

  try {
    body = await answer.json()
  } catch {
    return UNREADABLE
  }

  const served = asRows(body)

  if (served === null) {
    return UNREADABLE
  }

  const rows: T[] = []

  for (const row of served) {
    const one = oneOf(row)

    if (one === null) {
      return UNREADABLE
    }

    rows.push(one)
  }

  return { got: 'rows', rows }
}

/**
 * What came off the wire, as a list of things nothing is claimed about yet.
 *
 * <p>The one place an `any` would otherwise enter this module: `Array.isArray` narrows an
 * `unknown` to `any[]`, so every row read out of it would be an `any` travelling into the
 * narrowing below. `Array.from<unknown>` ends that at the boundary, in one named function,
 * which is what ADL A14 asks for - what comes off the wire is narrowed by looking at it.
 */
function asRows(body: unknown): unknown[] | null {
  return Array.isArray(body) ? Array.from<unknown>(body) : null
}

/**
 * One application, narrowed by looking at it.
 *
 * <p>Exported so its own case can hand it a row no real route would send: this is the only
 * place that decides what counts as an application, and the ways a row can be wrong are more
 * numerous than the ways a route can be.
 */
export function applicationIn(row: unknown): TeamApplication | null {
  if (typeof row !== 'object' || row === null) {
    return null
  }

  const id: unknown = Reflect.get(row, 'id')
  const memberNumber: unknown = Reflect.get(row, 'memberNumber')
  const date: unknown = Reflect.get(row, 'date')

  if (typeof id !== 'number' || typeof memberNumber !== 'string' || typeof date !== 'string') {
    return null
  }

  return { id, memberNumber, date }
}

/**
 * One invitation, narrowed by looking at it.
 *
 * <p><b>`null` is a value here and not an absence</b>, which is the one way this differs from
 * {@link applicationIn}: the route answers `memberNumber: null` for a man whose fee has
 * lapsed, deliberately and by decision, so a narrowing that refused it would drop exactly the
 * rows the list exists to keep. A key that is MISSING is still refused, because that is a
 * route answering something this side does not know.
 */
export function invitationIn(row: unknown): TeamInvitation | null {
  if (typeof row !== 'object' || row === null) {
    return null
  }

  const id: unknown = Reflect.get(row, 'id')
  const memberNumber: unknown = Reflect.get(row, 'memberNumber')
  const date: unknown = Reflect.get(row, 'date')

  if (typeof id !== 'number' || typeof date !== 'string') {
    return null
  }

  if (memberNumber !== null && typeof memberNumber !== 'string') {
    return null
  }

  return { id, memberNumber, date }
}

/** Every application addressed to this team that it can still answer, or that they could not be read. */
export async function whatIsWaitingOn(team: number): Promise<Queue<TeamApplication>> {
  return theRowsAt(theApplicationsOf(team), applicationIn)
}

/** Every invitation this team has sent that nobody has answered, or that they could not be read. */
export async function whatThisTeamHasAsked(team: number): Promise<Queue<TeamInvitation>> {
  return theRowsAt(theInvitationsOf(team), invitationIn)
}

/**
 * Answers one application, and says what came back.
 *
 * <p><b>THE CACHES ARE DROPPED ONLY WHERE THE SERVER AGREED</b>, which is
 * `member/teamExit.ts`'s rule in its own words: a portal that dropped them on the asking
 * would draw a member into a team that never took him. A refusal leaves everything exactly as
 * the server last said it was.
 *
 * <p><b>AND ONLY ON „Primi u tim", because the two answers change different things.</b>
 * „Odbij" writes nothing about a squad - it deletes the question and posts a message into the
 * applicant's inbox, which is HIS inbox and not this reader's - so there is no resource on
 * this screen that it makes stale. Dropping them anyway would be re-reading two lists nothing
 * had changed, and a reader of this function could no longer tell which of the two answers
 * joins a team.
 *
 * <ul>
 * <li><b>`teams`</b>, because `organizer_member_number` is answered off the roster
 * (`TeamApi`) and taking somebody in writes `team_membership`, so the seat and the count of
 * members both move.
 * <li><b>`competitors`</b>, because a member's team reaches this portal as `Competitor.teamId`
 * off `/api/competitors`, answered by the identical clause this write adds a row to. Left
 * alone, every screen that draws somebody's club - this one included, one section further
 * down - would go on drawing him as belonging to nobody.
 * </ul>
 *
 * <p><b>What is NOT dropped, and it is a boundary rather than an omission:</b> the two lists
 * this module reads are not resources and have no cache to drop. Whoever pressed asks for
 * them again, which is `useTeamQueue.ts`'s job and is the only thing that can be right here:
 * the route answers 204, so it answers NOTHING about what stands afterwards.
 *
 * @param accepted „Primi u tim" or „Odbij", and never absent. `TeamJoiningWriteApi.Answered`
 *                 boxes this on purpose, so that a body naming no answer is a form that was
 *                 not filled in rather than a „no" written for somebody
 */
export async function theApplicationWasAnswered(
  team: number,
  application: number,
  accepted: boolean,
): Promise<Answer> {
  const answer = await askTheServer(theDecisionGoesTo(team, application), { accepted }, 'PUT')

  if (answer.got === 'done' && accepted) {
    clearResourceCache('teams')
    clearResourceCache('competitors')
  }

  return answer
}

/**
 * Takes one invitation back, and says what came back.
 *
 * <p><b>NOTHING IS DROPPED, and that is measured rather than forgotten.</b>
 * `TeamJoiningWriteApi.takingBack` deletes one row of `team_invitation` and writes nothing
 * else: the invited member is not told - „an absence of a decision rather than a choice", says
 * the route, since no sentence for it exists in the dictionary or in PDL - and what he keeps
 * is the message that already reached him. No resource on this portal is answered out of that
 * table, so there is no cache that has gone stale. The list on this screen has, and it is
 * asked for again.
 *
 * <p><b>It can name no reason at all.</b> The route answers 204 or an empty 404 - „an
 * invitation that is not there, one belonging to another team, a member of that team who does
 * not lead it, a caller who has nothing to do with it... and an account naming no member" -
 * so a 404 arrives as `{ got: 'wrong', status: 404 }` and is said out loud with its number.
 * That is why there is no dictionary beside {@link WHEN_DECIDING_AN_APPLICATION} for this
 * verb: an empty one would claim this route refuses by name, and it does not.
 */
export async function theInvitationWasTakenBack(
  team: number,
  invitation: number,
): Promise<Answer> {
  return askTheServer(theWithdrawalGoesTo(team, invitation), {}, 'DELETE')
}
