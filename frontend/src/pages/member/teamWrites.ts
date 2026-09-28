import { clearResourceCache } from '../../data/client'
import { theInboxHasChanged } from '../../data/useResource'
import { inYearlyWindow } from '../../data/season'
import type { WhatIsWaiting } from '../../data/types'
import { askTheServer, type Answer } from '../account/askTheServer'

/**
 * ANSWERING A SERVED INVITATION INTO A TEAM, WHICH IS THE ONLY THING ON THIS PORTAL THAT
 * PUTS A MEMBER INTO ONE BY HIS OWN WORD.
 *
 * <p>Owner, PDL, 05.09.2026: „**Poziv u tim prihvata pozvani član.** Niko ne sme da upiše
 * promenu koja se tiče drugog čoveka bez njegove reči, pa ni član tima koji poziva."
 * `PUT /api/teams/{id}/invitations/{invitation}` is the route that already existed to
 * receive it, and until this module nothing on the portal called it.
 *
 * <p><b>A module of its own rather than a function inside the screen, which is
 * `member/pairWrites.ts`'s own shape and its own reason:</b> `askTheServer` lives under
 * `pages/account` and `data/` does not import from `pages/` anywhere in this repo, so the
 * one place that may hold both this write and the caches it invalidates is a module on this
 * side of that line. `react/only-export-components` asks for the same thing from the other
 * direction.
 *
 * <p><b>THE SISTER SCREEN IS NOT THIS ONE AND MUST NOT BE.</b> `member/InvitationAnswer.tsx`
 * answers an invitation the BROWSER is holding, by writing the team onto a record in
 * `session/SessionProvider.tsx`; this answers one the SERVER is holding, by writing to the
 * route. The two take different keys, text against a number (`session/context.ts` against
 * `data/types.ts`), so neither can be handed the other's by accident. `member/pairWrites.ts`
 * drew that same boundary for the pair half a day earlier and this is it drawn again rather
 * than a new idea.
 */

/**
 * WHERE ONE ANSWER GOES, AND IT TAKES TWO KEYS BECAUSE THE ROUTE REALLY ASKS FOR TWO.
 *
 * <p><b>The team is not decoration on the address.</b>
 * `TeamJoiningWriteApi.invitationHeMayAnswer` reads
 * `where i.id = ? and i.team_id = ? and i.competitor_id = ? and c.active`, so an invitation
 * named with the wrong team is answered by the same empty 404 as one that does not exist.
 * That is why this module exists at all: `GET /api/inbox` carries `teamInvitationId` and
 * nothing else about the question, and the team has to be fetched from the one route that
 * hands the invited member both halves.
 *
 * @param team       `team.id`, as `GET /api/me/applications` carries it on the invitation
 * @param invitation `team_invitation.id`, as the inbox line carries it
 */
export function theAnswerGoesTo(team: number, invitation: number): string {
  return `/api/teams/${String(team)}/invitations/${String(invitation)}`
}

/**
 * THE THREE REFUSALS `PUT /api/teams/{id}/invitations/{invitation}` CAN NAME, each to a
 * sentence in the dictionary.
 *
 * <p><b>Read off the route rather than remembered.</b> `TeamJoiningWriteApi` declares six
 * `static final String` constants and only three of them can come back from THIS route:
 * `THE_FORM_IS_NOT_COMPLETE` for a body naming neither „Prihvati" nor „Odbij",
 * `THE_WINDOW_IS_SHUT` for accepting on a day nothing may be written about a squad, and
 * `HE_IS_ALREADY_IN_A_TEAM` for accepting once he has a team. `A_QUESTION_ALREADY_STANDS`
 * and `HE_HAS_ALREADY_BEEN_ASKED` belong to the two POST routes of the same class, which no
 * screen sends, and `THE_INVITATION_WAS_MISSED` is a subject line rather than a refusal at
 * all. `pages/account/refusals.test.ts` holds all six, split exactly that way.
 *
 * <p><b>TWO OF THE THREE POINT AT A SENTENCE THE SCREEN ALSO DRAWS BEFORE ANYTHING IS SENT,
 * and that is the decision rather than a saving.</b> The same two facts are answered twice
 * over: once by `GET /api/me/applications` when the buttons are drawn, and once by the route
 * when the answer arrives, because either can change in between. A refusal means the same
 * thing whichever of the two doors said it, so a second Serbian sentence for it would be a
 * second place to change - which is `admin/activation.ts`'s own reasoning about
 * `PaymentApi` pointing at `WHEN_ACTIVATING`'s sentences.
 *
 * <ul>
 * <li>`theWindowIsShut` is `teams.inviteWaits`, and that key is not chosen here:
 * `MyApplicationsApi.Waiting#alreadyInATeam` names it for exactly this state, „for a shut
 * window, which is still answerable in October".
 * <li>`heIsAlreadyInATeam` is `teams.inviteOvertakenUnnamed`, which is the owner's own
 * `teams.inviteOvertaken` with the team's name taken out and the ending changed because
 * „Odbij" is still live beside it. <b>Derived from his sentence rather than quoted</b>, and
 * marked as such: the name cannot be carried, because the route answers
 * `alreadyInATeam` as a boolean and `GET /api/me`'s `teamId` is a DIFFERENT fact - its own
 * note says „WHAT IT DOES NOT SAY is which team he is in THIS season" - so reading it here
 * would give one decision two sources that can come apart.
 * <li>`theFormIsNotComplete` is the one that is only ever a refusal, so it is the only one
 * that lives under `teams.answerRefused`.
 * </ul>
 *
 * <p><b>The two that are drawn as well as refused are top-level keys for that reason</b>, and
 * not out of tidiness: a sentence filed under `answerRefused` that a screen draws when
 * nothing has been refused would be a lie about where it belongs.
 *
 * <p><b>DELIBERATELY NOT ANNOTATED `Record<string, string>`, which is the compiler being
 * made to hold the join rather than a case.</b> Left as the literal it is, the two names in
 * {@link MayHeAccept} are keys TypeScript knows this object has, so
 * `WHEN_ANSWERING_A_TEAM_INVITE[accept]` is a `string` and renaming either key on one side
 * alone does not build. Widened to an index signature it would answer `string | undefined`,
 * the screen would need a fallback for a key that cannot be missing, and that fallback would
 * be a branch nothing reaches - which the coverage floor refuses and which would have hidden
 * exactly the drift this map exists to prevent. It is still handed to `ServerSaid` and to
 * `pages/account/refusals.test.ts` as a `Record<string, string>`, which a literal is
 * assignable to.
 */
export const WHEN_ANSWERING_A_TEAM_INVITE = {
  theFormIsNotComplete: 'teams.answerRefused.theFormIsNotComplete',
  theWindowIsShut: 'teams.inviteWaits',
  heIsAlreadyInATeam: 'teams.inviteOvertakenUnnamed',
}

/**
 * WHETHER „PRIHVATI" MAY BE OFFERED, AND WHERE IT MAY NOT, WHY NOT.
 *
 * <p><b>The two names that are not `offered` are the SERVER'S OWN WORDS</b>, and that is the
 * one thing this type is for. The screen picks its sentence out of
 * {@link WHEN_ANSWERING_A_TEAM_INVITE} by this value, and the route picks its refusal out of
 * the same map by the word it sends back, so the two cannot drift into two vocabularies for
 * one pair of facts. A guard that measured them separately would be two halves with nothing
 * tying them together, which is exactly the shape that reads as though it works.
 */
export type MayHeAccept = 'offered' | 'theWindowIsShut' | 'heIsAlreadyInATeam'

/** An invitation the server is still holding for this member, with everything the screen
 *  has to decide already decided. */
export type TheInvitationStanding =
  | {
      /** It is not in what the server says he is waiting on, so there is nothing to answer. */
      standing: false
    }
  | {
      standing: true
      /** The team the row really names, which the address needs and the inbox cannot say. */
      team: number
      accept: MayHeAccept
    }

/**
 * WHAT THE SERVER SAYS ABOUT ONE INVITATION THE INBOX ASKED ABOUT, worked out here rather
 * than in the screen so that the answer can be measured without mounting anything.
 *
 * <p><b>ABSENT FROM THE LIST IS HOW THE SERVER SAYS A QUESTION IS CLOSED</b>, and it is the
 * only way it can: `TeamJoiningWriteApi.theInvitationIsOver` empties `message.team_invitation_id`
 * before it deletes the row, so under this schema a served line pointing at a row that is gone
 * cannot exist - the pointer is `null` and no question is drawn at all. What CAN happen is
 * that the two reads disagree, the inbox being older than the waiting list, and then this is
 * the honest answer.
 *
 * <p><b>„Somebody else's invitation" is THE SAME ANSWER and that is written down rather than
 * pretended about.</b> `GET /api/me/applications` answers only about the caller, so a key
 * that names a question of another member's is simply not in this list. The screen cannot
 * tell the two apart and must not claim to; both end in „Ovaj poziv više ne stoji."
 *
 * <p><b>The window is asked BEFORE the team he may already have, which is the server's own
 * order</b> (`TeamJoiningWriteApi.answering` asks `transferWindowOpen` and only then
 * `standsInHisWay`). Read the other way round, the screen would say „you have joined a team"
 * where the route would have said „the window is shut", and the two doors would answer one
 * question two ways. <b>And it is the truthful order as well, which is my reasoning over the
 * owner's sentences rather than his:</b> „Poziv čeka" stays true for a member who has a team
 * today, because leaving one is in the very same window as joining
 * (PDL, 24.09.2026: „Iz tima se izlazi u istom prozoru u kom se i ulazi"), so by October he
 * may be free to accept.
 *
 * <p><b>„Odbij" is not a state here at all, because it is never held back.</b> PDL,
 * 06.09.2026: „**„Prihvati" traži prelazni rok, „Odbij" ne.** ... Odbijanje ne upisuje ništa
 * o sastavu nego samo završava pitanje." The same entry says what holding it back would cost
 * - „član pozvan 30. decembra ne bi mogao ni da prihvati ni da se oslobodi pitanja do
 * sledećeg oktobra" - and that reason reads word for word when the obstacle is a team rather
 * than a date, which is why the decision of 06.09.2026 that names only „Prihvati"
 * („Čim član ima tim, nijedan drugi poziv ne nudi „Prihvati"") is read as naming only that
 * one. <b>The prototype `member/InvitationAnswer.tsx` takes BOTH buttons away in that state
 * and this screen does not; the difference is deliberate and is recorded rather than left to
 * look like a slip.</b>
 *
 * @param waiting    what `GET /api/me/applications` answered
 * @param invitation `teamInvitationId` off the inbox line
 * @param today      the day in the league's own zone, from the clock the portal already reads
 */
export function theInvitationStanding(
  waiting: WhatIsWaiting,
  invitation: number,
  today: string,
): TheInvitationStanding {
  const his = waiting.teamInvitations.find((one) => one.id === invitation)

  if (his === undefined) {
    return { standing: false }
  }

  return { standing: true, team: his.teamId, accept: whetherHeMayAccept(waiting, today) }
}

/** The two obstacles, in the order the route asks them in. Split out so that the answer
 *  about WHICH invitation and the answer about WHETHER any may be accepted are two
 *  readings: the second cannot differ between two of his invitations, which is the very
 *  reason `MyApplicationsApi` answers `alreadyInATeam` beside the lists and not on each. */
function whetherHeMayAccept(waiting: WhatIsWaiting, today: string): MayHeAccept {
  if (!inYearlyWindow(today)) {
    return 'theWindowIsShut'
  }

  return waiting.alreadyInATeam ? 'heIsAlreadyInATeam' : 'offered'
}

/**
 * Answers one invitation, and says what came back.
 *
 * <p><b>THE CACHES ARE DROPPED ONLY WHERE THE SERVER AGREED</b>, which is the axis this
 * function cannot get wrong and is `member/inboxRead.ts`'s own rule in its own words: a
 * portal that dropped them on the asking would draw a member in a team that never took him.
 * A refusal leaves everything exactly as the server last said it was.
 *
 * <p><b>TWO ARE DROPPED EITHER WAY AND THE THIRD ONLY ON „Prihvati", because the two answers
 * change different things.</b>
 *
 * <ul>
 * <li>The <b>inbox</b> is stale either way: both answers delete the row, so the served line
 * comes back with no `teamInvitationId` and the buttons are gone rather than offered again.
 * <li><b>What he is waiting on</b> is stale either way for the same reason, and for one more
 * that only „Prihvati" has: `TeamJoiningWriteApi.theOtherTeamsThatAskedHim` leaves every
 * other team's row standing (PDL, 06.09.2026: „Poziv se ne pamti kao odgovoren") while
 * `alreadyInATeam` turns true, so a held answer would go on offering „Prihvati" under every
 * other invitation he has.
 * <li>The <b>teams</b> are stale only on „Prihvati", which is the one answer that writes
 * `team_membership`. „Odbij" that dropped them as well would be re-reading a resource nothing
 * had changed, and a reader of this function could no longer tell which of the two joins a
 * team. `app/Shell.tsx` holds every screen under one outlet, so walking from this message to
 * his own profile or to the team's page without a fresh read would show him no team a moment
 * after he joined one. Clearing a second resource after a write is the portal's own shape:
 * `member/pairWrites.ts` drops `pairs`, `admin/Payments.tsx` two and `admin/AdminMembers.tsx`
 * eight.
 * </ul>
 *
 * @param team       which team's invitation, off {@link theInvitationStanding}
 * @param invitation `team_invitation.id`, as the served line carries it
 * @param accepted   „Prihvati" or „Odbij", and never absent. `TeamJoiningWriteApi.Answered`
 *                   boxes this on purpose - „a body that names no answer at all is a form
 *                   that was not filled in, and a primitive would read it as „Odbij" and
 *                   close somebody's question for him" - so the field is always written
 *                   here, and the refusal that names its absence is answered anyway, for a
 *                   request that went round this screen
 */
export async function theServerWasAnswered(
  team: number,
  invitation: number,
  accepted: boolean,
): Promise<Answer> {
  const answer = await askTheServer(theAnswerGoesTo(team, invitation), { accepted }, 'PUT')

  if (answer.got === 'done') {
    if (accepted) {
      clearResourceCache('teams')
    }

    clearResourceCache('me/applications')
    theInboxHasChanged()
  }

  return answer
}
