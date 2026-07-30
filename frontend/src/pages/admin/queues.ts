import type { BtlEvent, Competitor } from '../../data/types'
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
  events: BtlEvent[]
  items: PendingItem[]
  decisions: Decisions
}

/**
 * How many items each queue holds. One function, because the number beside a
 * queue, the number on the verification list and the number beside Verification
 * in the navigation are the same number, and two ways of counting it would
 * eventually be two different numbers.
 *
 * Three of the eight are counted from something other than the file of waiting
 * items: results from the session, memberships from the members who are not
 * active yet, and a date under check from the calendar itself. A date is under
 * check either because two people reported a change or because its freshness
 * clock ran out (PDL P10), and only the first of those is an item somebody sent
 * in.
 */
export function countsFor({
  pendingResults,
  competitors,
  events,
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
  counts.schedule += events.filter((one) => one.status === 'checking').length

  return counts
}
