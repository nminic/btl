import { useLayoutEffect, useRef, useState } from 'react'
import { Unreadable } from '../../components/Unreadable'
import { pairOf } from '../../data/derive'
import { transfersTakeEffect } from '../../data/season'
import type { Competitor, RacingPair, WhatIsWaiting } from '../../data/types'
import { useWhatIsWaiting } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { useToday } from '../../clock/useClock'
import type { Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  theServerSaysTheScreenIsStale,
  theServerWasAsked,
  WHAT_THE_NUMBER_SAYS_WHEN_INVITING_INTO_A_PAIR,
  WHEN_INVITING_INTO_A_PAIR,
} from '../member/pairWrites'

/**
 * „Pozovi u trkački par", on somebody else's profile, and since P2 (10.10.2026) on the server.
 *
 * **The owner chose this door out of three** (07.09.2026: „Poslušaću predlog broj 1, tvoju
 * preporuku"), and the reason he was offered it first is that it introduces no new idea: the portal
 * already asks one named person a question by putting it in their inbox, and a member already knows
 * that shape from teams. `profile/InviteToTeam.tsx` is the same act for a team and went to the
 * server the same day (T5), and this is written from it rather than beside it.
 *
 * **WHAT IT WRITES: NOTHING IN THE BROWSER.** Until P2 the press wrote the question and the message
 * that carries it into `session/SessionProvider.tsx`, so the member asked never saw it and no pair
 * could be made (QA review of 09.10.2026, row 5). `POST /api/pairs` writes both
 * (`PairWriteApi.ask`), and the inbox of the member asked answers it with „Prihvati" and „Odbij"
 * (`member/ServedPairInvite.tsx`).
 *
 * **Who sees it, and every condition is a decision rather than a guess** (PDL, „Trkački par"):
 *
 * - a signed-in member, because a pair is made of two members;
 * - of the **opposite** sex, because a pair is one man and one woman;
 * - when **neither of them** already has a pair for the season being formed, because a member is in
 *   one pair at a time;
 * - and when no question is already standing between the two of them, in either direction, which is
 *   also the answer to „did my press register". That one is read off the server
 *   ({@link AskingIntoAPair}); the three above are read off what this page already holds.
 *
 * **What is not a condition, and it looks like one.** „Formiranje mora biti završeno do 31. decembra
 * da bi trkački par važio u novoj sezoni" (PDL P13) reads like a deadline that closes the button at
 * some point in the year. It is not: every day of a year is before the end of that year, so nothing
 * is ever refused. What the sentence really fixes is **which season** a pair holds for.
 *
 * **And it fixes it on the day the pair is finished, not on the day it is asked for** (review,
 * 07.09.2026): forming ends with the other one confirming. So the season worked out here is only
 * for the question the button asks, and the server works it out again on the day the answer comes
 * (`PairWriteApi.settle`, `seasonBeingFormed`). Asked on 31 December and answered on 2 January, a
 * pair belongs to the season after next, which is what „mora biti završeno do 31. decembra" says.
 *
 * There is no condition against inviting yourself: the two are of different sexes, so they cannot be
 * the same person. Written down because an absent check is the kind of thing a later reader adds
 * back.
 */
export function InviteToPair({
  competitor,
  competitors,
  pairs,
}: {
  /** Whose profile is being read. */
  competitor: Competitor
  competitors: Competitor[]
  /** The pairs that hold now, the file and this visit together (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
}) {
  const today = useToday()
  const { memberNumber: reader } = useSession()

  const me = competitors.find((one) => one.memberNumber === reader)
  /* The season a pair confirmed today would hold for: the next one. Read off the day rather than
     off the season picker, because the rule is about the calendar and not about what is being
     looked at (PDL P13).
   *
     **Worked out again when the answer comes, and this one is only for the question**: „Formiranje
     mora biti završeno do 31. decembra" puts the deadline on the finishing, and a pair is finished
     when the other one confirms. Asked on 31 December and answered on 2 January, the pair belongs
     to the season after next, and the button here has no way to know that (review, 07.09.2026).
   *
     **And it is the portal's own answer to „which season does a change take effect in", not a
     second one written beside it** (review, 07.09.2026). `transfersTakeEffect` says exactly this
     for a club and carries the floor that a hand-written year does not: before the league has a
     season there is nothing to join, so the answer is never earlier than `FIRST_SEASON`. Without
     it a clock set to 2025 wrote a pair for 2026, a season the league does not have, which is the
     same fault that was measured on a club a day earlier. */
  const season = transfersTakeEffect(today)

  if (
    me === undefined ||
    me.gender === competitor.gender ||
    pairOf(pairs, me.memberNumber, season) !== null ||
    pairOf(pairs, competitor.memberNumber, season) !== null
  ) {
    return null
  }

  /* Keyed by the two of them, so a press, a refusal or a read about one profile is never drawn on
     the next, and none of it outlives the reader it was for: the profile is one component across
     every member's address (`app/routeObjects.tsx` carries no `key` on that route), and signing in
     as somebody else happens in place. The shape `profile/InviteToTeam.tsx` keys its own half by. */
  return (
    <AskingIntoAPair
      key={`${me.memberNumber}/${competitor.memberNumber}`}
      mine={me.memberNumber}
      whom={competitor.memberNumber}
    />
  )
}

/**
 * THE BUTTON, OR IN ITS PLACE THAT A QUESTION ALREADY STANDS BETWEEN THE TWO, read off the server.
 *
 * <p>PDL, 07.09.2026: the button is seen only when „među njima ne stoji već poslat poziv, ni u
 * jednom smeru". What stands is `GET /api/me/applications`, which answers the reader's own questions
 * in both directions and names the OTHER member of each by number (`MyApplicationsApi.pairInvites`),
 * so „a question stands between us" is one row naming the member on this page, whichever of the two
 * asked. It is the set `PairWriteApi.aQuestionStandsBetween` refuses a second question over, so
 * what is drawn and what the route would refuse cannot come apart.
 *
 * <p><b>NOTHING WHILE IT IS READ, AND A LIST THAT COULD NOT BE READ SAYS SO</b>, with the way to ask
 * again: the answer `profile/InviteToTeam.tsx` gives directly above this button, and its reading of
 * the decision of 02.10.2026 (PENDING stavka 368, in the PDL's words: „Spisak koji ne moze da se
 * ucita KAZE to, umesto da izgleda prazan"). The list is not drawn here, but the button is a claim
 * that no question stands, so drawing it over a list nobody read would be the empty list the
 * decision forbids.
 *
 * <p><b>After a press the list is read again before the press lets go</b>, the order
 * `pages/AskingThisTeam.tsx` keeps for the same answer: the cache is dropped where the server
 * agreed (`member/pairWrites.ts`) and the revision asks for it again, so „poslat" stands where the
 * button stood because the server says the question stands, never because a button was pressed. It
 * takes the focus the button left with, the arrangement `event/GoingToEvent.tsx` holds for the line
 * that replaces its form.
 *
 * <p><b>And it is read again after a refusal that says this page was stale</b>
 * (`theServerSaysTheScreenIsStale`). Derived 10.10.2026 and not the owner's word, from the remedy of
 * the medium finding on PR 516 („na odbijanje bilo koje od dve rute baciti `me/applications` i
 * povećati `revision`"): a question asked from another tab, or by her in the meantime, is refused
 * `aQuestionAlreadyStands`, and the read that follows puts „poslat" in the button's place instead of
 * leaving a button the route will refuse every time. A refusal the list cannot answer - a pair that
 * has since formed, a member who is no longer one - stays under the button, which still stands: the
 * pairs and the members are this page's own read, and the boundary is written over
 * `theServerWasAsked`.
 */
function AskingIntoAPair({ mine, whom }: { mine: string; whom: string }) {
  const { t } = useI18n()
  const [revision, setRevision] = useState(0)
  const state = useWhatIsWaiting(mine, revision)
  /** While a press is out, which is what the button says out loud (`aria-disabled`). */
  const [sending, setSending] = useState(false)
  const [refused, setRefused] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  /**
   * A SECOND PRESS WHILE THE FIRST IS STILL OUT, and a ref rather than the state beside it, for the
   * reason `member/ServedPairInvite.tsx` gives: two presses dispatched inside one task both read the
   * state as it was. Sent twice, the second is answered `aQuestionAlreadyStands` over a question the
   * first has just written.
   */
  const outstanding = useRef(false)
  /**
   * THE ANSWER THAT WAS ON THE SCREEN WHEN THE PRESS CAME BACK, held until the read that replaces it
   * has landed, which is `pages/AskingThisTeam.tsx`'s own arrangement and reason: let go earlier,
   * the reader would get one render in which the button is live again over a question the server
   * already holds. The read that replaces it is a new object - the cache was dropped
   * (`member/pairWrites.ts`) - so the old one being gone is what says it has landed, and a read that
   * failed instead lets go as well, because then there is nothing left to wait for.
   *
   * <p><b>No case can hold the half of the effect below that waits while the old object is still
   * the answer</b>, and that is measured rather than forgotten (10.10.2026): its condition cut down to
   * `replacing.current === null` keeps all thirty cases of `pages/pairInviteOnTheServer.test.tsx`
   * green. Both answers that ask for the list again
   * drop the cache before the number moves, so the read that follows is always a new object and the
   * half is never reached. It stays because it is `pages/AskingThisTeam.tsx`'s shape, which has the
   * same half for the same reason; the two go or stay together, in one change that touches both.
   */
  const replacing = useRef<WhatIsWaiting | null>(null)
  /**
   * THE REFUSAL THAT SENT THE LIST TO BE READ AGAIN, said only once the read has landed.
   *
   * <p>Said at once, a refusal the list then answers would be said twice over: `aQuestionAlreadyStands`
   * is the same words as the sentence that takes the button's place (`WHEN_INVITING_INTO_A_PAIR`), so
   * the reader would hear it as an alert under a button and then again where the button stood. Held
   * until the read lands, it is drawn only where the list does not answer it, under the button that
   * still stands.
   */
  const refusing = useRef<Exclude<Answer, { got: 'done' }> | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    if (replacing.current === null || (state.status === 'ready' && state.data === replacing.current)) {
      return
    }

    replacing.current = null
    outstanding.current = false
    setSending(false)
    setRefused(refusing.current)
    refusing.current = null

    /* AND THE KEYBOARD GOES TO THE SENTENCE THAT REPLACED THE BUTTON PRESSED, which left the
       document with the focus on it. Only where the focus fell to the body: a reader who moved on
       while it was asked is not followed, which is `components/Resource.tsx`'s own reason, and
       where the button still stands the focus never left it. */
    if (document.activeElement === document.body) {
      said.current?.focus()
    }
    /* On every new answer and on nothing else: the read landing, or failing, is the one thing that
       lets the press go, and a ref changing is not a render. */
  }, [state])

  async function send(shown: WhatIsWaiting): Promise<void> {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setSending(true)
    setRefused(null)

    const answer = await theServerWasAsked(whom)

    if (answer.got === 'done' || theServerSaysTheScreenIsStale(answer)) {
      refusing.current = answer.got === 'done' ? null : answer
      replacing.current = shown
      setRevision((was) => was + 1)

      return
    }

    /* The server said nothing about any row - a 5xx, a refused token, no answer at all - so there
       is nothing to read again, and pressing again is what helps. */
    setRefused(answer)
    outstanding.current = false
    setSending(false)
  }

  if (state.status === 'loading') {
    return null
  }

  if (state.status === 'error') {
    return <Unreadable said={t('data.error')} reading={state.reading} onRetry={state.readAgain} />
  }

  const waiting = state.data

  /* THE MEMBER ON THIS PAGE, by number, among the reader's questions: never „the list has
     something on it", which would be a reader who has asked anybody at all, never only the
     questions he sent, which would leave one asked of him standing beside a button, and never a
     row with no number, which is somebody whose fee has lapsed and not the member on this page. */
  if (waiting.pairInvites.some((one) => one.memberNumber === whom)) {
    return (
      <p className="profile__invited" tabIndex={-1} ref={said}>
        {t('pair.asked')}
      </p>
    )
  }

  return (
    <>
      <button
        type="button"
        className="button button--secondary"
        aria-disabled={sending ? true : undefined}
        onClick={() => {
          void send(waiting)
        }}
      >
        {t('pair.invite')}
      </button>
      {/* Under the button and never in its place: what is left of a refusal once the list has been
          read again is one the list cannot answer, and the button is still the way to ask. */}
      {refused !== null && (
        <ServerSaid
          answer={refused}
          refusals={WHEN_INVITING_INTO_A_PAIR}
          numbers={WHAT_THE_NUMBER_SAYS_WHEN_INVITING_INTO_A_PAIR}
        />
      )}
    </>
  )
}
