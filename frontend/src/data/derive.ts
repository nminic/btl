import type { BtlEvent, Competitor, Gender, Result } from './types'

/* Everything the screens compute out of raw results. Pure functions, so the
 * rules can be tested without a screen, and so the same rule is not written
 * twice on two pages.
 *
 * The rules themselves come from PDL P12:
 * - the general standing is the sum of ALL races, never the best N,
 * - there is a men's list and a women's list, never one combined,
 * - every tie is broken in favour of the larger volume, never efficiency.
 */

export type Totals = {
  races: number
  kilometers: number
  ascent: number
  descent: number
  seconds: number
  points: number
}

export type RankingRow = Totals & {
  position: number
  competitor: Competitor
}

export const EMPTY_TOTALS: Totals = {
  races: 0,
  kilometers: 0,
  ascent: 0,
  descent: 0,
  seconds: 0,
  points: 0,
}

export function seasonOf(result: Result): number {
  return Number(result.date.slice(0, 4))
}

/** Newest first, and only seasons that actually have results. */
export function seasonsWithResults(results: Result[]): number[] {
  return [...new Set(results.map(seasonOf))].sort((left, right) => right - left)
}

export function addToTotals(totals: Totals, result: Result): Totals {
  return {
    races: totals.races + 1,
    kilometers: totals.kilometers + result.distanceKm,
    ascent: totals.ascent + result.ascentM,
    descent: totals.descent + result.descentM,
    seconds: totals.seconds + result.seconds,
    points: totals.points + result.points,
  }
}

export function totalsOf(results: Result[]): Totals {
  return results.reduce(addToTotals, EMPTY_TOTALS)
}

export function resultsOf(results: Result[], memberNumber: string, season?: number): Result[] {
  return results
    .filter((result) => result.memberNumber === memberNumber)
    .filter((result) => season === undefined || seasonOf(result) === season)
    .sort((left, right) => right.date.localeCompare(left.date))
}

export type RankingFilter = {
  season: number
  gender: Gender
  categoryCode?: string
  search?: string
}

/**
 * The standing for one season and one gender. Ordered by points, and when
 * points tie, by the number of races: volume wins, never efficiency.
 */
export function rankingFor(
  competitors: Competitor[],
  results: Result[],
  filter: RankingFilter,
): RankingRow[] {
  const totals = new Map<string, Totals>()

  for (const result of results) {
    if (seasonOf(result) !== filter.season) {
      continue
    }

    totals.set(result.memberNumber, addToTotals(totals.get(result.memberNumber) ?? EMPTY_TOTALS, result))
  }

  const search = (filter.search ?? '').trim().toLowerCase()

  return competitors
    .filter((competitor) => competitor.gender === filter.gender)
    .filter(
      (competitor) =>
        filter.categoryCode === undefined || competitor.categoryCode === filter.categoryCode,
    )
    .map((competitor) => ({
      competitor,
      ...(totals.get(competitor.memberNumber) ?? EMPTY_TOTALS),
    }))
    .filter((row) => row.races > 0)
    .sort((left, right) => right.points - left.points || right.races - left.races)
    .map((row, index) => ({ ...row, position: index + 1 }))
    .filter(
      (row) =>
        search === '' ||
        `${row.competitor.firstName} ${row.competitor.lastName} ${row.competitor.memberNumber}`
          .toLowerCase()
          .includes(search),
    )
}

/** Category codes present in a gender's field, in a stable order. */
export function categoriesOf(competitors: Competitor[], gender: Gender): string[] {
  return [
    ...new Set(
      competitors.filter((competitor) => competitor.gender === gender).map((c) => c.categoryCode),
    ),
  ].sort()
}

export function eventsInMonth(events: BtlEvent[], year: number, month: number): BtlEvent[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`

  return events
    .filter((event) => event.date.startsWith(prefix))
    .sort((left, right) => left.date.localeCompare(right.date))
}

/** Every month that holds at least one event, oldest first, as "YYYY-MM". */
export function monthsWithEvents(events: BtlEvent[]): string[] {
  return [...new Set(events.map((event) => event.date.slice(0, 7)))].sort()
}
