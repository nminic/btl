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
 * The members of one team, ordered by what each of them brought to it, down the
 * ladder of the general standing and with a tie nothing separates shared, like
 * every other list on the portal (PDL P12).
 *
 * Everybody in the list is in it, results or none: a team page is the team, and
 * leaving out the member who has not raced yet would read as them not belonging.
 *
 * The results are taken as given, so the caller decides whether the page is one
 * season or the whole history.
 */
export function rankMembers(competitors: Competitor[], results: Result[]): RankingRow[] {
  const totals = totalsByMember(results)
  const rows = competitors.map((competitor) => ({
    competitor,
    ...(totals.get(competitor.memberNumber) ?? EMPTY_TOTALS),
  }))

  return withPlaces(rows.sort(STANDING), STANDING, (row) => row.competitor.memberNumber)
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

/** How many places a front page board keeps, whatever the league can fill. */
export const BOARD_PLACES = 10

export type BoardSlot = {
  competitor: Competitor
  points: number
  /** Whether this place was won. False for somebody holding a place while they
   *  wait for their first result of the season. */
  ranked: boolean
}

/**
 * The ten to show on the front page: the standing of the season as far as it
 * goes, and then the members who have joined but not yet raced, oldest
 * membership first, until the ten places are used up.
 *
 * The topping up is PDL P14, and it is there against one thing: "Top 10 liste se
 * prave unapred od registrovanih članova ... Time liste nisu prazne." Two
 * members with a result in the first week of January would otherwise leave eight
 * empty places on each of the two boards, above the fold, in the worst week of
 * the year for the portal to look deserted.
 *
 * A member who is only holding a place is marked, so nothing downstream can show
 * them as having come fifth.
 */
export function boardOfTen(
  competitors: Competitor[],
  results: Result[],
  season: number,
  gender: Gender,
): BoardSlot[] {
  const ranked = rankingFor(competitors, results, { season, gender }).slice(0, BOARD_PLACES)
  const taken = new Set(ranked.map((row) => row.competitor.memberNumber))
  const board: BoardSlot[] = ranked.map((row) => ({
    competitor: row.competitor,
    points: row.points,
    ranked: true,
  }))

  const waiting = competitors
    .filter((competitor) => competitor.gender === gender && !taken.has(competitor.memberNumber))
    // The member number is handed out on activation, so its order is the order
    // people joined in.
    .sort((left, right) => left.memberNumber.localeCompare(right.memberNumber))
    .slice(0, BOARD_PLACES - board.length)
    .map((competitor) => ({ competitor, points: 0, ranked: false }))

  return [...board, ...waiting]
}

/**
 * Everybody whose membership is running, which is who a screen about now shows.
 *
 * A member whose fee has run out is in no list of this season and their name
 * carries no link, because their profile is not there to be linked to (PDL P11:
 * "u tabeli tekuće godine se ne pojavljuje uopšte", "link ka profilu postoji
 * samo dok je članarina aktivna"). Their name does stay in the tables of the
 * seasons they raced, as plain text; those are drawn from results and this does
 * not touch them.
 */
export function activeOnly(competitors: Competitor[]): Competitor[] {
  return competitors.filter((one) => one.active)
}

/**
 * Who a list of one season is drawn from (PDL P11).
 *
 * The season running now shows only members whose fee is paid, because this
 * season the others are not members. Every season before it shows everybody who
 * raced it, exactly as they stood, because they were members then.
 *
 * Which season is running comes from the day, and the day comes from the one
 * clock the portal reads (ADL A7). Never from the SEASON constant: that is 2027
 * for ever, so it would go on hiding people from 2027 after 2027 had become the
 * only archive the league has, and would never hide anybody from 2028.
 *
 * Written once because it was being kept in one place out of four. The standing
 * kept it; the front page and the boards of Article 56 are the same season's
 * standing in another shape and did not, and nothing said so, because the data
 * has one member this is true of and they are in none of those lists.
 */
export function fieldFor(competitors: Competitor[], season: number, today: string): Competitor[] {
  return season === Number(today.slice(0, 4)) ? activeOnly(competitors) : competitors
}

/* The top boards (PDL P12). Each one keeps ten places and each one is ordered
 * down a ladder of measures: volume decides first, and efficiency is only ever
 * allowed to settle a complete tie. The ladders are written out per board
 * below, straight from the table in P12.
 */

/**
 * One competitor with the totals a board is ordering them by and the day they
 * reached them: the last of the races that were counted.
 *
 * Whoever got there earlier is ahead, which is why that rung reads the other way
 * round from all the others. Two boards have it (PDL P12), so it is one type.
 */
export type TallyRow = TotalsRow & { reachedOn: string }

/** What one competitor did over a set of races, and when they finished doing it. */
type Tally = { totals: Totals; reachedOn: string }

/**
 * Totals per competitor over the races handed in, with the day each of them
 * reached their count: the last of those races.
 *
 * Oldest first, so the last thing written into the tally is the race that
 * completed the count and the day needs no comparing of its own.
 *
 * The day matters because "reached earlier wins" is a rung on two of the boards
 * (PDL P12, and Article 57 of the rulebook), so both are counted here rather than
 * one of them keeping the day to itself.
 */
function tallyOf(results: Result[]): Map<string, Tally> {
  const tally = new Map<string, Tally>()

  for (const result of [...results].sort((left, right) => left.date.localeCompare(right.date))) {
    tally.set(result.memberNumber, {
      totals: addToTotals(tally.get(result.memberNumber)?.totals ?? EMPTY_TOTALS, result),
      reachedOn: result.date,
    })
  }

  return tally
}

/** Everyone who raced in one season, with their totals for it and the day they
 *  reached them. Nobody who did not race is in it, because a board of zeroes is
 *  not a board. */
function seasonRows(
  competitors: Competitor[],
  results: Result[],
  season: number,
): TallyRow[] {
  const tally = tallyOf(results.filter((result) => seasonOf(result) === season))

  return competitors.flatMap((competitor) => {
    const own = tally.get(competitor.memberNumber)

    return own === undefined ? [] : [{ competitor, ...own.totals, reachedOn: own.reachedOn }]
  })
}

/* Most races of one length. Ladder: the number of races, then the points, the
 * kilometres and the vertical of exactly those races, then the earlier date.
 *
 * Everything below the count is read from the races of that one length and
 * never from the whole season, or a member's ultras would decide the half
 * marathon board.
 */
const BY_CATEGORY = byLadder<TallyRow>([
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
): Placed<TallyRow>[] {
  const tally = tallyOf(
    results.filter((result) => seasonOf(result) === season && result.category === category),
  )

  const columns = competitors.flatMap((competitor) => {
    const own = tally.get(competitor.memberNumber)

    return own === undefined ? [] : [{ competitor, ...own.totals, reachedOn: own.reachedOn }]
  })

  return withPlaces(columns.sort(BY_CATEGORY), BY_CATEGORY, (row) => row.competitor.memberNumber)
    .slice(0, limit)
}

/**
 * Most kilometres in a season. Ladder: kilometres, more races, vertical, points,
 * then reached earlier, then a shared place.
 *
 * The fifth rung is in P12 and in Article 57 of the rulebook, and it was missing
 * here while the board of races by length already had it: two members level on
 * all four of the others were left in whatever order they happened to be in, and
 * the one who got there in March shared a place with the one who got there in
 * December.
 */
const BY_KILOMETERS = byLadder<TallyRow>([
  (row) => row.kilometers,
  (row) => row.races,
  VERTICAL,
  (row) => row.points,
  // byLadder always puts the larger number first, so the earlier day is fed to
  // it negated.
  (row) => -Date.parse(row.reachedOn),
])

export function topByKilometers(
  competitors: Competitor[],
  results: Result[],
  season: number,
  limit: number,
): Placed<TallyRow>[] {
  const rows = seasonRows(competitors, results, season).sort(BY_KILOMETERS)

  return withPlaces(rows, BY_KILOMETERS, (row) => row.competitor.memberNumber).slice(0, limit)
}

/** Longest on the course in a season. Ladder: time, kilometres, more races,
 *  vertical. The day is not a rung on this one (PDL P12). */
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

/**
 * One competitor's season beside the season before it, which is what the board
 * of best progress compares (PDL P12, 30.07.2026).
 *
 * `gain` is the whole measure: the points of the season less the points of the
 * one before. It is carried on the row rather than worked out inside the
 * comparator, which would work it out again for every comparison.
 */
export type ProgressRow = TotalsRow & { previousPoints: number; gain: number }

/*
 * The ladder of the best progress: the gain, then the points of the season, then
 * more races, then a shared place.
 *
 * NOT FROM P12. The table of ladders in P12 has no row for this board, because
 * the board had no measure until 30.07.2026 and the measure was decided without
 * one. Everything below the first rung is therefore derived, from the principle
 * the same section states: volume decides, efficiency never overturns it but may
 * settle a complete tie. Written down as derived so that it is easy to check
 * against the owner later, and easy to replace with one line when he rules on it.
 */
const BY_PROGRESS = byLadder<ProgressRow>([
  (row) => row.gain,
  (row) => row.points,
  (row) => row.races,
])

/**
 * Who improved most on the season before, tallest gain first.
 *
 * Whoever did not race the previous season is not on the board at all. They have
 * no previous total to be measured against, and counting the absence as zero
 * would put every newcomer at the top of a list about improvement, which is the
 * one thing a list about improvement must not do (PDL P12, 30.07.2026).
 *
 * Whoever went backwards is not on it either, and that is the second exclusion
 * rather than the same one twice: only a positive gain counts (PDL P12,
 * 30.07.2026). It came out of the historical seasons the prototype reads, where a
 * field of twenty-odd has fewer than ten people who improved: the board filled
 * its last two places with -0,63 and -19,16 under the heading "best progress".
 *
 * The board is therefore allowed to be shorter than ten, and to be empty in a
 * season nobody bettered. What it says when it is empty has to name both
 * exclusions, or it tells a season in which everybody ran and nobody improved
 * that nobody ran (topBoards.progressEmpty).
 */
export function topByProgress(
  competitors: Competitor[],
  results: Result[],
  season: number,
  limit: number,
): Placed<ProgressRow>[] {
  const now = totalsByMember(results.filter((result) => seasonOf(result) === season))
  const before = totalsByMember(results.filter((result) => seasonOf(result) === season - 1))

  const rows = competitors.flatMap((competitor) => {
    const own = now.get(competitor.memberNumber)
    const previous = before.get(competitor.memberNumber)

    /* Two ways out of this board, and they are different reasons. Somebody who
       did not race last season has no previous total to grow from, and would
       otherwise lead a list about improvement on their first season. Somebody
       whose total fell has not improved at all: a board called "best progress"
       that ends in minus figures is a board that says the opposite of its own
       name (owner, 30.07.2026). The list is then shorter than ten, and may be
       empty in a season nobody bettered. */
    if (own === undefined || previous === undefined) {
      return []
    }

    const gain = own.points - previous.points

    return gain > 0
      ? [{ competitor, ...own, previousPoints: previous.points, gain }]
      : []
  })

  return withPlaces(rows.sort(BY_PROGRESS), BY_PROGRESS, (row) => row.competitor.memberNumber)
    .slice(0, limit)
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
