import { AGE_BANDS, FIRST_SEASON_BAND, type AgeBand } from './categories'
import type { Competitor, Gender, SeasonCategory } from './types'

/**
 * THE FROZEN SEASON AS THE SERVER WROTE IT DOWN, READ AND NOT WORKED OUT.
 *
 * PDL, owner, 31.07.2026, „Zamrznuta sezona je materijalizovan zapis, ne izračun": from 16:00 on 1
 * January every table of the season that ended is what the freeze wrote (`FrozenSeasonApi`), and the
 * screens draw it as it stands. Nothing here sums, places or orders anything; it reads the answer of
 * `GET /api/frozen-tables/{season}` into types, and it builds, for a row of a member, the record the
 * screens already draw a member with.
 *
 * **Which season is frozen is the record's, never the clock's** (PDL, derived 10.10.2026, „za čitanje
 * zamrznutosti odlučuje zapis o činu, ne sat"): a screen asks `GET /api/frozen-seasons` and reads a
 * snapshot only for a season on that list. Between 16:00 and the moment the freeze has run the season
 * is still read live, and that is the boundary `ASeasonFreezes` names.
 */

/** A member as a row of the snapshot names him (ADL A37, „Snimak nosi i ime i vezu"). */
export type FrozenPerson = {
  /** Null where he is no longer a member of the portal: deleted on request, or after five years. */
  memberNumber: string | null
  /** Null where he asked to be deleted, and the reader writes the word for a deleted member. */
  who: string | null
  gender: Gender
}

export type FrozenTotals = {
  points: number
  races: number
  kilometers: number
  ascent: number
  descent: number
  seconds: number
}

export type FrozenStanding = FrozenPerson &
  FrozenTotals & {
    position: number
    categoryPosition: number
    /** The code of his category IN THAT SEASON, public (PDL, „Oblik zamrzavanja", point 6). */
    category: string
  }

export type FrozenTeamMember = FrozenPerson & FrozenTotals & { position: number }

export type FrozenTeam = FrozenTotals & {
  position: number
  /** Null where the team has since been deleted: its name stays and has no link. */
  slug: string | null
  name: string
  members: number
  roster: FrozenTeamMember[]
}

export type FrozenBoard = FrozenPerson &
  FrozenTotals & {
    board: string
    length: string | null
    position: number
    previousPoints: number | null
    raceName: string | null
  }

export type FrozenPair = FrozenTotals & { position: number; halves: [FrozenPerson, FrozenPerson] }

export type FrozenColumn = { eventSlug: string | null; date: string; name: string }

export type FrozenLeagueRow = FrozenPerson & {
  position: number
  points: number
  cells: { column: number; points: number }[]
}

export type FrozenLeague = {
  slug: string
  name: string
  columns: FrozenColumn[]
  standings: FrozenLeagueRow[]
}

export type FrozenAward = FrozenPerson & {
  kind: string
  category: string | null
  position: number
  points: number
  teamName: string | null
}

export type FrozenTables = {
  season: number
  standings: FrozenStanding[]
  teams: FrozenTeam[]
  boards: FrozenBoard[]
  pairs: FrozenPair[]
  leagues: FrozenLeague[]
  awards: FrozenAward[]
  /** What every member held at the freeze, with or without the right to rank (V83). */
  pointsAtTheFreeze: { memberNumber: string; points: number }[]
}

export type FrozenSeason = { season: number }

/* WHAT THE ANSWER SAYS, READ FIELD BY FIELD. A field of the wrong kind makes the whole answer
   unreadable rather than a row of wrong numbers: a table that silently draws half a snapshot would
   say something about a season that the freeze did not write. */

class Unreadable extends Error {}

function fieldOf(body: unknown, name: string): unknown {
  if (typeof body !== 'object' || body === null) {
    throw new Unreadable(name)
  }

  return Reflect.get(body, name)
}

function aNumber(body: unknown, name: string): number {
  const value = fieldOf(body, name)

  if (typeof value !== 'number') {
    throw new Unreadable(name)
  }

  return value
}

function aText(body: unknown, name: string): string {
  const value = fieldOf(body, name)

  if (typeof value !== 'string') {
    throw new Unreadable(name)
  }

  return value
}

function aTextOrNone(body: unknown, name: string): string | null {
  const value = fieldOf(body, name)

  return value === null ? null : aText(body, name)
}

function aNumberOrNone(body: unknown, name: string): number | null {
  return fieldOf(body, name) === null ? null : aNumber(body, name)
}

function aList<T>(body: unknown, name: string, each: (one: unknown) => T): T[] {
  const value = fieldOf(body, name)

  if (!Array.isArray(value)) {
    throw new Unreadable(name)
  }

  return value.map(each)
}

function aGender(body: unknown): Gender {
  const value = aText(body, 'gender')

  if (value !== 'M' && value !== 'F') {
    throw new Unreadable('gender')
  }

  return value
}

function person(body: unknown): FrozenPerson {
  return { memberNumber: aTextOrNone(body, 'memberNumber'), who: aTextOrNone(body, 'who'), gender: aGender(body) }
}

/** The two halves of a pair, the larger first, and never another number of them. */
function twoHalves(body: unknown): [FrozenPerson, FrozenPerson] {
  const [first, second, ...more] = aList(body, 'halves', person)

  if (first === undefined || second === undefined || more.length > 0) {
    throw new Unreadable('halves')
  }

  return [first, second]
}

function totals(body: unknown): FrozenTotals {
  return {
    points: aNumber(body, 'points'),
    races: aNumber(body, 'races'),
    kilometers: aNumber(body, 'kilometers'),
    ascent: aNumber(body, 'ascent'),
    descent: aNumber(body, 'descent'),
    seconds: aNumber(body, 'seconds'),
  }
}

function tablesOf(body: unknown): FrozenTables {
  return {
    season: aNumber(body, 'season'),
    standings: aList(body, 'standings', (one) => ({
      ...person(one),
      ...totals(one),
      position: aNumber(one, 'position'),
      categoryPosition: aNumber(one, 'categoryPosition'),
      category: aText(one, 'category'),
    })),
    teams: aList(body, 'teams', (one) => ({
      ...totals(one),
      position: aNumber(one, 'position'),
      slug: aTextOrNone(one, 'slug'),
      name: aText(one, 'name'),
      members: aNumber(one, 'members'),
      roster: aList(one, 'roster', (member) => ({ ...person(member), ...totals(member), position: aNumber(member, 'position') })),
    })),
    boards: aList(body, 'boards', (one) => ({
      ...person(one),
      ...totals(one),
      board: aText(one, 'board'),
      length: aTextOrNone(one, 'length'),
      position: aNumber(one, 'position'),
      previousPoints: aNumberOrNone(one, 'previousPoints'),
      raceName: aTextOrNone(one, 'raceName'),
    })),
    pairs: aList(body, 'pairs', (one) => ({ ...totals(one), position: aNumber(one, 'position'), halves: twoHalves(one) })),
    leagues: aList(body, 'leagues', (one) => ({
      slug: aText(one, 'slug'),
      name: aText(one, 'name'),
      columns: aList(one, 'columns', (column) => ({
        eventSlug: aTextOrNone(column, 'eventSlug'),
        date: aText(column, 'date'),
        name: aText(column, 'name'),
      })),
      standings: aList(one, 'standings', (row) => ({
        ...person(row),
        position: aNumber(row, 'position'),
        points: aNumber(row, 'points'),
        cells: aList(row, 'cells', (cell) => ({ column: aNumber(cell, 'column'), points: aNumber(cell, 'points') })),
      })),
    })),
    awards: aList(body, 'awards', (one) => ({
      ...person(one),
      kind: aText(one, 'kind'),
      category: aTextOrNone(one, 'category'),
      position: aNumber(one, 'position'),
      points: aNumber(one, 'points'),
      teamName: aTextOrNone(one, 'teamName'),
    })),
    pointsAtTheFreeze: aList(body, 'pointsAtTheFreeze', (one) => ({
      memberNumber: aText(one, 'memberNumber'),
      points: aNumber(one, 'points'),
    })),
  }
}

/** The answer of `GET /api/frozen-tables/{season}`, or null where it is not the shape the server gives. */
export function frozenTablesIn(body: unknown): FrozenTables | null {
  try {
    return tablesOf(body)
  } catch (unreadable) {
    if (unreadable instanceof Unreadable) {
      return null
    }

    throw unreadable
  }
}

/**
 * The category a code names, as the record of a season holds it: the band, or the beginners' mark.
 *
 * A code is the gender's mark and the band (`M40-54`), or the mark and „R" (`Ž R`), which is how
 * `categoryCodeFor` writes it and how the server writes it into the snapshot (`SeasonTables.categoryCode`).
 * A beginner keeps the first band only because the record has a place for one; nothing draws it, because
 * `categoryCodeFor` reads the mark „R" first.
 */
export function categoryOfTheCode(code: string, season: number): SeasonCategory | null {
  if (code.endsWith(` ${FIRST_SEASON_BAND}`)) {
    return { season, ageBand: AGE_BANDS[0], beginner: true }
  }

  const band: AgeBand | undefined = AGE_BANDS.find((one) => one === code.slice(1))

  return band === undefined ? null : { season, ageBand: band, beginner: false }
}

/**
 * The record a screen draws a member of a frozen row with: his name and his category AS THE FREEZE WROTE
 * THEM, his portrait where he is still a member the portal serves, and nothing else of today.
 *
 * - Still a member the list serves (`live`): his record, with the name and the category of the snapshot
 *   written over it. Whether his name is a link is the reader's question, asked of that record by
 *   `useProfileLink` like any other (ADL A37): a member who hides his profile is a name as text to whoever
 *   may not read a hidden profile.
 * - A number the list does not serve (his fee lapsed), or no number (deleted after five years): his name
 *   as text and no portrait. The caller draws no link for him, because there is no profile to open (PDL,
 *   „Ime neaktivnog člana ostaje vidljivo u istorijskim tabelama te godine, ali kao običan tekst, bez
 *   linka").
 * - No name (deleted on request): `deleted`, the word for a deleted member of his gender (ADL A37).
 */
export function standIn(
  one: FrozenPerson,
  live: Competitor | undefined,
  season: number,
  category: string | null,
  deleted: string,
): Competitor {
  const name = one.who ?? deleted
  const space = name.indexOf(' ')
  const firstName = space < 0 ? name : name.slice(0, space)
  const lastName = space < 0 ? '' : name.slice(space + 1)
  const ofTheSeason = category === null ? null : categoryOfTheCode(category, season)
  const categories = ofTheSeason === null ? [] : [ofTheSeason]

  if (live !== undefined) {
    return { ...live, firstName, lastName, categories, chosenCategory: undefined }
  }

  return {
    memberNumber: one.memberNumber ?? '',
    firstName,
    lastName,
    gender: one.gender,
    city: '',
    country: '',
    category: null,
    categories,
    firstSeason: season,
    profileHidden: true,
    birthdayShown: 'none',
    teamId: null,
    teamSince: null,
    bio: null,
    photo: null,
    crop: null,
    smallPhoto: null,
  }
}

/** The member a row names, among the members the portal serves today, or none. */
export function theLiveOne(one: FrozenPerson, live: Map<string, Competitor>): Competitor | undefined {
  return one.memberNumber === null ? undefined : live.get(one.memberNumber)
}

/** What each member held in a frozen season at its freeze, by member number. */
export function pointsAtTheFreeze(tables: FrozenTables): Map<string, number> {
  return new Map(tables.pointsAtTheFreeze.map((one) => [one.memberNumber, one.points]))
}
