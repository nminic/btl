import { createContext } from 'react'
import type { MembershipBasis, RaceCategory } from '../data/types'

/* What the prototype remembers between screens.
 *
 * It exists so the flows actually connect: a competitor enters a result, the
 * moderator finds it in the queue, approves it, and the competitor sees it
 * appear. Reading that sequence on a screen is worth more than any description
 * of it, and it is the whole reason for building the front end first.
 *
 * All of it is in memory. When the backend arrives this provider reads the
 * session and calls the API; the screens ask the same questions either way.
 */

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export type Submission = {
  id: string
  memberNumber: string
  eventName: string
  date: string
  distanceKm: number
  ascentM: number
  descentM: number
  /** When the race started, hh:mm. Not the time it took to finish it. */
  startTime: string
  seconds: number
  points: number
  /** File name of the picture attached as proof, or empty. Deleted from the
   *  server once the result has been checked, so the disc does not fill with
   *  photographs of watches (ADL A12). */
  photo: string
  category: RaceCategory
  link: string
  status: SubmissionStatus
  /** Why it was sent back, so the competitor is not left guessing. */
  note: string
}

export type Message = {
  id: string
  from: string
  /**
   * The member number this was written to, or empty for the whole league.
   *
   * The portal writes to one person often enough that "the inbox" cannot mean
   * "every message there is": a moderator who hands a profile picture back with
   * an instruction (PDL P22) must not find that instruction in their own inbox a
   * moment later. Empty is the league talking to everybody, which is what the
   * messages the prototype starts with are.
   */
  to: string
  subject: string
  body: string
  date: string
  read: boolean
}

/* What administration has changed, kept apart from the data it changes.
 *
 * The prototype has no database to write to, so an edit is remembered as an
 * overlay: the generated record underneath stays as it is, and the screens read
 * the record with the overlay applied. When the backend arrives the overlay
 * becomes a PATCH and the screens do not notice.
 */
export type Edits = Record<string, Record<string, string>>

/* And what administration has created, kept the same way for the same reason.
 *
 * There is no table to insert into, so a new record is remembered beside the
 * generated ones and the lists read both. It carries its own identity, because
 * a member number is typed in by hand while the id of an event is not, and the
 * screens have to be able to open it again afterwards. Once created, it is
 * changed through `edits` like everything else: the creation is the record and
 * the overlay is what happened to it since.
 */
export type Created = {
  id: string
  values: Record<string, string>
}

/** New records by entity: members, events, races, and the five others. */
export type Creations = Record<string, Created[]>

/* What an administrator has decided in one of the verification queues, kept the
 * same way an edit is: an overlay on top of what is waiting, rather than a
 * change to it. The item underneath stays as it was, and every screen reads it
 * through the overlay, so one decision is enough to make the counter fall in the
 * queue, on the verification list and beside Verification in the navigation.
 *
 * Approving carries no reason. Sending something back always does, on every
 * queue, because the member is told why and "no" with no why is the shortest
 * road to a telephone call.
 */
export type Decision = {
  status: 'approved' | 'rejected'
  /**
   * What was written down with the decision.
   *
   * Why it was sent back on most queues, the instruction the member is to follow
   * on the profile pictures, and on the biographies the text that actually went
   * out, because there the moderator edits before publishing and the published
   * version is whatever they left (PDL P22). Empty where nothing was written:
   * a plain approval, and a deleted comment, which carries no reason at all.
   */
  note: string
  /** The payments queue only: on what basis the membership was activated, paid
   *  or honorary (PDL P8). Empty on every other queue, and never shown
   *  publicly. */
  basis: MembershipBasis | ''
  /**
   * The payments queue only: the member number the system handed out when the
   * membership was activated, first free in order (PDL P8, 30.07.2026).
   *
   * Written down rather than worked out again where it is shown, because it is
   * only the first free number at the moment it is given: activate three
   * registrations and the second must not be able to read itself as the number
   * the first got. Empty on a refusal, which hands out nothing, and on every
   * other queue.
   */
  memberNumber: string
}

export type Decisions = Record<string, Decision>

export type NotificationKey = 'resultApproved' | 'resultChanged' | 'upcomingEvent' | 'newsletter'

export type SessionValue = {
  /** Member number of whoever is signed in, or null. */
  memberNumber: string | null
  signIn: (memberNumber: string) => void
  signOut: () => void

  submissions: Submission[]
  submit: (submission: Omit<Submission, 'id' | 'status' | 'note'>) => void
  decide: (id: string, status: SubmissionStatus, note: string) => void

  /** Everything written to whoever is signed in, plus everything written to the
   *  whole league. Not the whole store: see Message.to. */
  inbox: Message[]
  markRead: (id: string) => void
  /** Writes to one member's inbox. The portal already has one and it is where
   *  the sideways messages belong: the bell always, the mail only if the member
   *  switched it on (PDL P22). */
  notify: (message: Omit<Message, 'id' | 'read'>) => void

  notifications: Record<NotificationKey, boolean>
  setNotification: (key: NotificationKey, on: boolean) => void

  edits: Edits
  edit: (id: string, field: string, value: string) => void
  /** Every field a form just saved, at once. One call rather than one per field,
   *  because a form is one decision and the screens must never see half of it. */
  editRecord: (id: string, values: Record<string, string>) => void

  creations: Creations
  create: (entity: string, id: string, values: Record<string, string>) => void

  decisions: Decisions
  settle: (id: string, decision: Decision) => void
}

export const NOTIFICATION_KEYS: NotificationKey[] = [
  'resultApproved',
  'resultChanged',
  'upcomingEvent',
  'newsletter',
]

/** The seven obligatory emails cannot be switched off (PDL P17); these can. */
export const SessionContext = createContext<SessionValue | null>(null)
