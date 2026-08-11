import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'

/**
 * A competition as one grid: everybody who ran it down the side, every race of
 * it across the top, and the points where the two meet (owner, 31.07.2026).
 *
 * Worked out here rather than in the screen for the usual reason, and for one
 * more: a grid has two orderings and a total, and each of the three is easy to
 * get subtly wrong in a place where nobody can test it.
 */

export type LeagueColumn = {
  raceId: string
  /** The event the race belonged to. Two events can both hold a "10 km", so the
   *  heading has to say which one, however narrow the column wants to be. */
  event: string
  race: string
  date: string
  /**
   * Whether this race and this date belong to more than one event in the
   * competition.
   *
   * The heading is turned on its side and has to be cut somewhere, and the cut
   * has to fall on the part that repeats. Usually that is the name of the event,
   * because one event holds several races on one day. Twice in the main
   * competition of 2027 it is the other way round: "10.00 km, 4. 9. 2027." is
   * both 10K Belgrade and Beljanica trail. Where that happens the name goes
   * first instead.
   */
  ambiguous: boolean
  /** Only for the ordering. Within one day the shorter race comes first, and
   *  by name "10 km" would come before "5 km". */
  distanceKm: number
}

export type LeagueRow = {
  competitor: Competitor
  /** Points per race, by race id. A race the person did not run is absent, which
   *  is not the same as nought and must not be drawn as one. */
  points: Map<string, number>
  total: number
}

export type LeagueTable = {
  columns: LeagueColumn[]
  rows: LeagueRow[]
}

/**
 * Builds the grid.
 *
 * Columns are every race of every event in the competition, oldest first and, on
 * one day, shortest first: that is the order a season is run in, and the order
 * the calendar already shows. Shortest by the distance and not by the name, or
 * "10 km" would stand in front of "5 km".
 *
 * Rows are everyone with at least one result in it. Ordered by the total, which
 * is the second column and the only ordering the owner asked for; a tie goes to
 * the smaller member number, so the table does not shuffle between two people it
 * cannot separate.
 *
 * The total is the sum of what is shown and nothing else, so a reader can add
 * the row up and land on it.
 */
export function leagueTable(
  league: League,
  events: BtlEvent[],
  races: Race[],
  results: Result[],
  competitors: Competitor[],
): LeagueTable {
  const inLeague = new Map(
    events.filter((one) => league.eventIds.includes(one.id)).map((one) => [one.id, one]),
  )

  const columns: LeagueColumn[] = races
    .flatMap((race) => {
      const event = inLeague.get(race.eventId)

      return event === undefined
        ? []
        : [
            {
              raceId: race.id,
              event: event.name,
              race: race.name,
              date: event.date,
              distanceKm: race.distanceKm,
              ambiguous: false,
            },
          ]
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.distanceKm - right.distanceKm)

  const seen = new Map<string, number>()

  /* What two columns have to share before the reader cannot tell them apart.
     Not the name alone: a race may have none (PDL P6), and then the heading is
     its length, so two nameless races of one event on one day are two different
     columns and only their lengths say so. Written here rather than read off the
     heading because this file knows nothing of language and a heading is
     written in one. */
  const nameOf = (column: LeagueColumn) =>
    column.race.trim() === '' ? `#${column.distanceKm}` : column.race

  for (const column of columns) {
    const key = `${nameOf(column)}|${column.date}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  /* The keys that more than one event holds. Kept as a set rather than read back
     out of the counts with a fallback: every column was just counted into them,
     so the fallback is a branch that can never be taken. */
  const shared = new Set(
    [...seen.entries()].filter(([, howMany]) => howMany > 1).map(([key]) => key),
  )

  for (const column of columns) {
    column.ambiguous = shared.has(`${nameOf(column)}|${column.date}`)
  }

  const counts = new Set(columns.map((one) => one.raceId))
  const byMember = new Map<string, Map<string, number>>()

  for (const result of results) {
    if (!counts.has(result.raceId)) {
      continue
    }

    const mine = byMember.get(result.memberNumber) ?? new Map<string, number>()

    /* Added rather than set. One person with two results on one race is not
       something the portal should produce, but a grid that silently kept the
       last of them would hide it rather than show it. */
    mine.set(result.raceId, (mine.get(result.raceId) ?? 0) + result.points)
    byMember.set(result.memberNumber, mine)
  }

  const rows = competitors
    .flatMap((competitor) => {
      const points = byMember.get(competitor.memberNumber)

      return points === undefined
        ? []
        : [{ competitor, points, total: [...points.values()].reduce((sum, one) => sum + one, 0) }]
    })
    .sort(
      (left, right) =>
        right.total - left.total ||
        left.competitor.memberNumber.localeCompare(right.competitor.memberNumber),
    )

  return { columns, rows }
}
