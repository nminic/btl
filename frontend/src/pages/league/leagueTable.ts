import { genderMark } from '../../data/categories'
import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'

/**
 * A competition as one grid: everybody who ran it down the side, every event of
 * it across the top, and the points where the two meet (owner, 31.07.2026, and
 * 07.09.2026 for the event in place of the race).
 *
 * Worked out here rather than in the screen for the usual reason, and for one
 * more: a grid has two orderings and a total, and each of the three is easy to
 * get subtly wrong in a place where nobody can test it.
 */

export type LeagueColumn = {
  /**
   * One event of the competition, which is what a column of this grid is.
   *
   * **A race until 07.09.2026, and an event since.** The owner, asked what two columns of one
   * event should look like now that the heading is only a day: „Datum i kaze se dogadjaj samo. U
   * teoriji neko moze imati rezultate na dve trke u istom dogadjaju i onda ce dole u njegovu
   * celiju biti upisan zbir bodova sa obe trke."
   *
   * So there is nothing left for two columns of one event to tell apart, because there are no
   * longer two of them. A member who ran the marathon and the half of one morning has one cell,
   * holding what both brought him, which is also what his total already said.
   *
   * **What that costs, written down rather than discovered.** A reader can no longer see which
   * race inside an event a score came from, and a cell of 84,20 may be one race or two. The
   * event's own page lists its races and their results, which is where that question is answered
   * and where this heading now leads.
   */
  eventId: string
  /**
   * The day the event is held, which is the whole of the heading.
   *
   * The event's day and no longer the race's. One event may run over several mornings (PDL P10),
   * and while a column was a race that difference was the only thing telling two of its races
   * apart; a column that **is** the event has one day by definition, and it is the day the
   * calendar and the event's own page call it by.
   */
  date: string
  /** What the pointer is told and what names the link out loud. */
  name: string
  /** Where the press lands: the event's own page. */
  slug: string
}

export type LeagueRow = {
  competitor: Competitor
  /** Points per event, by event id, and everything they scored inside one event added up. An
   *  event the person did not race is absent, which is not the same as nought and must not be
   *  drawn as one. */
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
 * Columns are the events of the competition that have a race, oldest first: that is the order a
 * season is run in, and the order the calendar already shows. Two on one day keep the order their
 * names sort in, so the table does not shuffle between renders.
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

  /* The events of this competition that actually have a race, oldest first.
   *
   * Held against the races and not taken off the league itself, because an event with no race is
   * an empty column of a table whose width is its whole difficulty: forty six columns is already
   * more than a screen holds, and a forty seventh that can never carry a number is width spent on
   * nothing. An event entered a fortnight before its distances are known (owner, 23.08.2026) is
   * exactly such an event, and it appears here the day its first race does.
   *
   * Two events on one day are two columns reading the same date, and that is the owner's answer
   * of 07.09.2026 taken as it was given: what tells them apart is the name on the pointer and the
   * page the press opens. Ordered by the name after the day, so the pair keeps one order between
   * renders rather than the order the file happens to be written in. */
  const withRaces = new Set(races.flatMap((race) => (inLeague.has(race.eventId) ? [race.eventId] : [])))

  const columns: LeagueColumn[] = [...inLeague.values()]
    .filter((event) => withRaces.has(event.id))
    .map((event) => ({ eventId: event.id, date: event.date, name: event.name, slug: event.slug }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name))

  /* Which event a result belongs to, for the results that belong to this competition at all.
     Built out of the races, because a result names a race and a column names an event. */
  const eventOf = new Map(
    races.flatMap((race) => (inLeague.has(race.eventId) ? [[race.id, race.eventId] as const] : [])),
  )
  const byMember = new Map<string, Map<string, number>>()

  for (const result of results) {
    const eventId = eventOf.get(result.raceId)

    if (eventId === undefined) {
      continue
    }

    const mine = byMember.get(result.memberNumber) ?? new Map<string, number>()

    /* Added rather than set, and since 07.09.2026 that is a rule of the screen and not only a
       guard against bad data. A member who ran two races of one event has both in this one cell
       (owner: „onda ce dole u njegovu celiju biti upisan zbir bodova sa obe trke"), and one person
       with two results on one race, which the portal should not produce, is shown rather than
       quietly reduced to the last of them. */
    mine.set(eventId, (mine.get(eventId) ?? 0) + result.points)
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
 * portal calls it by: the mark of a gender, read off `genderMark` rather than
 * written here, so a block on this screen is never called something the standing
 * calls otherwise. It could be a category code until 31.08.2026, when the owner
 * settled that a competition ranks one way and it is by gender.
 */
export type LeagueGroup = {
  code: string
  rows: LeagueRow[]
}

/**
 * The rows of a competition, split by gender.
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
 * themselves rather than out of the two marks a gender can be: a competition of
 * five men has one block and not two. What
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
