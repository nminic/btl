import { useCallback, useEffect, useRef, useState } from 'react'
import type { Answer } from './account/askTheServer'
import {
  theApplicationWasAnswered,
  theInvitationWasTakenBack,
  whatIsWaitingOn,
  whatThisTeamHasAsked,
  type TeamApplication,
  type TeamInvitation,
} from './teamQueue'

/**
 * WHAT THE TEAM'S PAGE NEEDS TO DRAW ITS TWO QUEUES, AND WHAT HAPPENS WHEN SOMEBODY PRESSES.
 *
 * <p>The shape `member/useMyCategory.ts` already uses for the other read on this portal that
 * is not a resource: the lists are empty until the read comes back and stay empty where there
 * is nothing to draw, so the screen's condition is `length > 0` and nothing about the fee, the
 * roster or the transfer window is asked on this side to decide whether a row exists.
 */

/** Which row a press is about. The two lists have their own key spaces, so the kind is half
 *  of the name and not decoration: application 7 and invitation 7 are two different rows. */
export type QueueRow = { kind: 'application' | 'invitation'; id: number }

/** Why a press did not do what it said, for the one row it was pressed on. */
export type QueueRefusal = { row: QueueRow; answer: Exclude<Answer, { got: 'done' }> }

export type TheTeamsQueue = {
  applications: TeamApplication[]
  invitations: TeamInvitation[]
  /** Whether this row has a request out, so its controls can say so out loud. */
  busy: (row: QueueRow) => boolean
  refused: QueueRefusal | null
  decide: (application: number, accepted: boolean) => Promise<void>
  takeBack: (invitation: number) => Promise<void>
}

function theSameRow(one: QueueRow, two: QueueRow): boolean {
  return one.kind === two.kind && one.id === two.id
}

export function useTeamQueue(team: number): TheTeamsQueue {
  const [applications, setApplications] = useState<TeamApplication[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  /**
   * WHICH ROWS HAVE A REQUEST OUT, as a render can see them.
   *
   * <p>The same fact as {@link outstanding} below and deliberately a second copy of it. React
   * state is what a render reads, and a ref is what a handler reads; one of the two alone
   * cannot do both jobs, which is the finding of the review of PR 411 („a value set inside
   * this handler is not visible to a second click fired before the render it would cause").
   * `member/Membership.tsx` keeps exactly this pair for exactly this reason.
   */
  const [acting, setActing] = useState<QueueRow[]>([])
  const [refused, setRefused] = useState<QueueRefusal | null>(null)
  /**
   * WHICH ROWS HAVE A REQUEST OUT, as the handler sees them, and it is a LIST rather than one
   * row.
   *
   * <p><b>The lock is on the row and not on the screen</b>, because two rows are two questions
   * about two different people and answering one must not hold the other up. Written as „is
   * anything out" it would be wrong in the tiring direction, and written as „which single row
   * is out" it would be wrong in the dangerous one: a press on row B would overwrite the note
   * that row A is still out, row A's own `finally` would then clear it, and a third press on B
   * would go through while B's first request was still travelling. A list has neither fault.
   */
  const outstanding = useRef<QueueRow[]>([])
  /** Whether the screen is still there, so a read that comes back to nobody writes nothing. */
  const here = useRef(true)

  const read = useCallback(async (): Promise<void> => {
    /* BOTH LISTS AT ONCE, because they are two answers to one question and a screen that
       showed a fresh queue beside a stale one would be telling the team two different
       moments. They are two routes only because the two acts are two verbs on two paths. */
    const [asking, asked] = await Promise.all([
      whatIsWaitingOn(team),
      whatThisTeamHasAsked(team),
    ])

    if (here.current) {
      setApplications(asking)
      setInvitations(asked)
    }
  }, [team])

  useEffect(() => {
    here.current = true

    void read()

    return () => {
      here.current = false
    }
  }, [read])

  /**
   * ONE PRESS, WHATEVER IT WAS, AND THE WHOLE OF WHAT IS COMMON TO THE THREE.
   *
   * <p><b>The list is read again only where the server AGREED</b>, and it is read again there
   * always: the two write routes answer 204, so they answer NOTHING about what stands
   * afterwards, and these two lists are not resources that dropping a cache could refresh.
   * A refusal leaves the screen exactly as the server last said it was.
   *
   * <p><b>The re-read is awaited inside the guard</b>, so the row's controls stay told-off
   * until the list that replaces them has arrived. Released earlier, the reader would get one
   * render in which the row is live again and already answered.
   *
   * <p><b>One refusal at a time, and any new press clears it.</b> It names its row, so it can
   * be drawn under the row it belongs to; and a sentence about a press two presses ago is not
   * something a reader is still asking about.
   */
  const send = useCallback(
    async (row: QueueRow, ask: () => Promise<Answer>): Promise<void> => {
      if (outstanding.current.some((one) => theSameRow(one, row))) {
        return
      }

      outstanding.current = [...outstanding.current, row]
      setActing((were) => [...were, row])
      setRefused(null)

      try {
        const answer = await ask()

        if (answer.got === 'done') {
          await read()
        } else {
          setRefused({ row, answer })
        }
      } finally {
        /* In a `finally`, so a route that rejects outright still lets the next press in - the
           same correction `admin/Payments.tsx` and `member/Membership.tsx` both carry. */
        outstanding.current = outstanding.current.filter((one) => !theSameRow(one, row))
        setActing((were) => were.filter((one) => !theSameRow(one, row)))
      }
    },
    [read],
  )

  const decide = useCallback(
    async (application: number, accepted: boolean): Promise<void> =>
      send({ kind: 'application', id: application }, () =>
        theApplicationWasAnswered(team, application, accepted),
      ),
    [send, team],
  )

  const takeBack = useCallback(
    async (invitation: number): Promise<void> =>
      send({ kind: 'invitation', id: invitation }, () =>
        theInvitationWasTakenBack(team, invitation),
      ),
    [send, team],
  )

  const busy = useCallback(
    (row: QueueRow): boolean => acting.some((one) => theSameRow(one, row)),
    [acting],
  )

  return { applications, invitations, busy, refused, decide, takeBack }
}
