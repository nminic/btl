import type { Decisions } from '../../session/context'
import { waitingIn, type PendingItem } from './pending'

/* "Red za proveru" was one queue for results. It is now one story, because a
 * moderator approves a great deal more than results, and every one of these
 * comes from a decision that was already written down (PDL P28a).
 *
 * All eight have a screen, and every screen asks the same first question: is this
 * good enough to publish. Saying yes never asks the moderator for anything. What
 * the other answer is differs from queue to queue, and it is stated here rather
 * than on the screens, because it is a fact about the queue and not about the
 * screen that serves it.
 */

/**
 * The moderator's second decision on a queue, and therefore what the first one is
 * called as well.
 *
 * Four answers rather than a yes or a no. It used to be one boolean, "does
 * refusing ask why", and the three exceptions the owner settled on 30.07.2026
 * (PDL P22) are three different things rather than degrees of the same one:
 *
 * - `sendBack`: approve, or hand the work back with a reason. Five of the eight.
 *   A member who is refused with no reason writes back to ask, so the reason is
 *   the cheaper of the two paths rather than politeness.
 * - `instruct`: approve, or hand the picture back with a reason. Pictures are the
 *   only thing that still goes back to a competitor, so the reason is the one
 *   that has to arrive somewhere: it goes to the member's inbox, and the member
 *   changes the picture by it. It is called a reason like everywhere else and
 *   written into the same box; what differs is that the queue asks for one
 *   precise enough to work from, which is what the empty field says (SendBack).
 * - `delete`: accept, or delete on the spot. No reason is asked for, and nothing
 *   at all is sent to the member. A comment is not work to be improved: it goes
 *   out onto the portal or it does not, and a moderator reads them by the dozen.
 *   The word matters as much as the click. "Refused" suggests a refused comment
 *   is being kept somewhere and could be brought back, and none is.
 * - `editAndPublish`: there is no second decision. The moderator adjusts the text
 *   as they see fit and publishes what they left. A biography never goes back to
 *   the competitor for approval, so there is no button for it and no reason to
 *   write.
 */
export type QueueOutcome = 'sendBack' | 'instruct' | 'delete' | 'editAndPublish'

export type Queue = {
  id: string
  labelKey: string
  sourceKey: string
  path: string
  /** What happens to an item here that is not approved as it stands. Stated on
   *  every queue rather than defaulted, so a ninth arrives having answered the
   *  question instead of inheriting somebody else's answer. */
  outcome: QueueOutcome
}

const ADDRESS = 'administracija/verifikacija'

export const QUEUES: Queue[] = [
  {
    id: 'results',
    labelKey: 'verification.results',
    sourceKey: 'verification.fromResults',
    path: `${ADDRESS}/rezultati`,
    outcome: 'sendBack',
  },
  {
    id: 'payments',
    labelKey: 'verification.payments',
    sourceKey: 'verification.fromPayments',
    path: `${ADDRESS}/uplate`,
    outcome: 'sendBack',
  },
  {
    id: 'leagues',
    labelKey: 'verification.leagues',
    sourceKey: 'verification.fromLeagues',
    path: `${ADDRESS}/lige`,
    outcome: 'sendBack',
  },
  {
    id: 'teams',
    labelKey: 'verification.teams',
    sourceKey: 'verification.fromTeams',
    path: `${ADDRESS}/timovi`,
    outcome: 'sendBack',
  },
  {
    id: 'bios',
    labelKey: 'verification.bios',
    sourceKey: 'verification.fromBios',
    path: `${ADDRESS}/biografije`,
    outcome: 'editAndPublish',
  },
  {
    id: 'photos',
    labelKey: 'verification.photos',
    sourceKey: 'verification.fromPhotos',
    path: `${ADDRESS}/slike`,
    outcome: 'instruct',
  },
  {
    id: 'comments',
    labelKey: 'verification.comments',
    sourceKey: 'verification.fromComments',
    path: `${ADDRESS}/komentari`,
    outcome: 'delete',
  },
  {
    id: 'schedule',
    labelKey: 'verification.schedule',
    sourceKey: 'verification.fromSchedule',
    path: `${ADDRESS}/termini`,
    outcome: 'sendBack',
  },
]

/** The same eight by id, so a screen can be handed the queue it serves instead
 *  of looking it up and then proving it found something. */
export const QUEUE: Record<string, Queue> = Object.fromEntries(
  QUEUES.map((one) => [one.id, one]),
)

/**
 * Whether this item can be handed back at all.
 *
 * One queue asks for a reason the member is meant to act on, and there the
 * reason has somewhere to go: the inbox of whoever sent the picture in (PDL
 * P22). An item on that queue carrying no member number has nowhere, and an
 * empty recipient is not "nobody" in this portal, it is **everybody**: the inbox
 * shows a member what was written to them and what was written to the whole
 * league, and the league is the empty one (session/context.ts, Message.to).
 *
 * So a picture with no sender is not a picture that can be sent back quietly to
 * nobody. It is one instruction away from "Slika je mutna, vidi ti se lice" on
 * the front of every member's inbox. Every picture in the data carries a number
 * today, which is exactly the kind of safety that lasts until the backend hands
 * over the first row that does not.
 */
export function canSendBack(queue: Queue, item: { memberNumber: string }): boolean {
  return queue.outcome !== 'instruct' || item.memberNumber !== ''
}

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
