import { clearResourceCache } from '../../data/client'
import { theInboxHasChanged } from '../../data/useResource'
import { askTheServer, type Answer } from '../account/askTheServer'

/**
 * ANSWERING A SERVED INVITATION INTO A RACING PAIR, WHICH IS THE ONLY THING ON THIS PORTAL
 * THAT MAKES A PAIR ON THE SERVER.
 *
 * <p>Owner, PDL 27b, 27.09.2026, defining the outcome he chose by the question he asked it
 * with: „Pod 1 ako to podrazumeva da clan moze klikom na dugme da prihvati ili odbije poziv?"
 * The answer is yes, and `PUT /api/pairs/{id}` is the route that already existed to receive
 * it - what was missing was any screen that called it.
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
 * <p><b>THE FLOOR UNDER THIS LIST IS NOT WRITTEN AND THAT IS A BOUNDARY, NOT AN OVERSIGHT.</b>
 * `pages/account/refusals.test.ts` is the gate that reads a Java class's constants and fails
 * when a screen answers fewer than the route can name. Twelve files are on its list and
 * `PairWriteApi.java` is NOT one of them, measured with the gate's own regular expression
 * rather than by grepping for a name - `grep` over the name also finds the class's own javadoc
 * prose and answers too many.
 *
 * <p>Putting it on that list is a change to the gate and not to this screen, and it is larger
 * than it looks: the gate counts EVERY constant a file declares, so all seven would have to be
 * accounted for - three named in its `NOT_A_REASON` (a subject line, a name and a letter are
 * not refusals) and two in its `NOT_YET_ON_ANY_SCREEN` (`POST /api/pairs` is sent by no screen
 * at all; `profile/InviteToPair.tsx` writes the question into the session, measured
 * 28.09.2026 - `grep -rn "api/pairs" frontend/src` finds no caller outside comments). That is
 * a decision about the gate, so it is written down here for whoever takes it rather than taken
 * quietly in passing.
 *
 * <p><b>What stands in its place until then:</b> the two names above are read off
 * `PairWriteApi.answer` and `settle`, which are eleven lines apart, and
 * `member/pairInviteAnswered.test.tsx` draws each of the two sentences from a refusal the fake
 * server names. A third refusal added to that route would reach a reader as a code he cannot
 * read, which is exactly what the gate exists to prevent and exactly what is not prevented
 * here.
 */
export const WHEN_ANSWERING_A_PAIR_INVITE: Record<string, string> = {
  theFormIsNotComplete: 'pair.answerRefused.theFormIsNotComplete',
  thePairWouldNotBeMixed: 'pair.answerRefused.thePairWouldNotBeMixed',
}

/**
 * Answers one invitation, and says what came back.
 *
 * <p><b>THE CACHES ARE DROPPED ONLY WHERE THE SERVER AGREED</b>, which is the axis this
 * function cannot get wrong and is `member/inboxRead.ts`'s own rule in its own words: a
 * portal that dropped them on the asking would draw a pair that was never made. A refusal
 * leaves everything exactly as the server last said it was.
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

    theInboxHasChanged()
  }

  return answer
}
