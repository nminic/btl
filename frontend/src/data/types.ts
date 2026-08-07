/* Domain types, in the terminology fixed by ADL A2: an event (dogadjaj) holds
 * one or more races (trka). The word "distance" is never an entity, because
 * timed and free races have no fixed length.
 */

export type Gender = 'M' | 'F'

/** The five length categories from PDL P5. Marathon and half marathon are
 *  recognised by the exact value 42.2 and 21.1, with no tolerance. */
/* Shortest to longest, the same order as CATEGORIES in derive.ts, which is
   where the order is decided and where a test holds it. */
export type RaceCategory = 'short' | 'half' | 'long' | 'marathon' | 'ultra'

export type EventStatus = 'announced' | 'confirmed' | 'checking' | 'cancelled'

export type MembershipBasis = 'payment' | 'honorary'

export type Competitor = {
  memberNumber: string
  firstName: string
  lastName: string
  gender: Gender
  city: string
  country: string
  /** Never shown publicly (PDL P23); the age band is derived from it. */
  birthYear: number
  /** Whether this member is spending the 2027 season in the first season
   *  category rather than in their age band. */
  firstSeason2027: boolean
  firstSeason: number
  active: boolean
  membershipBasis: MembershipBasis
  teamId: string | null
  /**
   * The season this member joined their club, which is not the season they
   * joined the league.
   *
   * The profile names both, one after the other, because they answer different
   * questions and people join a club years after they start racing (owner,
   * 31.07.2026). Null wherever there is no club, so the two always travel
   * together and a club can never be named without a year.
   */
  teamSince: number | null
  /**
   * The racing biography, as published.
   *
   * Written by the member and edited and published by a moderator, never handed
   * back (PDL P11, P22), so what is here is what went out. Empty for most of
   * them, which is the state the profile has to look right in.
   */
  bio: string
}

export type Race = {
  id: string
  eventId: string
  name: string
  distanceKm: number
  ascentM: number
  descentM: number
  category: RaceCategory
}

export type BtlEvent = {
  id: string
  slug: string
  name: string
  date: string
  city: string
  country: string
  organizer: string
  status: EventStatus
  raceIds: string[]
}

export type Result = {
  id: string
  memberNumber: string
  raceId: string
  eventName: string
  /**
   * The address of the event this race belonged to, carried on the result
   * itself the way the event's name already is.
   *
   * Every race named in a table of results is a link to its event (owner,
   * 31.07.2026). The alternative was for each such screen to load the races and
   * the events as well, two files of one and a half and one and two tenths
   * thousand rows, to print one column. A results endpoint would join the event
   * anyway, so this is the shape the backend will hand back.
   */
  eventSlug: string
  date: string
  distanceKm: number
  ascentM: number
  descentM: number
  seconds: number
  points: number
  category: RaceCategory
}

export type Team = {
  id: string
  slug: string
  name: string
  city: string
  country: string
  organizerMemberNumber: string
  /**
   * What the team says about itself, as published.
   *
   * The first third of the team page (owner, 31.07.2026), beside the races and
   * the figures. Empty on a team that has just been founded, which is the state
   * the page has to look right in.
   */
  bio: string
}

export type League = {
  id: string
  slug: string
  name: string
  season: number
  /** RunTrace league groups by gender only, so this is per league. */
  groupsByCategory: boolean
  eventIds: string[]
  /** Written for this league; empty until somebody writes it, and then the
   *  section does not appear at all. */
  rules: string
  prizes: string
}

/**
 * Somebody the superadmin has made a moderator (PDL P21, P28a).
 *
 * Three things are asked for and the fourth is given rather than typed. There is
 * no password here and there never will be: a credential somebody else types is
 * a credential two people know, so the moderator sets their own when the backend
 * arrives (ADL A8).
 *
 * `rights` is what the superadmin has ticked, as the keys from rights.ts. An
 * empty list is not a broken record, it is a moderator who has just been made and
 * may do nothing yet.
 */
export type Moderator = {
  id: string
  firstName: string
  lastName: string
  email: string
  rights: string[]
}

export type PageSection = {
  heading: string
  body: string
  /**
   * A drawing the section carries under its text, named rather than written.
   *
   * The renderer of written pages is a deliberately small subset of Markdown and
   * has no pictures in it (ADL A7), which is right: an administrator writes these
   * records, and a page that can point at any image is a page that can point at
   * anything. One name for one drawing the portal already has is a different
   * thing, and it is what the rulebook needed when the owner made the badges a
   * section of it rather than a screen of their own (04.08.2026).
   *
   * The list is closed and it is this: `badges`, the wall of every badge the
   * league awards.
   */
  gallery?: 'badges'
}

/** A page of written text: the rulebook, the terms, the page about the league.
 *  Kept as data rather than in the translation dictionary because these run to
 *  thousands of words and are written and revised on their own schedule. */
export type StaticPage = {
  title: string
  sections: PageSection[]
  /**
   * Slugs of other written pages shown above this page's own sections.
   *
   * One text that belongs on two screens is kept once and pointed at twice: the
   * address of the president stands on the front page and on "O ligi" (PDL P28a),
   * and the administrator who maintains it edits one record. Copying it into both
   * would guarantee that one of the copies is out of date.
   */
  includes?: string[]
}

/* What is waiting for a decision, in the seven queues that are read from a file.
 *
 * Here rather than beside the screens that draw it, because it describes a file
 * under `public/mock` and `src/data` is the only place that says what the
 * portal's data looks like. It also has to be reachable from the session: a
 * competitor proposes a team during a visit, and that proposal joins the same
 * queue as everything read off the disc, so both ends need the shape and neither
 * may import the other.
 */
export const PENDING_QUEUE_IDS = [
  'payments',
  'leagues',
  'teams',
  'bios',
  'photos',
  'comments',
  'schedule',
] as const

export type PendingQueueId = (typeof PENDING_QUEUE_IDS)[number]

/**
 * What a member wrote about an event, once it is out on the portal.
 *
 * The queue item it came from stays in the queue: this is the record of what was
 * published, and it is what every public screen reads. Keeping one shape for
 * both would mean a comment on the event page carrying an email address and two
 * dates it has no use for, and every reader of it deciding all over again what
 * counts as published.
 */
export type EventComment = {
  id: string
  /** Which event, by the id and not the name: an event is copied into the next
   *  season with its name unchanged (PDL P6), and a comment belongs to the one
   *  it was written about. */
  eventId: string
  memberNumber: string
  /** The name as it was when the comment went out, for a comment whose author
   *  has since left the league and has no profile to read it off. */
  who: string
  date: string
  rating: EventRating
  /** Empty where the member rated the event and said nothing, which the form
   *  allows on purpose (RateEvent.tsx). */
  body: string
}

/** The three marks an event is rated on (PDL P6). The names are the owner's,
 *  with "okruženje" renamed to "ambijent" on 07.08.2026. */
export type EventRating = {
  organisation: number
  value: number
  ambience: number
}

/** What the six queues that are not about an event carry, and what a comment
 *  written before the ratings existed carries. Written once, so the six do not
 *  each spell out three noughts. */
export const NO_RATING: EventRating = { organisation: 0, value: 0, ambience: 0 }

export type PendingItem = {
  id: string
  queue: PendingQueueId
  /** The day it arrived in the queue. */
  date: string
  /**
   * Who sent it in, or empty. A change of date may be reported by somebody with
   * no account at all (PDL P10), and on the payments queue it is empty for a
   * different reason: a registration whose fee is not recorded has no member
   * number yet, which is the whole of the 30.07.2026 decision made visible in
   * the data.
   */
  memberNumber: string
  who: string
  /** What the decision is about: the name of the league, the team, the member
   *  or the event. */
  subject: string
  /**
   * The same thing by its id, where approving it has to write a record about it.
   *
   * A name is what a moderator reads and is not what a record is filed under: two
   * events across two seasons carry one name (PDL P6), so a comment approved by
   * its subject would land on whichever of them was looked up first. Empty on
   * every queue whose approval writes nothing.
   */
  subjectId: string
  /** The text to read before deciding: the biography, the comment, the reason
   *  given, or the file name of a picture. */
  body: string
  /** A reported change of date carries both dates, so the difference is the
   *  thing on screen. Empty on every other queue. */
  currentDate: string
  proposedDate: string
  /**
   * What a member thought of the event, on the comments queue and nought
   * everywhere else (PDL P6, owner 06.08.2026).
   *
   * Three marks and not four. The fourth is the overall, and PDL P6 says it is
   * arithmetic: the average of these three. Stored as well it would be a fourth
   * place for the same fact to disagree with itself, and the first rounding
   * anybody changed would leave two answers on the portal at once.
   *
   * A comment with no rating at all is nought on all three: the rating is what
   * a member came to give and the comment is optional, so a nought here means
   * the record predates the rating rather than that somebody rated it nothing.
   */
  rating: EventRating
  /** The payments queue only. Until the fee is recorded there is no number to go
   *  by, so a waiting registration is known by its name and its address (PDL
   *  P8). Empty on the other six. */
  email: string
  /**
   * The town and the country, on the two queues that have one.
   *
   * On the payments, because how a member pays follows the country they live in
   * (PDL P8), so it belongs beside the fee. On the new teams, because approving
   * a proposal is what makes the team and these are two of the four things it is
   * made from (PDL P13). Empty on the other five.
   */
  city: string
  country: string
}
