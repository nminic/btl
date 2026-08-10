import { useMemo } from 'react'
import type { PendingItem } from '../../data/types'
import { useResource, type ResourceState } from '../../data/useResource'
import type { Decisions } from '../../session/context'
import { useSession } from '../../session/useSession'

/* What is waiting in the six queues that are read from a file.
 *
 * Results are the seventh and are not here: a competitor sends those in during
 * the visit, so they live in the session.
 *
 * Payments were not here either, and are now. A membership waiting to be
 * activated used to be read off the list of members, as the member who was not
 * active yet. It cannot be any more: a member number is handed out the moment the
 * fee is recorded (PDL P8, 30.07.2026), so somebody who has not paid has no
 * number, and without one they are not a row in the member list at all. They are
 * a registration waiting for a decision, which is what this file holds.
 *
 * That also keeps them off every public screen by construction rather than by
 * remembering to filter: three of them used to be on the front page under the
 * newest members, with numbers they should never have had, because everything
 * that reads the member list reads all of it (PDL P8, P11).
 *
 * One shape for all seven, with every field always present and empty where it
 * does not apply. The alternative is seven shapes and a screen that asks which
 * one it is holding, to show the same three lines either way.
 */
/**
 * Everything waiting for a decision: what is on the disc, and what this visit
 * has added to it.
 *
 * A competitor may propose a team, and a proposal is not a different kind of
 * thing from the teams already in the queue. Merged here rather than at each of
 * the seven screens, so the counters in the navigation, the queue itself and the
 * door that decides whether a section is empty all count the same items. One of
 * the three forgetting to merge is a moderator who is told there is nothing
 * waiting on a screen that is about to show them something.
 */
export function usePending(): ResourceState<PendingItem[]> {
  const state = useResource<PendingItem[]>('verification')
  const { proposals } = useSession()

  return useMemo(
    () =>
      state.status === 'ready' ? { status: 'ready', data: [...state.data, ...proposals] } : state,
    [state, proposals],
  )
}

/** Everything in one queue that nobody has decided on yet. The queues screen,
 *  the counters and the navigation all count through this, so they cannot
 *  disagree. */
export function waitingIn(
  items: PendingItem[],
  decisions: Decisions,
  queue: string,
): PendingItem[] {
  return items.filter((one) => one.queue === queue && decisions[one.id] === undefined)
}

/* A decision about a membership fee used to be remembered under a key of its own,
 * "pay-000012", because the queue was read off the member list and a member
 * number and the id of an item from this file shared one record: 000012 must
 * never have meant two things. A registration now carries an id from the same
 * file as everything else, so there is nothing left to keep apart and the key is
 * the id, on all six queues alike. */
