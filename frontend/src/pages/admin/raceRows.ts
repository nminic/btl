import { isoDate } from '../../forms/dateField'
import type { Race } from '../../data/types'

/**
 * One race of an event while it is being entered, before anything is saved.
 *
 * The races of an event are entered in a table under the event's own form and
 * saved with it in one press (owner, 23.08.2026), so between the two there has to
 * be a shape that is neither a record nor a form value: a row that may be as
 * unfinished as somebody has left it.
 *
 * The date is kept the way it is typed, `dd/mm/gggg`, because that is what the
 * picker in the row hands back and hands out. The three measurements are kept as
 * text for the same reason: a number box holds what was typed, an empty one holds
 * an empty string, and turning that into a number before it is asked for is what
 * makes „0" and „nothing yet" the same thing.
 */
export type RaceRow = {
  /** The race this row already is, or an empty string for one being entered. */
  id: string
  date: string
  distanceKm: string
  ascentM: string
  descentM: string
}

/** The rows an event opens with: its races, in the order they are run. */
export function rowsOf(races: Race[], fieldDate: (iso: string) => string): RaceRow[] {
  return [...races]
    /* By the day first and the distance inside it, which is the order they are
       run in: an event over two mornings reads as two mornings. */
    .sort((left, right) => left.date.localeCompare(right.date) || left.distanceKm - right.distanceKm)
    .map((race) => ({
      id: race.id,
      date: fieldDate(race.date),
      distanceKm: String(race.distanceKm),
      ascentM: String(race.ascentM),
      descentM: String(race.descentM),
    }))
}

/**
 * What a row is missing, or nothing where it is finished.
 *
 * The day and the length are what a race is; a race with no length is not one,
 * and a morning nothing runs on is not a morning. **The climb and the fall are
 * not asked for** (owner, 23.08.2026: „uspon i spust nisu obavezni, jer ako su
 * prazni tumače se kao 0/0"), which is also what the calendar already holds for
 * a flat road race.
 *
 * A length of nought is refused rather than kept: it passes „not empty" and is
 * not a distance, and the whole standing is worked out from it.
 */
export const BOUNDS = {
  distanceKm: { least: 0.1, most: 1000 },
  ascentM: { least: 0, most: 30000 },
  descentM: { least: 0, most: 30000 },
}

/** Whether a measurement is inside what a race can be. An empty climb or fall is
 *  nought and is inside it; an empty length is not a length. */
function withinBounds(said: string, field: keyof typeof BOUNDS): boolean {
  const { least, most } = BOUNDS[field]
  const number = said === '' && field !== 'distanceKm' ? 0 : Number(said)

  return Number.isFinite(number) && number >= least && number <= most
}

export function whatIsMissing(row: RaceRow): keyof typeof BOUNDS | 'date' | undefined {
  if (isoDate(row.date) === '') {
    return 'date'
  }

  /* The bounds the race's own form carried until 23.08.2026
     (`definitions/admin-trka.form.json`). The form went with the owner's change
     and the bounds nearly went with it: `min` on a number box is decoration here,
     because the form is `noValidate` and nothing reads `checkValidity`. Measured
     on the real screen: a climb of **minus five hundred** metres saved. `Le = L +
     (1.25×AP + 0.75×AN)/200` then works out a profile that was never run, and the
     whole standing is worked out from it. */
  return (['distanceKm', 'ascentM', 'descentM'] as const).find(
    (field) => !withinBounds(row[field], field),
  )
}

/**
 * Whether two rows are the same race, which is what nothing may tell apart.
 *
 * A race is one length of one morning, and it has no name of its own: two of
 * 42,2 km on the same day of one event leave a member choosing between two
 * entries that read alike, and whichever they pick decides where their time is
 * filed. The rule lived on the race's own form until 23.08.2026
 * (`entityForms.ts`, `raceClash`); the form is gone and the rule is not.
 */
export function clashesWith(rows: RaceRow[], at: number): boolean {
  const row = rows[at]

  if (row === undefined || whatIsMissing(row) !== undefined) {
    return false
  }

  return rows.some(
    (other, index) =>
      index !== at &&
      isoDate(other.date) === isoDate(row.date) &&
      Number(other.distanceKm) === Number(row.distanceKm),
  )
}

/** Whether every row is finished and no two of them are the same race, which is
 *  what the one save button asks before it writes anything at all. */
export function allFinished(rows: RaceRow[]): boolean {
  return rows.every((row, at) => whatIsMissing(row) === undefined && !clashesWith(rows, at))
}

/** What a row is worth as a record: the three measurements as they will be
 *  stored, with an empty climb or fall read as nought. */
export function storedRow(row: RaceRow, eventId: string): Record<string, string> {
  return {
    eventId,
    date: isoDate(row.date),
    distanceKm: String(Number(row.distanceKm)),
    ascentM: String(Number(row.ascentM === '' ? 0 : row.ascentM)),
    descentM: String(Number(row.descentM === '' ? 0 : row.descentM)),
  }
}
