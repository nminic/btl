import { categoryCodeFor } from './categories'
import { FIRST_SEASON } from './season'
import type { BtlEvent, Competitor, Gender, Race, RaceCategory, Result, Team } from './types'

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
/* Shortest to longest, and that is the whole rule (owner, 01.08.2026). It read
   short, long, half, marathon, ultra, which put the long races between the short
   ones and the half marathons; a reader scanning the ring, the legend or the row
   of buttons on a profile met them out of order and had no way to know it was
   deliberate, because it was not. This one array is where the ring, the legend,
   the turning chart and the profile's filter row all take their order from. */
export const CATEGORIES: RaceCategory[] = ['short', 'half', 'long', 'marathon', 'ultra']

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
 * settle a complete tie, and a tie that survives the whole ladder is broken by
 * the member number, because there is no shared place (owner, 31.07.2026).
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
 * Numbers an ordered list: 1, 2, 3. No number is skipped and none is given
 * twice.
 *
 * **There is no shared place** (PDL P12, owner 31.07.2026, confirmed
 * 11.08.2026). Every ladder ends in the member number, so where two rows belong
 * to two members the ladder always ends: the one who joined the league first
 * goes ahead. Written this way the trophy for second place is always handed to
 * somebody, and the table and the award list can never disagree in public.
 *
 * Not that two rows can never be level all the way down, which is what this said
 * until 15.08.2026. The last rung is a tie-break between **people**, and one
 * board does not list people: `bestSingleRaces` lists races, and one member may
 * hold two rows of it. Two races of one member, level on points and distance,
 * are level on the member number as well, so the order between them is the order
 * the results happened to arrive in. That is the one thing this function is
 * written to avoid, and on that board it is not avoided; the date is not a rung
 * there on purpose (see `bestSingleRaces`), so adding one would be a decision and
 * not a repair.
 *
 * The owner made that decision on 16.08.2026, and it is that no rung is wanted:
 * „to je zapravo lista najbolje ostvarenih pojedinačnih rezultata na trkama, a
 * pobednik (dobitnik figure) će biti onaj koji je postigao najbolji rezultat."
 * The board ranks races and the award goes to the first row, so which of two
 * equally good races of one member is fifth and which sixth decides nothing.
 * Level at the top, one of them is drawn first and the award is still one and
 * still that member's.
 *
 * Until 11.08.2026 rows the ladder left level shared one number and the numbers
 * after them were skipped, so a shared first place read 1, 1, 3 and the award
 * was doubled. The owner's answer of that day settled which of the two records
 * was current, and this is the other half of it.
 *
 * The member number is added **under** the given ladder rather than left to the
 * order the rows happened to arrive in, so the table does not shuffle on every
 * recount. Callers therefore hand the rows in unsorted: sorting them first by
 * the same ladder is a second pass for the same answer, and it reorders the
 * caller's own array on the way (three of them did until 16.08.2026). `compare` is that ladder, and two rows reach the last rung only when
 * every rung above it leaves them equal.
 *
 * What identifies the row is passed in, because not every list is a list of
 * people: the team standing hands in the team's own id. What that promises is
 * one row, one value, and the same value tomorrow, which is all a last rung has
 * to do. It promises nothing about when the team joined (see `rankTeams`).
 */
export function withPlaces<T extends object>(
  rows: T[],
  compare: (left: T, right: T) => number,
  memberNumberOf: (row: T) => string,
): Placed<T>[] {
  /* A copy, because a caller that hands in a list it still uses would find it
   * reordered under it. */
  return [...rows]
    .sort((left, right) => {
      const byLadder = compare(left, right)

      /* Written out rather than `||`, which is what `byLadder` above does as
         well and for the same reason (ADL A14): a rung that measures a date
         gives `NaN` when the date is not one, and `||` would read that as „these
         two are level" and quietly fall through to the member number. Asked
         about zero, `NaN` is not zero, and a wrong date shows itself. */
      return byLadder !== 0
        ? byLadder
        : memberNumberOf(left).localeCompare(memberNumberOf(right))
    })
    .map((row, index) => ({ ...row, position: index + 1 }))
}

export type RankingRow = Placed<TotalsRow>

export type RankingFilter = {
  season: number
  gender: Gender
  categoryCode?: string
}

/** The ladder of the general standing (PDL P12): points, kilometres, more
 *  races, vertical, and then the member number, which `withPlaces` adds. */
const STANDING = byLadder<TotalsRow>([
  (row) => row.points,
  (row) => row.kilometers,
  (row) => row.races,
  VERTICAL,
])

/**
 * The standing for one season and one gender, ordered down the ladder above:
 * volume wins, never efficiency, and a tie nothing separates goes to the lower
 * member number.
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

  return withPlaces(ranked, STANDING, (row) => row.competitor.memberNumber)
}

/**
 * The members of one team, ordered by what each of them brought to it, down the
 * ladder of the general standing and with a tie nothing separates settled by the
 * member number, like every other list on the portal (PDL P12).
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

  return withPlaces(rows, STANDING, (row) => row.competitor.memberNumber)
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

/**
 * The most points a member has taken in any one official season.
 *
 * This is the figure the beginners' category is decided by, and both halves of
 * it are the owner's decision rather than a way of counting (PDL P7,
 * 11.08.2026).
 *
 * **Only official seasons count**, which is 2027 onwards. Verbatim: „gledaju se
 * samo zvanične BTL sezone za pravilo od 12 poena u prethodnoj, tako da u prvoj
 * sezoni u teoriji svi mogu da odu u Prvu Sezonu." The results imported from
 * 2010 to 2026 are somebody's own record of their running, kept so that a
 * profile is not empty on the day the league starts (P26), and they disqualify
 * nobody. Counted the other way, every one of the thirty members carried into
 * the portal arrives already barred from a category the league has not run once.
 *
 * **The best single season, never the sum of them.** The rule is that no
 * official season has been finished with twelve or more, so somebody who takes
 * four points a season for five years is still a beginner: the threshold
 * measures what was done in a season, not how long somebody has been about.
 *
 * **The running season is counted too, and that is deliberate.** Points never go
 * down, so a season already over the threshold is certain to finish over it, and
 * waiting for the year to end would leave the category open to somebody who has
 * plainly left it. The gap is the other way round, and it is real: a member who
 * renews in October with eleven points is told the category is open, crosses the
 * threshold in December, and nothing asks again, because the window shuts on 31
 * December and the choice is not kept anywhere. Nothing to fix here, and nothing
 * that can be fixed here: it is one check at the close of a season, on a record
 * of what was chosen, and neither exists until F5. Written down in PENDING.
 *
 * Nobody has an official season yet, so this answers zero for everybody today,
 * which is exactly what the decision says it should: in 2027 the category is
 * open to all.
 */
export function bestOfficialSeason(results: Result[], memberNumber: string): number {
  const seasons = new Map<number, number>()

  for (const result of results) {
    const season = seasonOf(result)

    if (result.memberNumber === memberNumber && season >= FIRST_SEASON) {
      seasons.set(season, (seasons.get(season) ?? 0) + result.points)
    }
  }

  /* Nought where there is nothing, rather than the smallest of no numbers: a
     member with no official season has taken no points in one, and that is the
     ordinary case for everybody until 2027 is over. */
  return Math.max(0, ...seasons.values())
}

export type TeamRow = {
  team: Team
  members: number
  totals: Totals
}

/**
 * The ladder of the team board (PDL P12, owner 11.08.2026): points, more races,
 * kilometres, time on the course, and then the team's own id, which `withPlaces`
 * adds. The pair board is given the same one, measured over the races the two
 * ran together.
 *
 * The size of the team was a rung until 11.08.2026, put there because the
 * standing is a plain sum and a rule that rewarded the smaller team was
 * excluded. That is still true of the first rung, which is the sum itself: a
 * bigger team wins when it is stronger. It no longer wins for being bigger while
 * being level, because the owner named the four measures and the head count is
 * not among them.
 */
const BY_TEAM = byLadder<TeamRow>([
  (row) => row.totals.points,
  (row) => row.totals.races,
  (row) => row.totals.kilometers,
  (row) => row.totals.seconds,
])

/**
 * Teams by the plain sum of every member, never normalised: a rule that
 * rewarded the smaller team is explicitly excluded, so a bigger team wins by
 * being stronger. It no longer wins for being bigger while level, because the
 * head count stopped being a rung on 11.08.2026 (PDL P12).
 *
 * A tie the whole ladder leaves standing is broken by the team's own id rather
 * than by a member number, because a team has no member number. What that id
 * promises is one thing only: that it is the same tomorrow, so the table does
 * not shuffle between two recounts of the same data. It promises nothing about
 * when the team joined, and the rulebook no longer says it does (Article 50):
 * the prototype hands out `team-dunav` from the seed and `teams-nov-N` from the
 * panel, and `localeCompare` puts `teams-nov-10` ahead of `teams-nov-2`. So
 * here too there is no shared place, and which of two teams nothing separates
 * goes first is arbitrary and steady, which is all it has to be.
 *
 * The results are taken as given, so the caller decides whether the board is
 * one season or the whole history. The roster is not: the season is handed in
 * and the members are scoped to it here, because both callers need the same
 * thing done to the same argument and a rule each of them has to remember to
 * apply is exactly the shape of the bug this closes. A standing headed by a year
 * was counting today's roster, so 2019 read as what the people who are in these
 * teams now happened to score in 2019, credited to whichever team each of them
 * has since joined.
 */
/**
 * Whether somebody was in their team in a given season.
 *
 * A team is a thing of one season (PDL P13), so a figure headed by a year has to
 * be that year's team and not today's. `teamSince` is what the data knows, and
 * it answers both cases that arise: somebody still in a team counts from the
 * season they joined, and somebody who has left contributes nothing, which is
 * what the exit rule orders anyway (PDL P13, 31.07.2026: leaving mid-season
 * deletes the whole contribution to that team for that season).
 *
 * It also keeps out the member who has paid for next season and joined a team
 * for it, who is a member today and deliberately not in this season's tables.
 *
 * What it cannot express is the member who left cleanly on 1 January and keeps
 * their earlier contribution. Nothing in the data names that person's old team,
 * so no rule here can restore them.
 */
export function inTeamIn(competitor: Competitor, season: number): boolean {
  return competitor.teamSince !== null && competitor.teamSince <= season
}

export function rankTeams(
  teams: Team[],
  competitors: Competitor[],
  results: Result[],
  season: number,
): Placed<TeamRow>[] {
  const rows = teams.map((team) => {
    const numbers = new Set(
      competitors
        .filter((one) => one.teamId === team.id && inTeamIn(one, season))
        .map((one) => one.memberNumber),
    )

    return {
      team,
      members: numbers.size,
      totals: totalsOf(results.filter((result) => numbers.has(result.memberNumber))),
    }
  })

  return withPlaces(rows, BY_TEAM, (row) => row.team.id)
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

/**
 * The events of one month, oldest first.
 *
 * Every event there is: an event on the portal is on, and one that is off is
 * deleted rather than marked (owner, 10.08.2026). This used to ask whether the
 * event was cancelled, and asking it here and not in `monthsWithEvents` put a
 * month whose only event was off on the list of months that hold something.
 */
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

export function monthFrom(asked: string | null, fallback: string): string {
  return asked !== null && MONTH.test(asked) ? asked : fallback
}

/**
 * The two numbers behind the name of a month.
 *
 * A month is named "YYYY-MM" everywhere on the portal: it is what the address
 * bar of the calendar carries, what `defaultMonth` hands back and what a grid is
 * asked for. Splitting that name on the dash at each of the four places that
 * needed it was four chances to take the halves in the wrong order, and each of
 * those places then had to answer for a half that was not there.
 *
 * The name is fixed width, so both numbers are slices of it. A name that is not
 * a month gives NaN, and a grid of NaN is a month with no days in it: the
 * calendar is reached by an address a visitor can type, so a wrong one has to
 * be survivable rather than fatal.
 *
 * `index` is the month itself, 1 for January, which is the way `monthDays` and
 * `eventsInMonth` are asked for one.
 */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * The month the address names, or the one to fall back on.
 *
 * The shape is not the value, the same lesson the day page learned. `?mesec=2026`
 * has a year and no month, and `Number('')` is 0 rather than NaN, so it drew a
 * thirty-one day grid headed January 2026 over the columns of December 2025 with
 * every real event missing. Nothing threw and nothing looked broken.
 *
 * Held here rather than at the screen, so that `monthNumbers` below can go on
 * assuming it is handed a month.
 */
export function monthNumbers(month: string): { year: number; index: number } {
  return { year: Number(month.slice(0, 4)), index: Number(month.slice(5, 7)) }
}

/** The month `by` months away from this one, named the same way. */
export function shiftMonth(month: string, by: number): string {
  const { year, index } = monthNumbers(month)
  const moved = new Date(Date.UTC(year, index - 1 + by, 1))

  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Days of a month laid out Monday to Sunday, with the leading and trailing
 *  blanks the grid needs. Null is a cell outside the month. */
/**
 * The days of one month, and which column the first of them falls in.
 *
 * Only real days (owner, 31.07.2026). The grid used to be padded with nulls at
 * both ends so that every row held seven cells, and those cells were drawn as
 * empty squares: on a month beginning on a Saturday that is five boxes of
 * nothing before the month starts and five after it ends, and they read as days
 * with nothing on rather than as days of another month.
 *
 * The offset is handed back instead, and the first day is placed in its column.
 * A week starts on Monday, so `offset` is 0 for a month starting on a Monday and
 * 6 for one starting on a Sunday.
 */
export function monthDays(year: number, month: number): { days: number[]; offset: number } {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return {
    // getUTCDay() is 0 for Sunday; the week here starts on Monday.
    offset: (first.getUTCDay() + 6) % 7,
    days: Array.from({ length }, (_, index) => index + 1),
  }
}

/**
 * The same month as a padded grid of seven columns, nulls where the month has
 * not started or has already ended.
 *
 * The calendar screen does not use this any more: empty squares there read as
 * days with nothing on (owner, 31.07.2026). The field for choosing a date still
 * does, because there the grid is a control and a day has to keep its column
 * under the finger; it is built out of `monthDays` so the two cannot disagree
 * about what a month is.
 */
export function monthGrid(year: number, month: number): (number | null)[] {
  const { days, offset } = monthDays(year, month)
  const cells: (number | null)[] = [...Array.from({ length: offset }, () => null), ...days]

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
    .filter((event) => event.date >= today)
    .sort((left, right) => left.date.localeCompare(right.date))

  /* The row a name gets, built as the runs of it are met rather than gathered
     into a list and read back afterwards. `ahead` is in date order, so the
     first run of a name is the next one and every run after it only adds to the
     count: the row that stands for a series is never a row nobody wrote. */
  const byName = new Map<string, SeriesEntry>()

  for (const event of ahead) {
    const open = byName.get(event.name)

    byName.set(
      event.name,
      open === undefined
        ? { name: event.name, next: event, more: 0 }
        : { ...open, more: open.more + 1 },
    )
  }

  return [...byName.values()]
    .sort((left, right) => left.next.date.localeCompare(right.next.date))
    .slice(0, limit)
}

/** How many races of each length there are among these results. The ring on a
 *  profile and the one on a team page are the same drawing over different
 *  results, so the tally is counted in one place. */
export function countsByCategory(results: Result[]): Map<RaceCategory, number> {
  const counts = new Map<RaceCategory, number>()

  for (const result of results) {
    counts.set(result.category, (counts.get(result.category) ?? 0) + 1)
  }

  return counts
}

/**
 * Which lengths an event holds, in the order the five are always named.
 *
 * The coloured dots beside an event, on the front page and in the calendar
 * (owner, 31.07.2026): one dot per length that is actually run there, never one
 * per race, so an event with four half marathons carries one green dot rather
 * than four.
 */
export function categoriesAt(event: BtlEvent, races: Race[]): RaceCategory[] {
  /* Read off the race and not off a list the event carries. The list is written
     by the generator and by nothing else, so a race added in administration was
     run by nobody as far as this was concerned: its event lost the dot for that
     length, and the league beside it counted one race fewer. A race says which
     event it belongs to, and that is the one place it is written down (ADL A7). */
  const held = new Set(
    races.filter((race) => race.eventId === event.id).map((race) => race.category),
  )

  return CATEGORIES.filter((one) => held.has(one))
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
 * kept it; the front page and the boards of Article 48 are the same season's
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
 * (PDL P12, and Article 49 of the rulebook), so both are counted here rather than
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

  return withPlaces(columns, BY_CATEGORY, (row) => row.competitor.memberNumber)
    .slice(0, limit)
}

/**
 * Most kilometres in a season. Ladder: kilometres, points, more races, vertical,
 * then reached earlier, then the member number.
 *
 * Points sit on the second rung and not the fourth since the owner's fourth
 * reading of the rulebook, 22.08.2026 (Article 49): between two members level on
 * kilometres, what they took for those kilometres separates them before the
 * count of races does.
 *
 * The day is the rung below all of them, and it was missing here while the board
 * of races by length already had it: two members level on everything above were
 * left in whatever order they happened to be in, and the one who got there in
 * March shared a place with the one who got there in December.
 */
const BY_KILOMETERS = byLadder<TallyRow>([
  (row) => row.kilometers,
  (row) => row.points,
  (row) => row.races,
  VERTICAL,
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
  const rows = seasonRows(competitors, results, season)

  return withPlaces(rows, BY_KILOMETERS, (row) => row.competitor.memberNumber).slice(0, limit)
}

/** Longest on the course in a season. Ladder: time, points, kilometres, more
 *  races, vertical. Points were not a rung here at all until the owner's fourth
 *  reading, 22.08.2026 (Article 49); they now stand directly under the time. The
 *  day is not a rung on this one (PDL P12). */
const BY_TIME_ON_COURSE = byLadder<TotalsRow>([
  (row) => row.seconds,
  (row) => row.points,
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
  const rows = seasonRows(competitors, results, season)

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
 * more races, then the member number.
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

  return withPlaces(rows, BY_PROGRESS, (row) => row.competitor.memberNumber)
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

  /* Points on that one race, then the longer race, then what the member took in
     the whole season, then their kilometres in it (Article 49, owner's fourth
     reading 22.08.2026). The count of races in the season was the fourth rung
     until then and is not a measure any more. */
  const ladder = byLadder<(typeof rows)[number]>([
    (row) => row.result.points,
    (row) => row.result.distanceKm,
    (row) => row.seasonTotals.points,
    (row) => row.seasonTotals.kilometers,
  ])

  return withPlaces(rows, ladder, (row) => row.competitor.memberNumber).slice(0, limit)
}
