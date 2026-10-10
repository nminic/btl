import { clearResourceCache } from '../../data/client'
import { theInboxHasChanged } from '../../data/useResource'
import { askTheServer, type Answer } from '../account/askTheServer'

/**
 * THE THREE WRITES OF A RACING PAIR, ALL ON THE SERVER: ASKING, ANSWERING AND „RASKINI".
 *
 * <p>Owner, PDL P13: „Trkački par se formira obostranom potvrdom: svako sme da pošalje zahtev
 * svakome, a par nastaje kad druga strana potvrdi." Asking is `POST /api/pairs` since P2
 * (10.10.2026); until that day „Pozovi u trkački par" wrote the question and its message into
 * `session/SessionProvider.tsx`, so the member asked never saw it and the pair could not be made
 * (QA review of 09.10.2026, row 5). Answering is `PUT /api/pairs/{id}`, owner, PDL 27b,
 * 27.09.2026, defining the outcome he chose by the question he asked it with: „Pod 1 ako to
 * podrazumeva da clan moze klikom na dugme da prihvati ili odbije poziv?" The answer is yes, and
 * the route already existed to receive it - what was missing was any screen that called it.
 *
 * <p><b>A module of its own rather than a function inside the screen, which is the shape
 * `member/inboxRead.ts` and `member/photoWrites.ts` already have and the reason they give:</b>
 * `askTheServer` lives under `pages/account` and `data/` does not import from `pages/`
 * anywhere in this repo, so the one place that may hold both this write and the caches it
 * invalidates is a module on this side of that line. `react/only-export-components` asks for
 * the same thing from the other direction.
 *
 * <p><b>THE SISTER SCREEN IS NOT THIS ONE AND MUST NOT BE.</b>
 * `member/PairInviteAnswer.tsx` answers an invitation the BROWSER is holding, by writing the
 * pair into `session/SessionProvider.tsx`; this answers one the SERVER is holding. The two
 * take different keys - text against a number (`data/types.ts`,
 * `pairInviteOnTheServer`) - so neither can be handed the other's by accident.
 */

/**
 * WHERE A QUESTION IS ASKED: the collection, with no key, because the question has none until the
 * server hands it back (`PairWriteApi.invite`, `Asking(id, memberNumber)`).
 */
export const THE_QUESTION_GOES_TO = '/api/pairs'

/**
 * THE FOUR REFUSALS `POST /api/pairs` NAMES, each to a sentence.
 *
 * <p><b>Read off the route.</b> `PairWriteApi.invite` and `ask` name `THE_FORM_IS_NOT_COMPLETE`
 * (400, a body with no member number), `THE_PAIR_WOULD_NOT_BE_MIXED`, `A_QUESTION_ALREADY_STANDS`
 * and `A_PAIR_ALREADY_HOLDS` (all 409). Everything else that route turns away is an empty 404 -
 * nobody of that number, a member whose fee has lapsed, himself, his own fee lapsed, an account
 * naming no member - so it carries no reason, and the screen hands `ServerSaid` the table
 * {@link WHAT_THE_NUMBER_SAYS_WHEN_INVITING_INTO_A_PAIR} for it.
 *
 * <p><b>`aQuestionAlreadyStands` is the sentence that stands where the button would have been,
 * and that is the decision rather than a saving.</b> PDL, 07.09.2026, of the button: it is seen
 * only when „među njima ne stoji već poslat poziv, ni u jednom smeru". The route refusing a
 * second question and the list saying one stands are one fact told on two doors, so they get one
 * sentence (`pair.asked`), the arrangement `pages/joiningThisTeam.ts` gives its
 * `heHasAlreadyBeenAsked` for a team.
 *
 * <p><b>The other three are only ever refusals, and filed under one</b>, each of them a race the
 * screen cannot close: one of the two pairing up between the drawing and the press, a gender put
 * right in between, and a request that went round this screen. The words are the agent's, and the
 * owner takes them to be changed on QA (PDL, the answers of 10.10.2026: „četiri nove rečenice
 * odbijanja idu u formulaciji agenta, vlasnik ih menja na QA").
 */
export const WHEN_INVITING_INTO_A_PAIR = {
  theFormIsNotComplete: 'pair.inviteRefused.theFormIsNotComplete',
  thePairWouldNotBeMixed: 'pair.inviteRefused.thePairWouldNotBeMixed',
  aQuestionAlreadyStands: 'pair.asked',
  aPairAlreadyHolds: 'pair.inviteRefused.aPairAlreadyHolds',
}

/**
 * WHAT THE EMPTY 404 OF `POST /api/pairs` MEANS, said in the route's own terms.
 *
 * <p>Five callers at once, deliberately (`PairWriteApi.ask`, „FOUR PEOPLE GET THIS ONE ANSWER",
 * and an account naming no member besides): told apart, the numbers would list who has not paid.
 * None of them is answered by pressing again, so the portal's general sentence for a 404 - „try
 * again in a minute" - is the wrong advice for every one, which is the reason
 * `profile/RacingPairLine.tsx` keeps a table of its own for „Raskini" (PENDING stavka 316). The
 * words are the agent's, under the answer quoted above {@link WHEN_INVITING_INTO_A_PAIR}.
 */
export const WHAT_THE_NUMBER_SAYS_WHEN_INVITING_INTO_A_PAIR: Record<number, string> = {
  404: 'pair.inviteRefused.notThere',
}

/**
 * WHETHER AN ANSWER IS THE SERVER SAYING THAT WHAT THE SCREEN WAS DRAWN FROM HAS GONE STALE.
 *
 * <p>A refusal the route NAMES, or its empty 404, is the server answering about rows the screen
 * read earlier in the visit - a question standing, a pair holding, a member no longer one - so the
 * lists those rows came from are no longer the server's answer. A 5xx, a 403 or no answer at all
 * says nothing about any row, and pressing again is what helps there.
 *
 * <p><b>Derived 10.10.2026 and not the owner's word</b>, from the medium finding of the review of
 * PR 516 (PENDING, „Odbijanje koje dokazuje da je ekran zastareo ostavlja zastareo crtež") and its
 * remedy, „na odbijanje bilo koje od dve rute baciti `me/applications` i povećati `revision`",
 * itself derived from the decisions of 06.09.2026 about a team. For a pair the decision it keeps
 * within one visit is PDL, 07.09.2026: the button is drawn only when no question stands between
 * the two „ni u jednom smeru" and neither of them holds a pair for the season being formed.
 */
export function theServerSaysTheScreenIsStale(answer: Answer): boolean {
  return answer.got === 'refused' || (answer.got === 'wrong' && answer.status === 404)
}

/**
 * ONE MEMBER ASKS ANOTHER INTO A RACING PAIR, and says what came back.
 *
 * <p>The question and the message that carries it into the inbox of the member asked are both
 * the route's to write (`PairWriteApi.ask`, „AND IT ARRIVES AS A QUESTION IN HIS INBOX"), so
 * nothing here writes a message, and nothing here works out a season: it is worked out on the
 * day of the ANSWER (PDL, 07.09.2026, „Rok od 31. decembra visi o potvrdi, ne o pozivu").
 *
 * <p><b>What it makes stale, and when.</b>
 *
 * <ul>
 * <li><b>Agreed</b>: the asker's own list of what he waits on (`me/applications`), which now holds
 * the question. Nothing else moves - no pair is made by asking, and his own inbox is not written
 * to. The screen asks for the list again itself, because it is still mounted.
 * <li><b>Refused in a way that says the screen was stale</b> ({@link theServerSaysTheScreenIsStale}):
 * the same list, which the screen asks for again so that a question standing takes the button's
 * place, and `pairs` as well, for the next screen that reads it - a pair holding is one of the
 * things the route refuses over, and the mounted profile is not told: re-read under it, the pair
 * would take the button away together with the sentence that says why, the shape
 * `member/ServedPairInvite.tsx` refuses for its own 404 („the member would be left with buttons
 * gone and no word about why"). That boundary is recorded in the description of P2.
 * <li><b>Anything else</b> drops nothing: the server said nothing about any row.
 * </ul>
 *
 * @param memberNumber the number of the member whose profile the press was on, and never the
 *                     reader's own
 */
export async function theServerWasAsked(memberNumber: string): Promise<Answer> {
  const answer = await askTheServer(THE_QUESTION_GOES_TO, { memberNumber })

  if (answer.got === 'done') {
    clearResourceCache('me/applications')
  } else if (theServerSaysTheScreenIsStale(answer)) {
    clearResourceCache('me/applications')
    clearResourceCache('pairs')
  }

  return answer
}

/**
 * WHERE ONE ANSWER GOES.
 *
 * <p><b>The key is the QUESTION'S and not the pair's, which is a decision of 19.09.2026
 * rather than a curiosity</b>, and `PairWriteApi.answer` carries the whole of the reasoning:
 * „{@code GET /api/pairs} answers {@code racing_pair.id} and this write takes a
 * {@code pair_invite.id}, so two tables' keys meet at one address." It says the boundary
 * beside it too - the day `GET /api/pairs/{id}` is wanted, that decision is reopened - and
 * nothing here opens it: this is a write and there is no read at this address to disagree
 * with.
 */
export function theAnswerGoesTo(invite: number): string {
  return `/api/pairs/${String(invite)}`
}

/**
 * THE TWO REFUSALS `PUT /api/pairs/{id}` CAN NAME, each to a sentence in the dictionary.
 *
 * <p><b>Read off the route rather than remembered, and this is the list as the class really
 * declares it.</b> `PairWriteApi` declares seven `static final String` constants and only two
 * of them can come back from THIS route: `THE_FORM_IS_NOT_COMPLETE` for a body that names no
 * answer, and `THE_PAIR_WOULD_NOT_BE_MIXED` when the two turn out to be the same sex. The
 * other five belong elsewhere in the class or are not refusals at all -
 * `A_QUESTION_ALREADY_STANDS` and `A_PAIR_ALREADY_HOLDS` are `POST /api/pairs`'s, and
 * `THE_PAIR_IS_BROKEN`, `THE_LEAGUE` and `MAN` are a subject line, the league's name and the
 * letter a man's row carries.
 *
 * <p><b>THE FLOOR UNDER THIS LIST IS `pages/account/refusals.test.ts`</b>, which reads every
 * constant `PairWriteApi.java` declares and fails when the screens that meet the class answer
 * fewer refusals than it names. The class stands on it with two dictionaries, this one and
 * {@link WHEN_INVITING_INTO_A_PAIR} for the route that asks; until P2 (10.10.2026) the two
 * refusals of that route waited there for a screen, because `profile/InviteToPair.tsx` wrote its
 * question into the session and sent nothing.
 */
export const WHEN_ANSWERING_A_PAIR_INVITE: Record<string, string> = {
  theFormIsNotComplete: 'pair.answerRefused.theFormIsNotComplete',
  thePairWouldNotBeMixed: 'pair.answerRefused.thePairWouldNotBeMixed',
}

/**
 * Answers one invitation, and says what came back.
 *
 * <p><b>THE PAIRS AND THE INBOX ARE DROPPED ONLY WHERE THE SERVER AGREED</b>, which is the axis
 * this function cannot get wrong and is `member/inboxRead.ts`'s own rule in its own words: a
 * portal that dropped them on the asking would draw a pair that was never made. A refusal leaves
 * both exactly as the server last said they were; the one list a refusal does drop is named
 * below, with the reason.
 *
 * <p><b>AND WHICH CACHES DEPENDS ON THE ANSWER, because the two answers change different
 * things.</b> Both close the question, so the inbox is stale either way - the served line
 * comes back with no `pairInviteId` and the buttons are gone rather than offered again, which
 * is the same property `member/PairInviteAnswer.tsx` has by reading the pairs of this visit.
 * Only „Prihvati" touches `racing_pair`: `PairWriteApi.settle` deletes whatever pair either
 * half held for the season being formed and inserts the new one, so „Odbij" that dropped
 * `pairs` as well would be re-reading a resource nothing had changed, and a reader of this
 * function could no longer tell which of the two writes a pair.
 *
 * <p><b>Why `pairs` at all, when this screen never draws one.</b> The member's own profile
 * does (`profile/RacingPairLine.tsx`), and `app/Shell.tsx` holds every screen under one
 * outlet, so walking from this message to his profile without a fresh read would show him no
 * pair a moment after he made one. Clearing a second resource after a write is the portal's
 * own shape, not an invention here: `admin/Payments.tsx` drops two and `admin/AdminMembers.tsx`
 * drops eight.
 *
 * <p><b>AND WHAT HE WAITS ON (`me/applications`) EITHER WAY, since P2 (10.10.2026)</b>, because
 * his own profile draws the questions still standing off it - „Sopstveni profil nosi stanje:
 * tekući trkački par sa linkom, pozive koji čekaju (i poslate i primljene)" (PDL, 07.09.2026) -
 * and both answers close this one. <b>It is dropped on a refusal that says the screen was stale
 * as well</b> ({@link theServerSaysTheScreenIsStale}): the empty 404 is a question that is no
 * longer there, which that list would otherwise go on naming until the next visit. Nothing else
 * is dropped on a refusal: a refusal changes no pair and writes no message.
 *
 * @param invite  `pair_invite.id`, as the served line carries it
 * @param accepted „Prihvati" or „Odbij", and never absent. `PairWriteApi.Answered` boxes this
 *                 on purpose - „a body that names no answer at all is a form that was not
 *                 filled in, and a primitive would read it as „Odbij" and close somebody's
 *                 question for him" - so the field is always written here, and the refusal
 *                 that names its absence is answered anyway, for a request that went round
 *                 this screen
 */
export async function theServerWasAnswered(invite: number, accepted: boolean): Promise<Answer> {
  const answer = await askTheServer(theAnswerGoesTo(invite), { accepted }, 'PUT')

  if (answer.got === 'done') {
    if (accepted) {
      clearResourceCache('pairs')
    }

    clearResourceCache('me/applications')
    theInboxHasChanged()
  } else if (theServerSaysTheScreenIsStale(answer)) {
    clearResourceCache('me/applications')
  }

  return answer
}

/**
 * WHERE „RASKINI" GOES, AND THE KEY IS THE PAIR'S RATHER THAN THE QUESTION'S.
 *
 * <p><b>Two verbs at one path template take two tables' keys, and that is written down in the
 * journal rather than discovered here.</b> ADL A55 draws the line: „onog dana kad zatreba
 * {@code GET /api/pairs/&#123;id&#125;}, ista adresa nosi kljuc para na citanju i kljuc poziva
 * na upisu." `PairWriteApi.breakUp` is the third verb at that address and it carries the third
 * meaning of the three - `racing_pair.id`, which is the key `GET /api/pairs` hands out and the
 * only key this screen has in its hand. A55's own test still holds, because no single request
 * is ambiguous: a `PUT` means the invitation and a `DELETE` means the pair.
 *
 * <p><b>Spelt apart from {@link theAnswerGoesTo} even though the two build the same text
 * today.</b> They answer two different questions - one takes a `pair_invite.id` and the other a
 * `racing_pair.id` - so one function serving both would be the place where a screen could hand
 * over the wrong table's key and nothing would say so. The day A55's boundary triggers, one of
 * these two moves and the other does not.
 */
export function theBreakingGoesTo(pair: number): string {
  return `/api/pairs/${String(pair)}`
}

/**
 * Ends one pair on the server, and says what came back.
 *
 * <p><b>THE ROUTE NAMES NO REFUSAL AT ALL, AND THAT IS READ OFF IT RATHER THAN ASSUMED.</b>
 * `PairWriteApi.end` reaches for `nothingIsHere()` and never for `no(...)`, so the only answers
 * this can carry are 204 and a 404 with no reason in it - and that 404 deliberately covers four
 * callers at once: a pair that is not there, one that is not his, one of a season that is over, and one whose half
 * has stopped paying. Told apart, the numbers would answer which pairs exist and who is in them
 * to anybody walking the keys.
 *
 * <p><b>So the screen has no refusals map to hand {@code ServerSaid}, and the empty one it does
 * hand is honest rather than lazy.</b> What it hands in beside it is a table of what that one
 * number means (`profile/RacingPairLine.tsx`, `WHAT_THE_NUMBER_SAYS_WHEN_BREAKING_A_PAIR`). Until
 * 02.10.2026 a 404 read as `server.wrong` - „Server je odgovorio brojem 404 ... Pokusaj ponovo za
 * koji minut" - which is advice none of the four callers the 404 stands for can use (PENDING
 * stavka 316). The sentence it says now, `pair.breakRefused.notHeld`, says the same thing for all
 * four and does not promise that a second try will work; <b>its words are a proposal of the author
 * of that change and not the owner's text</b>.
 *
 * <p><b>`pairs` IS DROPPED AND THE INBOX IS NOT, WHICH IS THE ONE THING THIS FUNCTION COULD GET
 * WRONG.</b> {@link theServerWasAnswered} above drops the inbox because the member ANSWERING is
 * the one whose question closes, so his own next read is stale. Here the message
 * `PairWriteApi.end` writes goes to the OTHER half (`tell(...)`, the sentence built by
 * `theBrokenPairReads`), and nothing about the presser's own inbox has moved. Dropped anyway it
 * would be a screen re-reading a resource nothing had changed, and the next reader could no
 * longer tell which of this module's two writes touches whose mail.
 *
 * <p><b>And dropping `pairs` is only half of what makes the screen agree</b>, which is the
 * shape `admin/AdminTeams.tsx` states for its own deletion: „A screen that is still mounted
 * never asks its resource again." `useResource` reads once per mount, so this drop is for the
 * NEXT one; what takes the row off the screen the member is looking at is the caller writing
 * the break into the visit beside it.
 *
 * @param pair `racing_pair.id`, as `GET /api/pairs` answers it
 */
export async function theServerWasToldToBreakUp(pair: number): Promise<Answer> {
  const answer = await askTheServer(theBreakingGoesTo(pair), {}, 'DELETE')

  if (answer.got === 'done') {
    clearResourceCache('pairs')
  }

  return answer
}
