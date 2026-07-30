import type { Competitor } from '../../data/types'
import type { Decisions } from '../../session/context'
import { paymentKey, waitingIn, type PendingItem } from './pending'

/* "Red za proveru" was one queue for results. It is now one story, because a
 * moderator approves a great deal more than results, and every one of these
 * comes from a decision that was already written down (PDL P28a).
 *
 * All eight have a screen, and every screen asks the same two questions: is this
 * good enough to publish, and if not, why not. Sending something back always
 * carries a reason; approving never does.
 */
export type Queue = {
  id: string
  labelKey: string
  sourceKey: string
  path: string
}

const ADDRESS = 'administracija/verifikacija'

export const QUEUES: Queue[] = [
  {
    id: 'results',
    labelKey: 'verification.results',
    sourceKey: 'verification.fromResults',
    path: `${ADDRESS}/rezultati`,
  },
  {
    id: 'payments',
    labelKey: 'verification.payments',
    sourceKey: 'verification.fromPayments',
    path: `${ADDRESS}/uplate`,
  },
  {
    id: 'leagues',
    labelKey: 'verification.leagues',
    sourceKey: 'verification.fromLeagues',
    path: `${ADDRESS}/lige`,
  },
  {
    id: 'teams',
    labelKey: 'verification.teams',
    sourceKey: 'verification.fromTeams',
    path: `${ADDRESS}/timovi`,
  },
  {
    id: 'bios',
    labelKey: 'verification.bios',
    sourceKey: 'verification.fromBios',
    path: `${ADDRESS}/biografije`,
  },
  {
    id: 'photos',
    labelKey: 'verification.photos',
    sourceKey: 'verification.fromPhotos',
    path: `${ADDRESS}/slike`,
  },
  {
    id: 'comments',
    labelKey: 'verification.comments',
    sourceKey: 'verification.fromComments',
    path: `${ADDRESS}/komentari`,
  },
  {
    id: 'schedule',
    labelKey: 'verification.schedule',
    sourceKey: 'verification.fromSchedule',
    path: `${ADDRESS}/termini`,
  },
]

/** The same eight by id, so a screen can be handed the queue it serves instead
 *  of looking it up and then proving it found something. */
export const QUEUE: Record<string, Queue> = Object.fromEntries(
  QUEUES.map((one) => [one.id, one]),
)

export type Waiting = {
  /** Results a competitor sent in during this visit and nobody has judged. */
  pendingResults: number
  competitors: Competitor[]
  items: PendingItem[]
  decisions: Decisions
}

/**
 * How many items each queue holds. One function, because the number beside a
 * queue, the number on the verification list and the number beside Verification
 * in the navigation are the same number, and two ways of counting it would
 * eventually be two different numbers.
 *
 * Two of the eight are counted from something other than the file of waiting
 * items: results from the session, and memberships from the members who are not
 * active yet.
 *
 * The queue of dates counts the reports somebody sent in, and nothing else. A
 * date is also under check when its freshness clock runs out (PDL P10), and the
 * calendar used to be counted for that here. It cannot be: an event carries no
 * clock, so there is nothing for a moderator to read and no way to settle it,
 * and the screen behind the row shows only the reports. The row said four while
 * the screen showed three, and the fourth could never be worked off. It comes
 * back when an event carries the date of its last confirmation, who confirmed it
 * and from where, which arrives with the database.
 */
export function countsFor({
  pendingResults,
  competitors,
  items,
  decisions,
}: Waiting): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const queue of QUEUES) {
    counts[queue.id] = waitingIn(items, decisions, queue.id).length
  }

  counts.results = pendingResults
  counts.payments = competitors.filter(
    (one) => !one.active && decisions[paymentKey(one.memberNumber)] === undefined,
  ).length

  return counts
}

/** Everything waiting for a moderator as one number, which is what stands beside
 *  Verification in the navigation (PDL P28a). */
export function totalWaiting(waiting: Waiting): number {
  const counts = countsFor(waiting)

  return QUEUES.reduce((sum, queue) => sum + counts[queue.id], 0)
}
