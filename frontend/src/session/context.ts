import { createContext } from 'react'
import type { EventComment, MembershipBasis, RaceCategory, PendingItem } from '../data/types'

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

/* A list rather than a union, so the words for the three can be walked
   (keys.test). A union is gone by the time anything runs. */
export const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected'] as const

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export type Submission = {
  id: string
  memberNumber: string
  eventName: string
  date: string
  distanceKm: number
  ascentM: number
  descentM: number
  seconds: number
  points: number
  /** File name of the picture attached as proof, or empty. Deleted from the
   *  server once the result has been checked, so the disc does not fill with
   *  photographs of watches (ADL A12). */
  photo: string
  category: RaceCategory
  /**
   * The official results, as an address and nothing else.
   *
   * The queue draws it as a link, so it has to be one: the form that asks for it
   * requires the shape (`unos-rezultata.form.json`). Empty where the entry came
   * from the event's own page, which asks for words rather than an address.
   */
  link: string
  /**
   * What the member wrote in their own words: a start number, a screenshot they
   * are sending on, a sentence about a watch that stopped.
   *
   * Its own field and not the link, which is where it went at first. The queue
   * draws the link as `<a href>`, so "Startni broj 412" became an address on the
   * moderator's screen: relative, opening the administration at a path made of
   * the member's sentence. Anything a member types is text until something has
   * checked it, and nothing had.
   */
  comment: string
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

/** New records by entity: members, events, races, and the six others. */
export type Creations = Record<string, Created[]>

/*
 * Which rights the superadmin has ticked and unticked, by moderator and by
 * right, kept as an overlay for the same reason an edit is (PDL P28a).
 *
 * A box has to remember both answers rather than only the yes. A moderator who
 * arrives holding a right and has it taken away is not the same as one who never
 * had it, and a set of keys that are on could not tell the two apart: unticking
 * would be read as "nothing said about this one" and the right would come
 * straight back on the next read.
 */
export type Rights = Record<string, Record<string, boolean>>

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

/**
 * Records administration has removed, by entity and then by identity.
 *
 * The same overlay every other change is kept as: the generated record
 * underneath stays where it is and the lists read past it. There is nothing to
 * delete from in any case, since the records are generated. When the backend
 * arrives this becomes a DELETE and the screens do not notice.
 *
 * By entity, exactly as `creations` is, and not one flat list of identities for
 * all of them. Identities are only unique inside their own entity: a member is
 * `000012` and a price row is a key, and nothing stops two entities from using
 * the same string one day. A single namespace would then delete a row of one
 * entity by deleting a row of another, and the fault would look like a screen
 * that had not refreshed.
 */
export type Deletions = Record<string, string[]>

export type NotificationKey = 'resultApproved' | 'resultChanged' | 'newsletter'

export type SessionValue = {
  /** Member number of whoever is signed in, or null. */
  memberNumber: string | null
  signIn: (memberNumber: string) => void
  signOut: () => void

  submissions: Submission[]
  submit: (submission: Omit<Submission, 'id' | 'status' | 'note'>) => void
  /** The same result, corrected and sent in again after a refusal (owner,
   *  06.08.2026). One item and not a second beside it: it is one race. */
  resubmit: (
    id: string,
    corrected: Omit<Submission, 'id' | 'status' | 'note' | 'memberNumber'>,
  ) => void
  decide: (id: string, status: SubmissionStatus, note: string) => void

  /**
   * The events whoever is signed in has said they are going to, by id.
   *
   * A switch and not a one-way press (owner, 11.08.2026): pressing it again
   * takes them off the list. What the file carries is who said so before this
   * visit; this is what has been said during it, and the two are read together
   * (data/useResource.ts, `useAttendance`).
   *
   * Held as a map of id to whether, rather than as a list, so that turning it
   * off is a value and not an absence: a member who takes their name off has
   * said something, and a file that still carries them said something else.
   */
  going: Record<string, boolean>
  /** Says whether they are going, or no longer going. */
  setGoing: (eventId: string, going: boolean) => void

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

  rights: Rights
  /** One box, ticked or unticked. One call per box, because that is what the
   *  superadmin does: there is no save button on the matrix and nothing to lose
   *  by leaving the screen. */
  setRight: (moderator: string, right: string, granted: boolean) => void

  decisions: Decisions
  settle: (id: string, decision: Decision) => void

  deletions: Deletions
  /** Removes one record of one entity. Asked for twice on screen before it gets
   *  here (EntityEditor.tsx), because nothing brings it back. */
  remove: (entity: string, id: string) => void

  /**
   * What a member has put forward during this visit and nobody has decided on.
   *
   * A team, today. It is the same kind of thing as the teams that are read off
   * the disc, and it joins them rather than living in a list of its own
   * (src/pages/admin/pending.ts): a moderator opening the queue must not be able
   * to tell which of two waiting teams came from a file and which from a member,
   * because there is no such difference once the database exists.
   */
  proposals: PendingItem[]
  propose: (item: Omit<PendingItem, 'id'>) => void

  /**
   * Comments a moderator has let out during this visit, carrying the id of the
   * queue item they came from.
   *
   * Written down here rather than read back off the queue, because the event
   * page is public and the queue is not: it holds addresses of people who are
   * not members yet and the words of comments nobody has approved, and a public
   * screen that reads it hands all of that to every visitor's browser. The
   * administration is the only side that reads the queue, so the administration
   * is what writes down what came out of it.
   *
   * Whether one is actually on the portal is still `decisions`, not this list.
   * A comment let out and then taken down again is a decision changed, and one
   * list of "what is out" would have to be kept in step with the decisions by
   * hand, which is how two answers to one question start.
   */
  published: EventComment[]
  publish: (comment: EventComment) => void
}

/** The six obligatory emails cannot be switched off (PDL P22); these can. */
export const NOTIFICATION_KEYS: NotificationKey[] = [
  'resultApproved',
  'resultChanged',
  'newsletter',
]

export const SessionContext = createContext<SessionValue | null>(null)
