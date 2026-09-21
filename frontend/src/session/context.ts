import { createContext } from 'react'
import type {
  EventComment,
  MembershipBasis,
  RaceCategory,
  PendingItem,
  RacingPair,
  Result,
} from '../data/types'

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
 * What verification writes on a submission, and no sixth thing.
 *
 * Four of the five are the administration putting right what the member could only
 * hint at; the fifth, the race, is the portal finishing a sentence the member could
 * not, and it arrived with the part that makes one.
 *
 * A member types one name, the race's; the moderator is shown a field for
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
  /**
   * The race this submission belongs to, written when verification makes one for
   * it.
   *
   * Not the administration correcting the member, which is what the other three
   * are: this is the portal finishing a sentence the member could not. A member
   * who typed a name the calendar does not hold sends no race, verification makes
   * one, and without this the result stays pointing at nothing while the race it
   * asked for stands empty (PDL, 30.08.2026, point 6: „Rezultat prvog člana se
   * veže za trku koja je tim upisom nastala").
   */
  raceId?: number
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
   * The race in the calendar this result belongs to, where there is one.
   *
   * Absent on exactly one road: a member who typed a name the calendar does not
   * hold. Every other way in knows it — the button in a row of the event page is
   * that row's race, a name chosen from the list is the race chosen, and a
   * correction of a counted result keeps the race the record already names.
   *
   * That absence is what verification reads to know it has to make the event and
   * the race before it can approve (owner, 31.08.2026), and it is why the queue
   * marks such a row „NOVO" and why sweeping the queue steps over it.
   */
  raceId?: number
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
  /**
   * The invitation this message is about, for the one kind of message that asks
   * rather than tells.
   *
   * Optional because every message the portal has ever written is a message that
   * tells, and a field the old ones do not carry has to be a field the screens
   * can be handed nothing for. The four that read a message all ask for it
   * before they draw anything (`MessagesMenu`, `Messages`, `MessageDetail`, and
   * `notify` which writes it).
   *
   * Only the identity is kept here, never the answer: whether the buttons may
   * still be pressed is worked out when the message is drawn, from whether the
   * member already has a team (PDL, 06.09.2026). A message that remembered „yes"
   * would go on offering it after the member joined somewhere else.
   */
  invitation?: string
  /**
   * The invitation into a racing pair this message is about, kept apart from the one above rather
   * than sharing it.
   *
   * Two fields and not one with a kind beside it, because the two are answered by different
   * screens and the compiler is then the thing that keeps them apart: a message that carries a
   * pair's identity cannot be handed to the screen that answers a team's. Only the identity is
   * kept, never the answer, for the reason written above.
   */
  pairInvite?: string
}

/* What administration has changed, kept apart from the data it changes.
 *
 * The prototype has no database to write to, so an edit is remembered as an
 * overlay: the generated record underneath stays as it is, and the screens read
 * the record with the overlay applied. When the backend arrives the overlay
 * becomes a PATCH and the screens do not notice.
 */
/**
 * A member asking to be let into a team, kept as a record about the team rather than as a
 * letter to a person.
 *
 * **Why it is not a message.** The first draft of this was: the application went to
 * whoever ran the team at the moment it was sent, as a question inside their inbox. Every
 * fault that draft had came from that one choice, and there were six of them. The
 * authority belongs to a role and not to a person, so a founder who left went on deciding
 * while the one who really ran the team never saw it; „is it still waiting" was read off
 * the answer, so an application nobody could answer waited for ever and kept the member
 * out of every team on the portal; and each of those needed a patch that opened the next
 * one (reviews, 05. and 06.09.2026).
 *
 * Kept this way, none of that arises. Who may answer is worked out where it is drawn, from
 * the roster, every time (`data/teamAdmin.ts`). It is drawn on the team's own page, which
 * is where the team is and where „Izmeni" and „Obriši" already stand. And it always has an
 * ending, because the member who sent it can take it back.
 */
export type Application = {
  id: string
  /** The team being asked about. */
  teamId: number
  /** Who is asking to be let in. */
  memberNumber: string
  /** The day they asked. */
  date: string
}

/**
 * A team asking one member in, which is the application turned around.
 *
 * The same four things an `Application` holds, because it is the same fact read
 * from the other side, and copying its shape is what lets both be answered by
 * asking the roster rather than by remembering an answer.
 *
 * Where the two differ is **who decides, and therefore where it is read**
 * (PDL, „Gde stoji odluka", 06.09.2026). An application is decided by whoever
 * leads the team, a role that may change hands between the question and the
 * answer, so it lives on the team's page and the leader is worked out each time
 * it is drawn. An invitation is decided by one named person who cannot change,
 * and that person has no reason to visit the team's page at all, so it reaches
 * them in the one place the portal can: their inbox.
 *
 * It carries no answer of its own. „May this still be accepted" is worked out
 * when the message is drawn, from whether the member has a team, so three teams
 * inviting the same person on the same day need not know about each other.
 */
/**
 * One member asking another into a racing pair, which is the same shape as an invitation into a
 * team and for the same reason (odluka 07.09.2026, vlasnik: „Poslušaću predlog broj 1").
 *
 * Where it differs from a team's invitation is that both ends are one person: a pair is made by two
 * members confirming each other (PDL P13), so there is no role that could change hands between the
 * question and the answer. It still reaches the one who has to answer through their inbox, because
 * that is the one place the portal can put something addressed to a named person.
 *
 * It carries no answer of its own, exactly as `Invitation` does not: „may this still be accepted"
 * is worked out when the message is drawn, from whether either of them already has a pair, so two
 * people asking the same person on the same day need not know about each other.
 */
export type PairInvite = {
  id: string
  /** Who is asking. */
  from: string
  /** Who is being asked. */
  to: string
  /** The day it was sent. */
  date: string
}

export type Invitation = {
  id: string
  /** The team doing the asking. */
  teamId: number
  /** Who is being asked in. */
  memberNumber: string
  /** The day they were asked. */
  date: string
}

/**
 * What administration has changed, by record.
 *
 * **Keyed by the family a record belongs to AND by its identity, not by its
 * identity alone** (20.09.2026). Until that day an identity said which record it
 * was on its own, because the generator wrote `evt-…` on an event, `evt-…-1000`
 * on a race and `team-dunav` on a team. The records now carry what the schema
 * carries, and a `bigserial` is only unique inside its own table: event 1116 and
 * race 1116 are two different things answering to one number, and so are team 1
 * and league 1.
 *
 * Measured before the change went in, on the administration's own screen: saving
 * an event writes every one of its races back (`AdminEvents`, `alsoSave`), a race
 * that was never renamed carries its event's name, and the change filed under the
 * race's number reached the EVENT of that number as well. Two events then read
 * „Provera unosa", one of them in the wrong town and carrying the kind of a race.
 */
export type Edits = Record<string, Record<string, string>>

/**
 * The key one record's changes are filed under.
 *
 * `under` is the family, which every screen that writes a change already knows:
 * an entity's own `id` where there is an `EntityDef`, and the name of the list
 * where there is not.
 */
export function recordKey(under: string, id: string | number): string {
  return `${under}:${String(id)}`
}

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

/**
 * WHOEVER IS SIGNED IN, AND WHICH OF THE TWO WAYS IN HE CAME BY.
 *
 * <p>There are two, and there go on being two AFTER the mock was switched off on
 * 21.09.2026. The header has to ask ONE question - „is anybody signed in" (PDL, owner:
 * „Prijavljen član vidi istu naslovnu kao gost. Jedina razlika je gore desno, gde umesto
 * Registracija / Prijava stoji link ka opcijama profila") - and it must not ask it twice
 * and get two answers.
 *
 * <p><b>A real session carries no member number HERE, and since 21.09.2026 that is the
 * PORTAL'S doing rather than the server's.</b> This said the answer is `{role, account}`
 * and that {@code MeApi} „says at length why the member number is not on it". Both halves
 * are out of date, and the second is refused by that class in bold: „AND SINCE 20.09.2026
 * IT CARRIES A MEMBER NUMBER, which is the sentence this class used to spend four
 * paragraphs refusing." Measured the same day: a harness that really answers `{role,
 * account}` and nothing else fails two cases, because the portal does read something out
 * of the record beside them.
 *
 * <p>What the reason has become is smaller and still good: the number is on the answer and
 * the portal does not take it, because doing so is one increment with the member area and
 * a moderator's rights in it. Until then the two arms of this carry different things.
 */
export type SignedIn =
  /**
   * The prototype's way in: a member number, chosen on the development switch.
   *
   * Every screen that draws a member reads through this, so it wins where both are set.
   *
   * **THIS SAID THE ARM WOULD GO WITH THE MOCK, AND THAT DAY CAME ON 21.09.2026 AND IT DID
   * NOT GO.** The sentence is corrected here rather than left standing, because a promise
   * about a day that has passed reads as an instruction to carry it out. What it missed is
   * that the two arms carry different things for a reason the switch does not touch: a real
   * session is `GET /api/me`, and the portal takes no MEMBER NUMBER off it, so a signed in
   * member has none and every screen about „me" would have nothing to draw.
   *
   * **AND THE CORRECTION ITSELF CARRIED THE NEXT ONE, which is why this paragraph says so
   * out loud.** It went on to say that `theServer.ts` reads the role and the account „and
   * nothing else", and that was already false when it was written: the same day's work had
   * that file reading `member.membershipBasis` as well, because a member is told how his
   * own fee is held through this answer and through no other. Left standing it was an
   * instruction to take that reading back out - which is the very thing a round of review
   * had just called a high finding. Measured 21.09.2026: making it true again, by answering
   * `null` for the basis, fails five cases.
   *
   * **What the portal reads off `/api/me` today, said as a list so the next sentence about
   * it can be checked rather than believed:** the role, the account, and the caller's own
   * membership basis. `MeApi.WhoIAm` carries more than that - the member number among it,
   * since 20.09.2026 - and taking the number off it is its own increment, because the
   * member area and a moderator's rights come off the same answer.
   */
  | { as: 'member'; memberNumber: string }
  /** A real session, which is an account and nothing more. */
  | { as: 'account'; account: number }

export type SessionValue = {
  /** Member number of whoever is signed in, or null. */
  memberNumber: string | null
  signIn: (memberNumber: string) => void
  /**
   * Whoever the SERVER says is signed in, or null.
   *
   * Written from the one answer that knows, `GET /api/me`, and never from the form: the
   * form is told nothing back, and the answer to the sign in itself is 204 and empty.
   */
  account: number | null
  /** What `GET /api/me` said, remembered for the rest of the visit. */
  theServerSignedMeIn: (account: number, membershipBasis: MembershipBasis | null) => void
  /**
   * HOW THE CALLER'S OWN MEMBERSHIP IS HELD, as the server answered it, or null where
   * it did not say.
   *
   * **It is here and not on the member's record in the public list, and that is the
   * owner's decision rather than a convenience.** 20.09.2026: „Clan vidi SVOJ osnov
   * clanstva; tudj ne vidi niko osim administracije." `/api/competitors` keeps the
   * second half by asking about the CALLER and not about the row, so it withholds the
   * field from a member even on his own row; `/api/me` is where the first half lives
   * (`session/theServer.ts` writes out what reading it the other way cost).
   *
   * **Only this one of the seven the answer carries**, because only this one has no
   * other door. The member number, the country, the first season and the team are on
   * the public list; the referral code and the count are on the caller's own row of it.
   * A field remembered here with no reader would be a second home for a fact that
   * already has one.
   */
  myMembershipBasis: MembershipBasis | null
  /**
   * The one question the header asks, answered once here.
   *
   * Derived rather than stored, so it cannot drift away from the two facts above: a
   * third field saying „somebody is signed in" is a third thing to remember to clear on
   * the way out, and signing out that left it standing would leave a header for a
   * visitor with a profile menu on it.
   */
  signedIn: SignedIn | null
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

  /** The applications to join a team that nobody has answered yet. */
  applications: Application[]
  /** Files one, from the member asking. */
  apply: (application: Omit<Application, 'id'>) => void
  /** Answers one: taken in, refused, or taken back by whoever sent it. */
  answer: (id: string) => void

  /** The invitations into a team that are still open, from every team at once. */
  invitations: Invitation[]
  /** Sends one, from any member of the team to somebody outside it, and hands
   *  back the identity it was given: the message that carries it has to name it,
   *  and working the identity out a second time at the call site would be the
   *  same rule written twice. */
  invite: (invitation: Omit<Invitation, 'id'>) => string

  /** The invitations into a racing pair that are still open, from everybody at once. */
  pairInvites: PairInvite[]
  /** Sends one, and hands back the identity it was given, for the same reason `invite` does: the
   *  message that carries it has to name it. */
  invitePair: (invite: Omit<PairInvite, 'id'>) => string
  /** Closes one: accepted, refused, or overtaken because one of the two paired up elsewhere. */
  closePairInvite: (id: string) => void
  /** The pairs made during this visit. There is no database, so a pair confirmed now lives here
   *  until the visit ends (ADL A2). */
  pairsMade: RacingPair[]
  /** The identities of pairs that were broken during this visit, whether they came from the file
   *  or were made in it: „Ne postoji par onda, raskida se" (PDL P13). */
  pairsBroken: number[]
  makePair: (pair: Omit<RacingPair, 'id'>) => void
  breakPair: (id: number) => void
  /** Closes one: accepted, refused, or overtaken because the member joined
   *  elsewhere. The message stays in the inbox either way, because deleting
   *  somebody's mail is deleting the answer to „what happened to that". */
  close: (id: string) => void
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
  published: { from: string; comment: EventComment }[]
  /** `from` is the queue item, which is what a decision is filed under; the
   *  comment is handed over without an identity, because the session gives it
   *  one (`SessionProvider`, `publish`). */
  publish: (from: string, comment: Omit<EventComment, 'id'>) => void
}

/** The six obligatory emails cannot be switched off (PDL P22); these can. */
export const NOTIFICATION_KEYS: NotificationKey[] = [
  'resultApproved',
  'resultChanged',
  'newsletter',
]

export const SessionContext = createContext<SessionValue | null>(null)
