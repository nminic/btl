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

/** One competitor with the totals a list is ordering them by. */
export type TotalsRow = Totals & { competitor: Competitor }

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

/* How every list is ordered, and what happens when the order runs out of
 * measures. Both come from PDL P12: volume decides first, efficiency may only
 * settle a complete tie, and a tie that survives the whole ladder is shown as a
 * shared place instead of being broken by accident.
 */

/** One rung of a ladder: the number a list compares two rows by. */
type Measure<T> = (row: T) => number

/**
 * Orders by the given measures in turn, highest first, taking the next one only
 * when the one before it leaves the two rows level. Written once because every
 * list has a ladder and none of them has the same one.
 */
function byLadder<T>(measures: Measure<T>[]): (left: T, right: T) => number {
  return (left, right) => {
    for (const measure of measures) {
      const difference = measure(right) - measure(left)

      if (difference !== 0) {
        return difference
      }
    }

    return 0
  }
}

const VERTICAL: Measure<TotalsRow> = (row) => row.ascent + row.descent

/** A row of a list once it knows which place it holds. */
export type Placed<T> = T & { position: number }

/**
 * Numbers an ordered list. Rows the ladder leaves level share one number and
 * the number after them is skipped, so a shared first place reads 1, 1, 3, and
 * inside a shared place the smaller member number comes first (PDL P12).
 *
 * That inner order is not a measure and means nothing. It is there so the table
 * does not shuffle on every recount and the Δ column does not invent arrows up
 * and down, which is a fault nobody could explain to a member.
 *
 * `compare` is the ladder the list was sorted by, so two rows count as level
 * only when every rung of it leaves them equal.
 */
export function withPlaces<T extends object>(
  rows: T[],
  compare: (left: T, right: T) => number,
  memberNumberOf: (row: T) => string,
): Placed<T>[] {
  const placed: Placed<T>[] = []
  let start = 0

  while (start < rows.length) {
    /* How far the shared place reaches. Every row in it is compared with the
     * first one rather than with the one before it, so a ladder that leaves
     * three rows level gives all three the same number. */
    let end = start + 1

    while (end < rows.length && compare(rows[start], rows[end]) === 0) {
      end += 1
    }

    const tied = rows
      .slice(start, end)
      .sort((left, right) => memberNumberOf(left).localeCompare(memberNumberOf(right)))

    for (const row of tied) {
      placed.push({ ...row, position: start + 1 })
    }

    start = end
  }

  return placed
}

export type RankingRow = Placed<TotalsRow>

export type RankingFilter = {
  season: number
  gender: Gender
  categoryCode?: string
  search?: string
}

/** The ladder of the general standing (PDL P12): points, kilometres, more
 *  races, vertical, and then a shared place. */
const STANDING = byLadder<TotalsRow>([
  (row) => row.points,
  (row) => row.kilometers,
  (row) => row.races,
  VERTICAL,
])

/**
 * The standing for one season and one gender, ordered down the ladder above:
 * volume wins, never efficiency, and a tie nothing separates is shared.
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

  const ranked = competitors
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
    .sort(STANDING)

  return withPlaces(ranked, STANDING, (row) => row.competitor.memberNumber).filter(
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

/** The ladder of the team board (PDL P12): points, more members of the team,
 *  the kilometres of every member, the races of every member, then a shared
 *  place. It stopped at the member count before, so two teams level on points
 *  and on size were left in whatever order the team list happened to be in. */
const BY_TEAM = byLadder<TeamRow>([
  (row) => row.totals.points,
  (row) => row.members,
  (row) => row.totals.kilometers,
  (row) => row.totals.races,
])

/**
 * Teams by the plain sum of every member, never normalised: more members is
 * meant to be an advantage, and a tie goes to the bigger team (PDL P12). A
 * rule that rewarded the smaller team is explicitly excluded.
 *
 * A tie the whole ladder leaves standing is a shared place, like everywhere
 * else. Inside one, the order is by team id rather than by member number: a
 * team has no member number, and what the rule is for is that the table does
 * not shuffle between two recounts of the same data.
 *
 * The results are taken as given, so the caller decides whether the board is
 * one season or the whole history.
 */
export function rankTeams(
  teams: Team[],
  competitors: Competitor[],
  results: Result[],
): Placed<TeamRow>[] {
  const rows = teams.map((team) => {
    const numbers = new Set(
      competitors.filter((one) => one.teamId === team.id).map((one) => one.memberNumber),
    )

    return {
      team,
      members: numbers.size,
      totals: totalsOf(results.filter((result) => numbers.has(result.memberNumber))),
    }
  })

  return withPlaces(rows.sort(BY_TEAM), BY_TEAM, (row) => row.team.id)
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

/* The top boards (PDL P12). Each one keeps ten places and each one is ordered
 * down a ladder of measures: volume decides first, and efficiency is only ever
 * allowed to settle a complete tie. The ladders are written out per board
 * below, straight from the table in P12.
 */

/** Everyone who raced in one season, with their totals for it. Nobody who did
 *  not race is in it, because a board of zeroes is not a board. */
function seasonRows(competitors: Competitor[], results: Result[], season: number): TotalsRow[] {
  const totals = totalsByMember(results.filter((result) => seasonOf(result) === season))

  return competitors
    .map((competitor) => ({
      competitor,
      ...(totals.get(competitor.memberNumber) ?? EMPTY_TOTALS),
    }))
    .filter((row) => row.races > 0)
}

export type CategoryColumn = TotalsRow & {
  /** The day the count was reached: the last race of that length in the season.
   *  Whoever got there earlier is ahead, which is why this rung reads the other
   *  way round from all the others. */
  reachedOn: string
}

/* Most races of one length. Ladder: the number of races, then the points, the
 * kilometres and the vertical of exactly those races, then the earlier date.
 *
 * Everything below the count is read from the races of that one length and
 * never from the whole season, or a member's ultras would decide the half
 * marathon board.
 */
const BY_CATEGORY = byLadder<CategoryColumn>([
  (row) => row.races,
  (row) => row.points,
  (row) => row.kilometers,
  VERTICAL,
  // byLadder always puts the larger number first, so the earlier day is fed to
  // it negated.
  (row) => -Date.parse(row.reachedOn),
])

/** Who ran the most races of one length in a season, tallest first. Anyone who
 *  ran none of that length is left out rather than shown as a zero. */
export function topByCategory(
  competitors: Competitor[],
  results: Result[],
  season: number,
  category: RaceCategory,
  limit: number,
): Placed<CategoryColumn>[] {
  /* Oldest first, so the last race written into the tally is the one that
   * completed the count and reachedOn needs no comparing of its own. */
  const inCategory = results
    .filter((result) => seasonOf(result) === season && result.category === category)
    .sort((left, right) => left.date.localeCompare(right.date))

  const tally = new Map<string, { totals: Totals; reachedOn: string }>()

  for (const result of inCategory) {
    tally.set(result.memberNumber, {
      totals: addToTotals(tally.get(result.memberNumber)?.totals ?? EMPTY_TOTALS, result),
      reachedOn: result.date,
    })
  }

  const columns = competitors.flatMap((competitor) => {
    const own = tally.get(competitor.memberNumber)

    return own === undefined ? [] : [{ competitor, ...own.totals, reachedOn: own.reachedOn }]
  })

  return withPlaces(columns.sort(BY_CATEGORY), BY_CATEGORY, (row) => row.competitor.memberNumber)
    .slice(0, limit)
}

/** Most kilometres in a season. Ladder: kilometres, more races, vertical,
 *  points. */
const BY_KILOMETERS = byLadder<TotalsRow>([
  (row) => row.kilometers,
  (row) => row.races,
  VERTICAL,
  (row) => row.points,
])

export function topByKilometers(
  competitors: Competitor[],
  results: Result[],
  season: number,
  limit: number,
): Placed<TotalsRow>[] {
  const rows = seasonRows(competitors, results, season).sort(BY_KILOMETERS)

  return withPlaces(rows, BY_KILOMETERS, (row) => row.competitor.memberNumber).slice(0, limit)
}

/** Longest on the course in a season. Ladder: time, kilometres, more races,
 *  vertical. */
const BY_TIME_ON_COURSE = byLadder<TotalsRow>([
  (row) => row.seconds,
  (row) => row.kilometers,
  (row) => row.races,
  VERTICAL,
])

export function topByTimeOnCourse(
  competitors: Competitor[],
  results: Result[],
  season: number,
  limit: number,
): Placed<TotalsRow>[] {
  const rows = seasonRows(competitors, results, season).sort(BY_TIME_ON_COURSE)

  return withPlaces(rows, BY_TIME_ON_COURSE, (row) => row.competitor.memberNumber).slice(0, limit)
}

export type RaceRow = {
  competitor: Competitor
  result: Result
}

/**
 * The best single races of a season, by the points of one result. Ladder:
 * points, the longer race, then the runner's kilometres and races in the
 * season. The earlier date is deliberately not a rung: the usual tie is two
 * people crossing the line together, which is the same race on the same day.
 */
export function bestSingleRaces(
  competitors: Competitor[],
  results: Result[],
  season: number,
  limit: number,
): Placed<RaceRow>[] {
  const byNumber = new Map(competitors.map((competitor) => [competitor.memberNumber, competitor]))
  const inSeason = results.filter((result) => seasonOf(result) === season)
  const totals = totalsByMember(inSeason)

  /* The season behind the race, carried on the row: the last two rungs need it,
   * and looking it up inside a comparator means looking it up again for every
   * comparison. */
  const rows = inSeason.flatMap((result) => {
    const competitor = byNumber.get(result.memberNumber)
    const seasonTotals = totals.get(result.memberNumber)

    // A result whose member is not in the list is nobody's place. The totals
    // are there for every result of the season; saying so out loud is what
    // lets the rungs below read them without a fallback.
    return competitor === undefined || seasonTotals === undefined
      ? []
      : [{ competitor, result, seasonTotals }]
  })

  const ladder = byLadder<(typeof rows)[number]>([
    (row) => row.result.points,
    (row) => row.result.distanceKm,
    (row) => row.seasonTotals.kilometers,
    (row) => row.seasonTotals.races,
  ])

  return withPlaces(rows.sort(ladder), ladder, (row) => row.competitor.memberNumber).slice(0, limit)
}
