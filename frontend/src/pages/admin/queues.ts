import type { Decisions } from '../../session/context'
import { waitingIn, type PendingItem } from './pending'

/* "Red za proveru" was one queue for results. It is now one story, because a
 * moderator approves a great deal more than results, and every one of these
 * comes from a decision that was already written down (PDL P28a).
 *
 * All eight have a screen, and every screen asks the same two questions: is this
 * good enough to publish, and if not, why not. Approving never carries a reason.
 * Refusing carries one on seven of the eight, and the eighth says so here rather
 * than anywhere else, because it is a fact about the queue and not about the
 * screen that serves it.
 */
export type Queue = {
  id: string
  labelKey: string
  sourceKey: string
  path: string
  /**
   * Whether refusing something on this queue asks the moderator why.
   *
   * True on seven of the eight (PDL P28a): what comes in is work, the member is
   * meant to improve it and send it again, and "no" with no why is the shortest
   * road to a telephone call.
   *
   * False on comments, and on comments only (PDL P23). A comment is not work to
   * be improved; it either goes out onto the portal or it does not, and a
   * moderator reads them by the dozen. Writing a sentence about each refused one
   * is work that gives nobody anything. Stated on every queue rather than
   * defaulted, so a ninth arrives having answered the question.
   */
  refusalNeedsReason: boolean
}

const ADDRESS = 'administracija/verifikacija'

export const QUEUES: Queue[] = [
  {
    id: 'results',
    labelKey: 'verification.results',
    sourceKey: 'verification.fromResults',
    path: `${ADDRESS}/rezultati`,
    refusalNeedsReason: true,
  },
  {
    id: 'payments',
    labelKey: 'verification.payments',
    sourceKey: 'verification.fromPayments',
    path: `${ADDRESS}/uplate`,
    refusalNeedsReason: true,
  },
  {
    id: 'leagues',
    labelKey: 'verification.leagues',
    sourceKey: 'verification.fromLeagues',
    path: `${ADDRESS}/lige`,
    refusalNeedsReason: true,
  },
  {
    id: 'teams',
    labelKey: 'verification.teams',
    sourceKey: 'verification.fromTeams',
    path: `${ADDRESS}/timovi`,
    refusalNeedsReason: true,
  },
  {
    id: 'bios',
    labelKey: 'verification.bios',
    sourceKey: 'verification.fromBios',
    path: `${ADDRESS}/biografije`,
    refusalNeedsReason: true,
  },
  {
    id: 'photos',
    labelKey: 'verification.photos',
    sourceKey: 'verification.fromPhotos',
    path: `${ADDRESS}/slike`,
    refusalNeedsReason: true,
  },
  {
    id: 'comments',
    labelKey: 'verification.comments',
    sourceKey: 'verification.fromComments',
    path: `${ADDRESS}/komentari`,
    refusalNeedsReason: false,
  },
  {
    id: 'schedule',
    labelKey: 'verification.schedule',
    sourceKey: 'verification.fromSchedule',
    path: `${ADDRESS}/termini`,
    refusalNeedsReason: true,
  },
]

/** The same eight by id, so a screen can be handed the queue it serves instead
 *  of looking it up and then proving it found something. */
export const QUEUE: Record<string, Queue> = Object.fromEntries(
  QUEUES.map((one) => [one.id, one]),
)

/**
 * Everything the eight numbers are counted from, and nothing else.
 *
 * The list of members used to be in here as well. Memberships waiting to be
 * activated were counted off it, as the members who were not active yet; a member
 * number is now handed out the moment the fee is recorded (PDL P8, 30.07.2026),
 * so somebody who has not paid is not in that list at all and is counted in
 * `items` with the other six. The field outlived its reader by one release, and
 * while it did, the counter in the header asked for the file of members on every
 * screen of the portal in order to hand it in unread.
 */
export type Waiting = {
  /** Results a competitor sent in during this visit and nobody has judged. */
  pendingResults: number
  items: PendingItem[]
  decisions: Decisions
}

/**
 * How many items each queue holds. One function, because the number beside a
 * queue, the number on the verification list and the number beside Verification
 * in the navigation are the same number, and two ways of counting it would
 * eventually be two different numbers.
 *
 * One of the eight is counted from something other than the file of waiting
 * items, and that is results, which a competitor sends in during the visit.
 * Memberships were the second until the member number became something the system
 * hands out (PDL P8, 30.07.2026): a registration with no number is not a member
 * and cannot be counted off the member list, so it waits in the file like
 * everything else and the general rule reaches it.
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
export function countsFor({ pendingResults, items, decisions }: Waiting): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const queue of QUEUES) {
    counts[queue.id] = waitingIn(items, decisions, queue.id).length
  }

  counts.results = pendingResults

  return counts
}

/** Everything waiting for a moderator as one number, which is what stands beside
 *  Verification in the navigation (PDL P28a). */
export function totalWaiting(waiting: Waiting): number {
  const counts = countsFor(waiting)

  return QUEUES.reduce((sum, queue) => sum + counts[queue.id], 0)
}
