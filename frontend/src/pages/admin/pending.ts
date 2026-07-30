import { useResource } from '../../data/useResource'
import type { Decisions } from '../../session/context'

/* What is waiting in the six queues that are read from a file.
 *
 * Results are not here: a competitor sends those in during the visit, so they
 * live in the session. Payments are not here either: a membership waiting to be
 * activated is a member who is not active yet, and that is already in the list
 * of members. The other six have no table anywhere yet, so until the database
 * arrives they are generated data, like every other screen in the prototype.
 *
 * One shape for all six, with every field always present and empty where it
 * does not apply. The alternative is six shapes and a screen that asks which one
 * it is holding, to show the same three lines either way.
 */
export const PENDING_QUEUE_IDS = [
  'leagues',
  'teams',
  'bios',
  'photos',
  'comments',
  'schedule',
] as const

export type PendingQueueId = (typeof PENDING_QUEUE_IDS)[number]

export type PendingItem = {
  id: string
  queue: PendingQueueId
  /** The day it arrived in the queue. */
  date: string
  /** Who sent it in, or empty. A change of date may be reported by somebody
   *  with no account at all (PDL P10). */
  memberNumber: string
  who: string
  /** What the decision is about: the name of the league, the team, the member
   *  or the event. */
  subject: string
  /** The text to read before deciding: the biography, the comment, the reason
   *  given, or the file name of a picture. */
  body: string
  /** A reported change of date carries both dates, so the difference is the
   *  thing on screen. Empty on every other queue. */
  currentDate: string
  proposedDate: string
}

export const usePending = () => useResource<PendingItem[]>('verification')

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

/** And everything in it that has been decided during this visit. */
export function settledIn(
  items: PendingItem[],
  decisions: Decisions,
  queue: string,
): PendingItem[] {
  return items.filter((one) => one.queue === queue && decisions[one.id] !== undefined)
}

/** The key a decision about a membership fee is remembered under. Prefixed
 *  because a member number and the id of an item from the file share one
 *  record, and 000012 must never mean two things. */
export function paymentKey(memberNumber: string): string {
  return `pay-${memberNumber}`
}
