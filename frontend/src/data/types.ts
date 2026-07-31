/* Domain types, in the terminology fixed by ADL A2: an event (dogadjaj) holds
 * one or more races (trka). The word "distance" is never an entity, because
 * timed and free races have no fixed length.
 */

export type Gender = 'M' | 'F'

/** The five length categories from PDL P5. Marathon and half marathon are
 *  recognised by the exact value 42.2 and 21.1, with no tolerance. */
export type RaceCategory = 'short' | 'long' | 'half' | 'marathon' | 'ultra'

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

export type PageSection = { heading: string; body: string }

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
