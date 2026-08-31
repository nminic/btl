import { createContext } from 'react'
import type { EventComment, MembershipBasis, RaceCategory, PendingItem, Result } from '../data/types'

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

/**
 * What verification may put right on a submission, and no fifth thing.
 *
 * Four, and the fourth arrived on 31.08.2026 with the rule that gives it a
 * reader. A member types one name, the race's; the moderator is shown a field for
 * the event above it, carrying that same name, and may leave it, shorten it, or
 * change either (owner: „administratoru se iznad polja trke prvo prikazuje polje
 * Događaj koji ima isti sadržaj kao naziv trke... može ostaviti isto, ili skratiti
 * / promeniti naziv događaja, trke ili oba").
 *
 * It is kept on the submission rather than worked out again each time the panel
 * opens, because otherwise a moderator who shortens „Beogradski maraton kroz
 * Adu" to „Beogradski maraton", saves, and opens the panel again finds their own
 * wording gone. It is read by the event that part D makes out of it.
 */
export type Amendment = {
  eventName?: string
  raceName?: string
  raceKind?: string
  seconds?: number
}

export type Submission = {
  id: string
  memberNumber: string
  /**
   * The name of the race, which is what the member typed or picked.
   *
   * The race and not the event since 23.08.2026 (owner): „sad je postalo logičnije
   * da se pretražuje zapravo naziv trke sa datumom i dužinom". A member may also
   * report a race the calendar does not hold, and then this is the only name there
   * is, which is the other reason it is the race's: an event they did not pick has
   * no name to lend.
   */
  raceName: string
  /**
   * The event this race was run at, as the administration settled it.
   *
   * Absent on everything a member sends, because they are asked one name and it is
   * the race's. The moderator is shown a field for the event above it, carrying
   * that same name, and may leave it or change it (owner, 31.08.2026); what they
   * settle is kept here, so opening the panel a second time shows their wording
   * rather than seeding from the race again.
   */
  eventName?: string
  /**
   * Which of the three kinds of race the member says it was, and where it was run.
   *
   * Both travel with the submission because both are the member's answer and both
   * have to come back into the form when a refused result is sent again: the second
   * of the three writers of a submission is `filledFrom`, and a field it leaves out
   * comes back empty and required, so the member is refused for not answering a
   * question the form never asked them again (measured 30.08.2026).
   *
   * The kind is what the member says, not what the race is. It is a hint until the
   * administration settles it at verification (owner, 30.08.2026); a race the
   * calendar already holds answers for itself and is not asked here.
   */
  raceKind: string
  city: string
  country: string
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
   * requires the shape, and both forms do since 23.08.2026
   * (`unos-rezultata.form.json`, `prijava-sa-trke.form.json`). Empty where the
   * member attached a picture instead of an address, which Clan 37 allows.
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
  /**
   * Whether the member has changed this since sending it, and nothing more than
   * that.
   *
   * Owner, 27.08.2026, asked whether the queue should be told: „samo labela, ne
   * šta je ispravljano." Which sits exactly on the older decision that the
   * history of a result is not kept: a moderator sees that something moved, not
   * what it was before.
   *
   * It matters because a corrected item goes to the back of the queue, so what a
   * moderator meets is an item they may have read once already, with different
   * numbers in it and nothing on it saying so.
   */
  corrected: boolean
  /**
   * The counted result this is a correction of, as it should read once somebody
   * agrees with it.
   *
   * Owner, 28.08.2026, choosing between four outcomes: **the old result stays in
   * the standing while the correction waits, and changes only when a moderator
   * approves it.** That overturned what the portal did until then, which was to
   * take the result out of the standing the moment the correction was sent: a
   * refusal then lost the points for good, measured at 180 races and 1.752,86
   * points falling to 179 and 1.744,60 with no way back. The portal's own rule is
   * that the standing is brought up to date **after** verification (PDL P9, owner
   * 27.08.2026), and that is the sentence this restores.
   *
   * The whole record and not the identity alone, because a `Submission` does not
   * know what a `Result` needs: the event's name and address travel on the result
   * and a correction may change everything except which race it is (owner,
   * 27.08.2026, „sve osim trke"). Built where both are in hand, which is the
   * member's own screen.
   *
   * It keeps the identity of the result it replaces, so approving a correction
   * swaps what that record says rather than adding a second one beside it.
   *
   * Absent on every other submission: a result sent for the first time is counted
   * by nobody yet, and there is nothing for it to replace.
   */
  corrects?: Result
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
   * Why it was sent back, and on the profile pictures the instruction the member
   * is to follow. Empty where nothing was written: a plain approval, and a
   * deleted comment, which carries no reason at all.
   *
   * It carried one thing more until 15.08.2026: on a biography, the text that
   * actually went out, because a moderator could edit before publishing and
   * what was published was whatever they left. The owner withdrew that on
   * 06.08.2026 (PDL P22), so an approval publishes what the member wrote and
   * there is nothing about it left to record.
   */
  note: string
  /** The payments queue only: on what basis the membership was activated, paid
   *  or an exemption from the fee (PDL P8). Empty on every other queue, and never shown
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
  submit: (submission: Omit<Submission, 'id' | 'status' | 'note' | 'corrected'>) => void
  /**
   * The counted results a moderator has agreed to change during this visit, by
   * the identity of the record each one replaces.
   *
   * Read by `useResults`, so every screen that counts a result sees the same
   * thing: the standing, the profile, the boards and the league all read that one
   * function (`data/useResource.ts`).
   *
   * A record and not a patch, because what is agreed to is the whole of what the
   * member sent, and because the record it replaces may itself be replaced again
   * the next time.
   */
  corrected: Record<string, Result>
  /** The same result, corrected and sent in again (owner, 06.08.2026 for a
   *  refusal, 27.08.2026 for one still waiting). One item and not a second
   *  beside it: it is one race. */
  resubmit: (
    id: string,
    corrected: Omit<Submission, 'id' | 'status' | 'note' | 'memberNumber' | 'corrected'>,
  ) => void
  /**
   * Taking one's own result back, which a member may do (owner, 27.08.2026).
   *
   * Gone rather than marked withdrawn: the portal keeps no history of a result
   * (P9), so a withdrawn one would be a record of something nobody may read.
   */
  withdraw: (id: string) => void
  /**
   * What the administration may put right on a submission before deciding it
   * (owner, 30.08.2026): the name of the event, the name of the race, the kind,
   * and the time.
   *
   * A type of its own rather than a partial submission, because these four are a
   * list somebody chose and the rest of a submission is not the administration's
   * to rewrite: the member's proofs, their number, what they said about the race.
   * Written as a partial, a later hand could put any of those in it and nothing
   * would say so.
   */
  amend: (id: string, changes: Amendment) => void
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
