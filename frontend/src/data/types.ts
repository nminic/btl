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

/** A page of written text: the rulebook, the terms, the page about the league.
 *  Kept as data rather than in the translation dictionary because these run to
 *  thousands of words and are written and revised on their own schedule. */
export type StaticPage = {
  title: string
  sections: { heading: string; body: string }[]
}
