import { genderMark } from '../../data/categories'
import type { BtlEvent, Competitor, League, Race, RaceKind, Result } from '../../data/types'

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
  /**
   * What the race is called.
   *
   * The event's name until 29.08.2026, because a race had none of its own; the
   * owner gave it one on 23.08.2026 and said in the same breath where it belongs:
   * „u listi rezultata treba da se prikazuju nazivi trka na kojima je čovek
   * učestvovao, a ne događaja." A renamed race stood in this grid under its
   * event's name until this was changed.
   *
   * It is still what tells two columns apart where the length and the day cannot:
   * two events can both hold a „10 km" on one morning, and their races carry their
   * names. Measured on 29.08.2026 over the three competitions in the file: 23
   * columns, 2 of them sharing a length and a day, and in neither case do the two
   * races share a name.
   */
  name: string
  date: string
  /**
   * Which of the three kinds the race is, and how long it lasts where that is what
   * it fixes. Carried because the heading is written from them: a race of a length
   * is named by its length and a timed one by its limit (`data/raceLabel.ts`).
   */
  kind: RaceKind
  limitSeconds: number
  /** Only for the ordering. Within one day the shorter race comes first, and
   *  by name "10 km" would come before "5 km". A timed and a free race carry no
   *  length, so within one day they come before every race that does; nothing
   *  else orders them, and they keep the order the races arrived in. */
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
              /* The race's own name, which starts out as its event's and stops
                 being it the moment somebody renames the race (owner,
                 23.08.2026). `event` is still read above, to know whether the race
                 belongs to this competition at all. */
              name: race.name,
              /* The day this race is run on, which is not always the day of its
                 event: one event may run over several mornings (PDL P10). Read
                 off the event, two races of one length on two mornings shared a
                 date as well as a length, so both columns read the same and
                 neither said which morning it was. */
              date: race.date,
              kind: race.kind,
              limitSeconds: race.limitSeconds,
              distanceKm: race.distanceKm,
            },
          ]
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.distanceKm - right.distanceKm)

  /* Whether two columns could be told apart used to be worked out here, so that a
     heading could put the name first only where it had to. The owner decided on
     29.08.2026 that the name goes first in every column and the day shrinks to its
     year, so there is nothing left for that answer to decide and it is gone rather
     than kept for a reader who might want it: a fact nobody reads is a fact nobody
     keeps true. What it used to buy, and what the decision costs instead, is
     written where the heading is drawn (`LeagueResults.tsx`). */
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

/**
 * One block of the grid: everybody who belongs together, in the order they are
 * ranked.
 *
 * `code` is what the block is called, and it is the same string the rest of the
 * portal calls it by: a category code where the competition ranks by category,
 * and the mark of a gender where it ranks by gender alone. Read off
 * `categoryOfMember` and `genderMark` rather than written here, so a block on
 * this screen is never called something the standing calls otherwise.
 */
export type LeagueGroup = {
  code: string
  rows: LeagueRow[]
}

/**
 * The rows of a competition, split the way that competition ranks.
 *
 * By gender, in every competition there is. Owner, 31.08.2026: „Lige treba da
 * imaju poredak samo po polu. Ne želim dodatna pravila." Said as a rule about
 * every league rather than about one („nego globalno!"), and it overturned the
 * older P15, under which each competition set its own split.
 *
 * What went with that decision is the setting: a record that could be asked which
 * way it ranks is a record two answers can be given to, and the second answer has
 * no screen, no wording and nobody to give it. It is gone from the record, from
 * the form in the administration, from the list of competitions and from here,
 * rather than left switched off everywhere.
 *
 * The competition itself is no longer asked for, because nothing here has anything
 * to ask it: a parameter nobody reads says the answer depends on something it does
 * not, and the next reader spends a minute finding out that it does not.
 *
 * **This is still a split, which is the part that is easy to miss.** „Samo po
 * polu" is not „no grouping"; it is grouping into two. A competition that ranks
 * by gender and shows one list has a woman placed behind men she was never
 * competing against.
 *
 * The order inside a block is the order it arrived in, which `leagueTable`
 * already settled: by the total, and a tie to the smaller member number. Blocks
 * themselves go in the order the codes sort in.
 *
 * A block nobody is in never arises, because the map is built out of the rows
 * themselves rather than out of the list of categories a league could have: a
 * competition of five people has as many blocks as those five fall into. What
 * still has to be dropped is a block with nobody on the **page** being drawn,
 * and that belongs to the screen, which is where the paging is.
 */
export function leagueGroups(rows: LeagueRow[]): LeagueGroup[] {
  const held = new Map<string, LeagueRow[]>()

  for (const row of rows) {
    const code = genderMark(row.competitor.gender)

    held.set(code, [...(held.get(code) ?? []), row])
  }

  return [...held.entries()]
    .map(([code, inside]) => ({ code, rows: inside }))
    .sort((left, right) => left.code.localeCompare(right.code))
}
