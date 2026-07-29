import { categoryCodeFor } from './categories'
import type { BtlEvent, Competitor, Gender, RaceCategory, Result, Team } from './types'

/* Everything the screens compute out of raw results. Pure functions, so the
 * rules can be tested without a screen, and so the same rule is not written
 * twice on two pages.
 *
 * The rules themselves come from PDL P12:
 * - the general standing is the sum of ALL races, never the best N,
 * - there is a men's list and a women's list, never one combined,
 * - every tie is broken in favour of the larger volume, never efficiency.
 */

/** The five length categories, in the order they are always shown. */
export const CATEGORIES: RaceCategory[] = ['short', 'long', 'half', 'marathon', 'ultra']

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

/** A standing that cannot fill a podium is not a standing. */
const SMALLEST_FIELD = 3

/**
 * Which season the rankings open on: the running one, as long as it has a
 * field to show. Until the season fills up, the screen opens on the fullest one
 * there is, so nobody judges the table by a season with two people in it.
 */
export function defaultSeason(results: Result[], today: string): number {
  const current = Number(today.slice(0, 4))
  const fields = new Map<number, Set<string>>()

  for (const result of results) {
    const season = seasonOf(result)
    const field = fields.get(season) ?? new Set<string>()

    field.add(result.memberNumber)
    fields.set(season, field)
  }

  if ((fields.get(current)?.size ?? 0) >= SMALLEST_FIELD) {
    return current
  }

  const fullest = [...fields.entries()].sort((left, right) => right[1].size - left[1].size)[0]

  return fullest === undefined ? current : fullest[0]
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
        filter.categoryCode === undefined ||
        categoryOfMember(competitor, filter.season) === filter.categoryCode,
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

/**
 * Totals per competitor in one pass. Filtering the whole result set once per
 * competitor is thirty times the work for the same answer, and it showed.
 */
export function totalsByMember(results: Result[]): Map<string, Totals> {
  const totals = new Map<string, Totals>()

  for (const result of results) {
    totals.set(result.memberNumber, addToTotals(totals.get(result.memberNumber) ?? EMPTY_TOTALS, result))
  }

  return totals
}

export type TeamRow = {
  team: Team
  members: number
  totals: Totals
}

/**
 * Teams by the plain sum of every member, never normalised: more members is
 * meant to be an advantage, and a tie goes to the bigger team (PDL P12). A
 * rule that rewarded the smaller team is explicitly excluded.
 */
export function rankTeams(teams: Team[], competitors: Competitor[], results: Result[]): TeamRow[] {
  return teams
    .map((team) => {
      const numbers = new Set(
        competitors.filter((one) => one.teamId === team.id).map((one) => one.memberNumber),
      )

      return {
        team,
        members: numbers.size,
        totals: totalsOf(results.filter((result) => numbers.has(result.memberNumber))),
      }
    })
    .sort((left, right) => right.totals.points - left.totals.points || right.members - left.members)
}

/** The category a member competes in for a season, derived rather than stored:
 *  the age band moves with the year, so storing it would go stale. */
export function categoryOfMember(competitor: Competitor, season: number): string {
  return categoryCodeFor(
    competitor.gender,
    competitor.birthYear,
    season,
    competitor.firstSeason2027,
  )
}

/** Category codes present in a gender's field, in a stable order. */
export function categoriesOf(
  competitors: Competitor[],
  gender: Gender,
  season: number,
): string[] {
  return [
    ...new Set(
      competitors
        .filter((competitor) => competitor.gender === gender)
        .map((competitor) => categoryOfMember(competitor, season)),
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

/**
 * Which month the calendar opens on: the first month from today onwards that
 * holds an event, or the last month there is if the season is over. Opening on
 * an empty month is the worst of the three.
 */
export function defaultMonth(events: BtlEvent[], today: string): string {
  const months = monthsWithEvents(events)
  const ahead = months.find((month) => month >= today.slice(0, 7))

  return ahead ?? months[months.length - 1] ?? today.slice(0, 7)
}

/** Days of a month laid out Monday to Sunday, with the leading and trailing
 *  blanks the grid needs. Null is a cell outside the month. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // getUTCDay() is 0 for Sunday; the week here starts on Monday.
  const lead = (first.getUTCDay() + 6) % 7
  const cells: (number | null)[] = Array.from({ length: lead }, () => null)

  for (let day = 1; day <= days; day += 1) {
    cells.push(day)
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

export type SeriesEntry = {
  name: string
  next: BtlEvent
  /** How many more times the same event runs after this one. */
  more: number
}

/**
 * The calendar extract for the front page. A recurring event takes one row and
 * says when it runs next, instead of five consecutive Wednesdays taking five of
 * the few places there are.
 */
export function upcomingSeries(events: BtlEvent[], today: string, limit: number): SeriesEntry[] {
  const ahead = events
    .filter((event) => event.date >= today && event.status !== 'cancelled')
    .sort((left, right) => left.date.localeCompare(right.date))

  const byName = new Map<string, BtlEvent[]>()

  for (const event of ahead) {
    byName.set(event.name, [...(byName.get(event.name) ?? []), event])
  }

  return [...byName.values()]
    .map((runs) => ({ name: runs[0].name, next: runs[0], more: runs.length - 1 }))
    .sort((left, right) => left.next.date.localeCompare(right.next.date))
    .slice(0, limit)
}

/**
 * The ten to show on the front page. Once a season has results this is simply
 * its standing. Before that it lists the members who have joined, oldest
 * membership first, because in a preparation year who is already in the league
 * is the only interesting thing there is (PDL P14).
 */
export function topTen(
  competitors: Competitor[],
  results: Result[],
  season: number,
  gender: Gender,
): RankingRow[] {
  const ranked = rankingFor(competitors, results, { season, gender }).slice(0, 10)

  if (ranked.length > 0) {
    return ranked
  }

  return competitors
    .filter((competitor) => competitor.gender === gender)
    // The member number is handed out on activation, so its order is the order
    // people joined in.
    .sort((left, right) => left.memberNumber.localeCompare(right.memberNumber))
    .slice(0, 10)
    .map((competitor, index) => ({ competitor, position: index + 1, ...EMPTY_TOTALS }))
}

/** The most recently joined members, for "the community in numbers". */
export function newestMembers(competitors: Competitor[], count: number): Competitor[] {
  return [...competitors]
    .sort((left, right) => right.memberNumber.localeCompare(left.memberNumber))
    .slice(0, count)
}

export type CategoryColumn = {
  competitor: Competitor
  count: number
}

/** Who ran the most races of one length in a season, tallest first. Anyone who
 *  ran none of that length is left out rather than shown as a zero. */
export function topByCategory(
  competitors: Competitor[],
  results: Result[],
  season: number,
  category: RaceCategory,
  limit: number,
): CategoryColumn[] {
  const counts = new Map<string, number>()

  for (const result of results) {
    if (seasonOf(result) === season && result.category === category) {
      counts.set(result.memberNumber, (counts.get(result.memberNumber) ?? 0) + 1)
    }
  }

  return competitors
    .map((competitor) => ({ competitor, count: counts.get(competitor.memberNumber) ?? 0 }))
    .filter((column) => column.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
}

/**
 * The BTL table: one standing for a season with everybody in it, men and women
 * together, which is what the league's own table always was. The rankings
 * screen splits by gender and category; this one deliberately does not.
 */
export function overallStanding(
  competitors: Competitor[],
  results: Result[],
  season: number,
): RankingRow[] {
  const totals = new Map<string, Totals>()

  for (const result of results) {
    if (seasonOf(result) === season) {
      totals.set(
        result.memberNumber,
        addToTotals(totals.get(result.memberNumber) ?? EMPTY_TOTALS, result),
      )
    }
  }

  return competitors
    .map((competitor) => ({
      competitor,
      ...(totals.get(competitor.memberNumber) ?? EMPTY_TOTALS),
    }))
    .filter((row) => row.races > 0)
    .sort((left, right) => right.points - left.points || right.races - left.races)
    .map((row, index) => ({ ...row, position: index + 1 }))
}
