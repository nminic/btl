import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Unreadable } from '../components/Unreadable'
import type { Competitor, WhatIsWaiting } from '../data/types'
import { useWhatIsWaiting } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import type { Answer } from './account/askTheServer'
import { ServerSaid } from './account/ServerSaid'
import {
  theApplicationWasSent,
  theApplicationWasTakenBack,
  WHEN_APPLYING_TO_A_TEAM,
} from './joiningThisTeam'

/**
 * THE MEMBER'S OWN HALF OF A TEAM'S PAGE: „Prijavi se u tim" AND „Povuci prijavu", BOTH ON THE
 * SERVER SINCE T5 (10.10.2026).
 *
 * <p>Owner, PDL P13: „Učlanjenje ide u oba smera kroz portal: takmičar šalje administratoru tima
 * zahtev na odobrenje, ili administrator šalje takmičaru poziv." Until this component both buttons
 * wrote into `session/SessionProvider.tsx` and nowhere else (QA review of 09.10.2026, row 4), so
 * the team never saw the application, whose own list has come off
 * `GET /api/teams/{id}/applications` since 29.09.2026, and a reload took it away.
 *
 * <p><b>WHAT IS DRAWN IS WHAT THE SERVER SAYS THE MEMBER WAITS ON, NEVER THE PRESS.</b> Both buttons
 * are drawn off `GET /api/me/applications`, which answers his own applications across every team,
 * and after a press the server agreed to that answer is asked for again (`useWhatIsWaiting`'s
 * `revision`). The shape is `event/GoingToEvent.tsx`'s, the other switch a member presses for
 * himself on a public page.
 *
 * <ul>
 * <li><b>„Prijavi se u tim"</b>: PDL 05.09.2026, „član vidi dugme 'Prijavi se u tim' na strani
 * tima, samo tokom prelaznog perioda"; the conditions about the member and the team come from
 * `TeamDetail.tsx` (`mayApply`), and the one about what he waits on is answered here, by PDL
 * 06.09.2026: „„Prijavi se u tim" se crta samo kad član nema nijednu prijavu u letu, traženo po
 * broju člana kroz sve timove".
 * <li><b>„Povuci prijavu"</b>: on the team the application names and nowhere else, and on every
 * day of the year whatever team the member has since come by. PDL 06.09.2026: „[IZVEDENO]
 * Prijava u oba slučaja ostaje njegova da je povuče, pa i dalje ima kraj koji ne zavisi ni od koga
 * drugog." `TeamJoiningWriteApi.withdraw` carries no window either.
 * </ul>
 *
 * <p><b>NOTHING AT ALL FOR A READER THE LIST OF MEMBERS DOES NOT CARRY, AND NOTHING IS ASKED FOR
 * HIM.</b> A visitor, an account that races for nobody and a member whose fee has lapsed have no
 * record on `/api/competitors`; the first two cannot ask a team anything, and of the third the owner
 * said on 19.09.2026 „sve akcije za njega se brane" - which is also what both routes answer him
 * (`TeamJoiningWriteApi.heIsStillAMember`, and `c.active` in `withdrawing`). Asked anyway, the read
 * would be spent on a page that can draw nothing from it.
 *
 * <p><b>WHY A RENDER PROP AND NOT A ROW OF ITS OWN.</b> The two buttons stand in the row of
 * controls beside the team's name, „kao „Izmeni" i „Obriši"" (PDL 05.09.2026), and what is said
 * about them - a refusal, or that what he waits on could not be read - stands under that row and
 * not inside it, for the reason `TeamDetail.tsx` gives over the sentence about a deletion: put
 * among the buttons, a sentence is a flex item in the narrow second track of that grid. One
 * component has to put things in two places of the page's own markup, so the page lays them out
 * and this hands them over.
 *
 * <p><b>WHILE IT IS READ, NOTHING</b>, which is `useTeamQueue.ts`'s answer to the same question
 * and keeps a loader out of the row of controls. <b>A read that failed SAYS SO</b>, under the row,
 * with the way to ask again (decision of 02.10.2026, PENDING stavka 368, in the PDL's words: „Spisak
 * koji ne moze da se ucita KAZE to, umesto da izgleda prazan"), and draws neither button: with
 * nothing known about what he waits on, „Prijavi se u tim" could be a second application and
 * „Povuci prijavu" has no key to send.
 */
export function AskingThisTeam({
  me,
  mayApply,
  team,
  standing,
  here,
  children,
}: {
  /** The reader's own record on the list this page reads, or nothing for a reader it does not carry. */
  me: Competitor | undefined
  /** Whether everything about the member and the team lets him ask: no team on his record,
   *  somebody to answer for this one, and the transfer window. Worked out by the page, which
   *  has all three in hand. */
  mayApply: boolean
  /** `team.id`, which both routes take in their path. */
  team: number
  /** Whether a team is still on the page's list, so an application to a team that is gone stops
   *  counting (review, 06.09.2026: „An application about a team that is gone is about nothing"). */
  standing: (team: number) => boolean
  /** The page the refusal was drawn on, which is a team and a season (registry item 311). */
  here: string
  children: (mine: MyQuestion) => ReactNode
}) {
  if (me === undefined) {
    return <>{children({ controls: null, said: null })}</>
  }

  return (
    <ForAMember mine={me.memberNumber} mayApply={mayApply} team={team} standing={standing} here={here}>
      {children}
    </ForAMember>
  )
}

/** What this half hands the page: the buttons for the row of controls, and what is said under it. */
export type MyQuestion = {
  controls: ReactNode
  said: ReactNode
}

/** Why the last press did not do what it said, and the dictionary of the verb that was sent. */
type Refused = { answer: Exclude<Answer, { got: 'done' }>; refusals: Record<string, string> }

function ForAMember({
  mine,
  mayApply,
  team,
  standing,
  here,
  children,
}: {
  mine: string
  mayApply: boolean
  team: number
  standing: (team: number) => boolean
  here: string
  children: (mine: MyQuestion) => ReactNode
}) {
  const { t } = useI18n()
  const [revision, setRevision] = useState(0)
  const state = useWhatIsWaiting(mine, revision)
  /** While a press is out, which is what both buttons say out loud (`aria-disabled`). */
  const [sending, setSending] = useState(false)
  const [refused, setRefused] = useState<Refused | null>(null)
  /**
   * A SECOND PRESS WHILE THE FIRST IS STILL OUT, and a ref rather than the state beside it, for
   * the reason `member/ServedTeamInvite.tsx` gives: two presses dispatched inside one task both
   * read the state as it was. Sent twice, „Prijavi se u tim" is answered `aQuestionAlreadyStands`
   * over an application that has just gone through.
   */
  const outstanding = useRef(false)
  /**
   * THE ANSWER THAT WAS ON THE SCREEN WHEN A PRESS WENT THROUGH, held until the read that replaces
   * it has landed.
   *
   * <p><b>The buttons stay told off until then</b>, which is `useTeamQueue.ts`'s reason in its own
   * words: released earlier, „the reader would get one render in which the row is live again and
   * already answered". The read that replaces it is a new object - the cache was dropped where the
   * server agreed (`joiningThisTeam.ts`) - so the old one being gone is what says it has landed, and
   * a read that failed instead lets go as well, because then there is nothing left to wait for.
   */
  const replacing = useRef<WhatIsWaiting | null>(null)
  const join = useRef<HTMLButtonElement>(null)
  const withdraw = useRef<HTMLButtonElement>(null)
  /**
   * THE PAGE THE REFUSAL WAS DRAWN ON, and it goes when the page stops being that one: this half
   * stays mounted across teams, because `TeamDetail` does (`app/routeObjects.tsx` carries no `key`
   * on that route). The adjusting-state-during-render shape `TeamDetail.tsx` holds for the refusal
   * of a deletion, for the same reason.
   */
  const [drawnOn, setDrawnOn] = useState(here)

  if (drawnOn !== here) {
    setDrawnOn(here)
    setRefused(null)
  }

  useLayoutEffect(() => {
    if (replacing.current === null || (state.status === 'ready' && state.data === replacing.current)) {
      return
    }

    replacing.current = null
    outstanding.current = false
    setSending(false)

    /* AND THE KEYBOARD GOES TO THE BUTTON THAT REPLACED THE ONE PRESSED, which left the document
       with the focus on it. Only where the focus fell to the body: a reader who moved on while it
       was asked is not followed, which is `components/Resource.tsx`'s own reason. */
    if (document.activeElement === document.body) {
      const standingNow = withdraw.current ?? join.current

      standingNow?.focus()
    }
    /* On every new answer and on nothing else: the read landing, or failing, is the one thing
       that lets the press go, and a ref changing is not a render. */
  }, [state])

  async function press(
    ask: () => Promise<Answer>,
    refusals: Record<string, string>,
    shown: WhatIsWaiting,
  ): Promise<void> {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setSending(true)
    setRefused(null)

    const answer = await ask()

    if (answer.got !== 'done') {
      outstanding.current = false
      setSending(false)
      setRefused({ answer, refusals })

      return
    }

    replacing.current = shown
    setRevision((was) => was + 1)
  }

  if (state.status === 'loading') {
    return <>{children({ controls: null, said: null })}</>
  }

  if (state.status === 'error') {
    return (
      <>
        {children({
          controls: null,
          said: (
            <Unreadable said={t('data.error')} reading={state.reading} onRetry={state.readAgain} />
          ),
        })}
      </>
    )
  }

  const waiting = state.data
  /* HIS application to THIS team, read off the row by the team it names: the route takes both the
     team and the row, and the button stands only on the page of the team the row names, so the two
     are one number here by construction. */
  const his = waiting.teamApplications.find((one) => one.teamId === team)
  const offerToApply = mayApply && !waiting.teamApplications.some((one) => standing(one.teamId))

  return (
    <>
      {children({
        controls: (
          <>
            {offerToApply && (
              <button
                ref={join}
                type="button"
                className="button button--secondary"
                aria-disabled={sending ? true : undefined}
                onClick={() => {
                  void press(() => theApplicationWasSent(team), WHEN_APPLYING_TO_A_TEAM, waiting)
                }}
              >
                {t('teams.join')}
              </button>
            )}
            {his !== undefined && (
              <button
                ref={withdraw}
                type="button"
                className="button button--secondary"
                aria-disabled={sending ? true : undefined}
                onClick={() => {
                  /* No dictionary: the route names no reason (`joiningThisTeam.ts`). */
                  void press(() => theApplicationWasTakenBack(his.teamId, his.id), {}, waiting)
                }}
              >
                {t('teams.joinWithdraw')}
              </button>
            )}
          </>
        ),
        said:
          refused === null ? null : (
            <ServerSaid answer={refused.answer} refusals={refused.refusals} />
          ),
      })}
    </>
  )
}
