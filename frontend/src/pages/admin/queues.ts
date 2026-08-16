import type { Decisions } from '../../session/context'
import { waitingIn } from './pending'
import { PENDING_QUEUE_IDS, type ItemKind, type PendingItem, type PendingQueueId } from '../../data/types'

/* "Red za proveru" was one queue for results. It is now one story, because a
 * moderator approves a great deal more than results, and every one of these
 * comes from a decision that was already written down (PDL P28a).
 *
 * All seven have a screen, and every screen asks the same first question: is this
 * good enough to publish. Saying yes never asks the moderator for anything. What
 * the other answer is differs from queue to queue, and it is stated here rather
 * than on the screens, because it is a fact about the queue and not about the
 * screen that serves it.
 */

/**
 * The moderator's second decision on a queue, and therefore what the first one is
 * called as well.
 *
 * Three answers rather than a yes or a no. It used to be one boolean, "does
 * refusing ask why", and the three exceptions the owner settled on 30.07.2026
 * (PDL P22) are three different things rather than degrees of the same one:
 *
 * - `sendBack`: approve, or hand the work back with a reason. Five of the seven.
 *   A member who is refused with no reason writes back to ask, so the reason is
 *   the cheaper of the two paths rather than politeness.
 * - `instruct`: approve, or hand the picture back with a reason. A picture is the
 *   one thing asked for in words precise enough to work from. It is called a
 *   reason like everywhere else and written into the same box; what differs is
 *   that the queue asks for one somebody can act on, which is what the empty
 *   field says (SendBack). Both sorts on that queue reach the inbox of whoever
 *   sent them in, each under its own heading (`returned`).
 * - `delete`: accept, or delete on the spot. No reason is asked for, and nothing
 *   at all is sent to the member. A comment is not work to be improved: it goes
 *   out onto the portal or it does not, and a moderator reads them by the dozen.
 *   The word matters as much as the click. "Refused" suggests a refused comment
 *   is being kept somewhere and could be brought back, and none is.
 *
 * There were four. `editAndPublish` was the biography: the moderator adjusted
 * the text as they saw fit and published what they left, with no second
 * decision and nothing going back. The owner withdrew that on 06.08.2026 and
 * confirmed it on 11.08.2026 (PDL P22): „Sve što se odbije vraća se članu", uz
 * obavezan razlog, i član sme da pošalje ponovo. A biography is the words a
 * member wrote about themselves, and a moderator rewriting them and publishing
 * the result puts somebody else`s sentences on their profile under their name.
 * So it is `sendBack` like the other five, and the exception is the comment,
 * which is deleted rather than returned.
 */
export type QueueOutcome = 'sendBack' | 'instruct' | 'delete'

/**
 * Which seven there are.
 *
 * The six that wait in the file, plus the results a competitor sends in during
 * the visit and which therefore live in the session rather than in the file
 * (pending.ts). Written as those two and not as a third list of names, so a
 * queue added to the file and forgotten here, or the other way round, is a
 * compilation error rather than a screen that quietly serves nothing.
 */
export type QueueId = PendingQueueId | 'results'

export type Queue = {
  id: QueueId
  labelKey: string
  sourceKey: string
  path: string
  /** What happens to an item here that is not approved as it stands. Stated on
   *  every queue rather than defaulted, so a ninth arrives having answered the
   *  question instead of inheriting somebody else's answer. */
  outcome: QueueOutcome
}

const ADDRESS = 'administracija/verifikacija'

/**
 * The seven, each under its own id, so a screen can be handed the queue it
 * serves instead of looking it up and then proving it found something.
 *
 * Written down as the record and not as a list, which is the way round it used
 * to be: the list was what was written and the record was made from it with
 * `Object.fromEntries`. That gives a record typed by "any string at all", so
 * `QUEUE.teams` was a queue that might not be there, and fourteen entries in the
 * route table, two screens and the counter each had to answer for a ninth id
 * that has never been written anywhere. This way every one of the seven is there
 * because the type says which seven there are, and nothing is proved twice.
 *
 * The type also ties the key to the id: `Queue & { id: K }` refuses an entry
 * filed under a name other than its own, which is the one mistake a record of
 * this shape invites and the one a list could not make.
 */
export const QUEUE: { [K in QueueId]: Queue & { id: K } } = {
  results: {
    id: 'results',
    labelKey: 'verification.results',
    sourceKey: 'verification.fromResults',
    path: `${ADDRESS}/rezultati`,
    outcome: 'sendBack',
  },
  payments: {
    id: 'payments',
    labelKey: 'verification.payments',
    sourceKey: 'verification.fromPayments',
    path: `${ADDRESS}/uplate`,
    outcome: 'sendBack',
  },
  leagues: {
    id: 'leagues',
    labelKey: 'verification.leagues',
    sourceKey: 'verification.fromLeagues',
    path: `${ADDRESS}/lige`,
    outcome: 'sendBack',
  },
  teams: {
    id: 'teams',
    labelKey: 'verification.teams',
    sourceKey: 'verification.fromTeams',
    path: `${ADDRESS}/timovi`,
    outcome: 'sendBack',
  },
  profiles: {
    id: 'profiles',
    labelKey: 'verification.profiles',
    sourceKey: 'verification.fromProfiles',
    path: `${ADDRESS}/trkacki-profil`,
    /* The one queue whose items are not all decided the same way, so this is
       never read: `outcomeFor` answers off the item before it ever reaches the
       queue. It stands because the type asks every queue for one, and a review
       measured what that costs: changed to `delete`, all 1901 tests passed,
       because nothing can reach it. What it says is therefore the same thing
       `outcomeFor` says for the sort that is not named, so the two cannot
       disagree in a way anybody would notice. */
    outcome: 'instruct',
  },
  comments: {
    id: 'comments',
    labelKey: 'verification.comments',
    sourceKey: 'verification.fromComments',
    path: `${ADDRESS}/komentari`,
    outcome: 'delete',
  },
  schedule: {
    id: 'schedule',
    labelKey: 'verification.schedule',
    sourceKey: 'verification.fromSchedule',
    path: `${ADDRESS}/termini`,
    outcome: 'sendBack',
  },
}

/**
 * The same seven as a list, in the order they are shown in.
 *
 * Built from the list of queues that are read from a file, with the results in
 * front of them, rather than from the order the record above happens to be
 * written in. The record's order is not a decision anybody took: it is whatever
 * the keys were typed in, and `Object.values` follows it silently. This way the
 * order lives in one place (src/data/types.ts), beside the shape of the items
 * themselves, and the results come first because they are the queue with the
 * most in it and the one a moderator opens daily.
 */
export const QUEUES: Queue[] = [QUEUE.results, ...PENDING_QUEUE_IDS.map((id) => QUEUE[id])]

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
export function canSendBack(
  queue: Queue,
  item: { kind: ItemKind; memberNumber: string },
): boolean {
  if (queue.id !== 'profiles') {
    return true
  }

  /* On this queue a refusal is written to somebody, so it can only be made
     where there is both a heading to write under and a member to write to. */
  return returned(queue, item) !== null && item.memberNumber !== ''
}

/**
 * The heading a refusal on this queue reaches the member under, or nothing
 * where a refusal is not sent at all.
 *
 * One place, because three things read it: whether the item may be handed back
 * without a member number, whether a message goes out, and what that message is
 * called. Written out at each of them, the biography was added to one of the
 * three on 15.08.2026 and left out of the other two, so a refusal that could not
 * be stopped also could not arrive.
 *
 * The two sorts on the racing profile queue and nothing else. The other five
 * refuse without writing to anybody, which is where this branch leaves them and
 * not where they stay: the owner decided on 15.08.2026 that the refusal goes out
 * from the queues that refuse anything („Poruka ide sa svih redova"), and that is
 * being built on its own branch because it needs a heading of its own for each
 * and a test each. Not quite every queue: a comment is deleted rather than
 * handed back, with no message at all, which is the one exception PDL P22
 * names and which `outcome: 'delete'` above is. Until it lands, the five say
 * nothing on screen either, which is what `reasonKeptPlaceholder` is for.
 */
export function returned(
  queue: Queue,
  item: { kind: ItemKind },
): 'verification.photoReturned' | 'verification.bioReturned' | null {
  if (queue.id !== 'profiles' || item.kind === '') {
    /* Nothing to write under. The empty sort is every queue that holds one
       kind of thing, and the racing profile never carries it (data/types.ts);
       an item that does is a record nobody understands, and the safe answer
       is that it cannot be handed back rather than that it is a picture. A
       review found the old shape treating everything that is not a biography
       as one, which put the wrong heading in the one function written to stop
       exactly that. */
    return null
  }

  return item.kind === 'bio' ? 'verification.bioReturned' : 'verification.photoReturned'
}

/**
 * What is to be done with one item, which is what the queue says except where
 * the queue holds two sorts of thing.
 *
 * The racing profile is that one queue (owner, 06.08.2026): a member's
 * biography and their picture are looked at together, because they are the same
 * profile, and the decision over each is not quite the same. Both are refused
 * with a reason and handed back to the member (PDL P22); what differs is what
 * the moderator is asked to write, since a picture is changed by an instruction
 * precise enough to work from and a text is written again.
 *
 * Read off the item and not off its shape. A biography is a paragraph and a
 * picture is a file name, and telling them apart by looking would be a rule that
 * holds until somebody writes a biography that reads like a file name.
 */
export function outcomeFor(queue: Queue, item: { kind: ItemKind }): QueueOutcome {
  if (queue.id !== 'profiles') {
    return queue.outcome
  }

  /* Both go back to the member, and they go back differently. A biography is
     refused with a reason and the member writes another; a picture is handed
     back with an instruction precise enough to work from, which is what the
     empty box on that queue asks for (SendBack.tsx, PDL P22). */
  return item.kind === 'bio' ? 'sendBack' : 'instruct'
}

/**
 * Everything the seven numbers are counted from, and nothing else.
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
 * How many items one queue holds. One function, because the number beside a
 * queue, the number on the verification list and the number beside Verification
 * in the navigation are the same number, and two ways of counting it would
 * eventually be two different numbers.
 *
 * One of the seven is counted from something other than the file of waiting
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
export function countFor({ pendingResults, items, decisions }: Waiting, queue: Queue): number {
  return queue.id === 'results' ? pendingResults : waitingIn(items, decisions, queue.id).length
}

/**
 * Everything waiting for a moderator as one number, which is what stands beside
 * Verification in the navigation (PDL P28a).
 *
 * Over the queues given, which is not always all seven: a moderator sees only
 * the queues he may work in (owner, 30.07.2026), and a total counting the other
 * ones would send him looking for work he cannot reach and cannot see.
 */
export function totalWaiting(waiting: Waiting, queues: Queue[] = QUEUES): number {
  return queues.reduce((sum, queue) => sum + countFor(waiting, queue), 0)
}

