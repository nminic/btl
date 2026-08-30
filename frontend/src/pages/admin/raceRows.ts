import { isoDate } from '../../forms/dateField'
import { categoryOf } from '../../data/raceCategory'
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
  /**
   * What the race is called. Opens as the name of its event and may be changed
   * (owner, 23.08.2026), and is the first column of the table because it is what
   * the row is read by.
   */
  name: string
  /** Whether that name was given by hand, which is what decides whether the race
   *  follows its event when the event is renamed (`data/types.ts`). */
  renamed: 'yes' | 'no'
  date: string
  /**
   * Which of the three kinds the race is, and its limit in seconds where it has
   * one, carried through the row without being drawn in it.
   *
   * The table asks for a length and for nothing else, so neither of these is a
   * column and neither can be typed here. They are on the row all the same,
   * because saving the event writes every row back over the race it came from
   * (`AdminEvents.tsx`, `editRecord(row.id, storedRow(row, written))`), and a
   * field the row does not carry is a field that save deletes. Measured on
   * 30.08.2026: without them, opening an event and pressing save turned a twenty
   * four hour race into a race of nought kilometres.
   *
   * They become columns the day administration can set them, and the guard that
   * keeps them alive through a save is the same one either way.
   *
   * Plain text and not `RaceKind`, because a row does not read this and must not
   * be tempted to: it carries the word from the record to the record, and the one
   * place that decides what a word means is where the race is named
   * (`data/raceLabel.ts`). A carrier that narrowed the word would have to answer
   * for one it does not know, and there is no answer it could give that anything
   * would ever read.
   */
  kind: string
  limitSeconds: string
  distanceKm: string
  ascentM: string
  descentM: string
}

/** The rows an event opens with: its races, in the order they are run. */
/** What a row of the table is read off, and nothing besides. Narrow on purpose,
 *  the way `data/raceLabel.ts` is: this is the shape a row needs, not the shape a
 *  race has, and a race gains fields this table will never draw. */
export type RaceOfRow = Pick<
  Race,
  'id' | 'name' | 'renamed' | 'date' | 'distanceKm' | 'ascentM' | 'descentM'
> & {
  /* Carried, not read, for the reason `RaceRow.kind` gives. A race out of the file
     hands its own `RaceKind` straight in, which is what `Race` is; the overlaid
     list hands in whatever the store keeps, which is text. */
  kind: string
  limitSeconds: number
}

export function rowsOf(races: RaceOfRow[], fieldDate: (iso: string) => string): RaceRow[] {
  return [...races]
    /* By the day first and the distance inside it, which is the order they are
       run in: an event over two mornings reads as two mornings. */
    .sort((left, right) => left.date.localeCompare(right.date) || left.distanceKm - right.distanceKm)
    .map((race) => ({
      id: race.id,
      name: race.name,
      renamed: race.renamed,
      date: fieldDate(race.date),
      kind: race.kind,
      limitSeconds: String(race.limitSeconds),
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

/**
 * Whether that one cell of that row is wrong, whatever else in the row is.
 *
 * `whatIsMissing` answers with the **first** thing wrong, which is what the refusal
 * needs; a cell needs to know about itself. Asked by the first, a climb of minus
 * five hundred was marked and the fall of minus nine hundred beside it said
 * `aria-invalid="false"`, so a reader was sent looking somewhere else
 * (WCAG 2.2 SC 3.3.1). Measured 23.08.2026.
 */
export function isWrong(row: RaceRow, field: keyof typeof BOUNDS | 'date' | 'name'): boolean {
  if (field === 'name') {
    /* Cut the same way the press cuts it. Asked without `trim`, a name of three
       spaces was refused by the press and the cell that carried it said
       `aria-invalid="false"`: the reader was told the row is wrong and every control
       in it said it was fine, which in a table of twelve rows leaves nowhere to look
       (WCAG 2.2 SC 3.3.1). Measured 23.08.2026. Of the four fields this knows, the
       name was the only one whose two answers disagreed. */
    return row.name.trim() === ''
  }

  if (field === 'date') {
    return isoDate(row.date) === ''
  }

  return !withinBounds(row[field], field)
}

export function whatIsMissing(row: RaceRow): keyof typeof BOUNDS | 'date' | 'name' | undefined {
  /* A race always has a name, and it cannot be emptied: it opens as the name of
     its event and may be changed, not taken away (owner, 23.08.2026). A row with
     no name is a row nobody can pick out of a list of races. */
  if (row.name.trim() === '') {
    return 'name'
  }

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
 * Whether every row is finished, which is what the one save button asks before it
 * writes anything at all.
 *
 * Finished and nothing more. Two rows of one length on one morning were refused
 * until 23.08.2026, on the reasoning that a race has no name so nothing tells them
 * apart; the owner said that day that a course can genuinely be run twice over the
 * same distance and the same climb, rarely but really, and that the portal must not
 * forbid it. What tells them apart is the race's own name, which the seventh round
 * gives it (PDL, 23.08.2026).
 */
export function allFinished(rows: RaceRow[]): boolean {
  return rows.every((row) => whatIsMissing(row) === undefined)
}

/**
 * What a row is worth as a record: the three measurements as they will be stored,
 * with an empty climb or fall read as nought.
 *
 * **The category comes with them, and it is not a choice.** A race carries one
 * (`data/types.ts`) and it is the length and nothing else, by the exact value and
 * with no tolerance (PDL P5), so `categoryOf` says it and nobody is asked. The
 * table stopped asking on 23.08.2026, when the owner took the column out („U
 * dodavanju trka na događaju (administriranje) ne treba da postoji Kategorija
 * kolona ipak"), and the writing went with the asking.
 *
 * What that cost was measured by a review: a saved record is merged over the one
 * before it, so a race of 42,2 km whose length is corrected to 10 kept
 * `category: 'marathon'` on the record. Nothing draws it wrong today, because the
 * public screens read the file rather than the layer of edits, and that is
 * precisely why it had to be put back rather than left: the shape of the record is
 * what the database phase inherits, and it would inherit a race that is a marathon
 * and ten kilometres at once.
 *
 * Written here and not left to whoever calls this, because there is one way to
 * store a row and this is it: a second caller working it out again is a second
 * chance to work it out differently (ADL A31).
 */
export function storedRow(row: RaceRow, eventId: string): Record<string, string> {
  const distanceKm = Number(row.distanceKm)

  return {
    eventId,
    name: row.name.trim(),
    renamed: row.renamed,
    date: isoDate(row.date),
    /* Written back as the row carries it, not as a fixed word. A row entered here
       opens as a race of a length, because a length is the only thing this table
       asks for; a row read off a race that already exists carries whatever that
       race is, and saving the event must hand it back unchanged. */
    kind: row.kind,
    limitSeconds: row.limitSeconds,
    distanceKm: String(distanceKm),
    ascentM: String(Number(row.ascentM === '' ? 0 : row.ascentM)),
    descentM: String(Number(row.descentM === '' ? 0 : row.descentM)),
    category: categoryOf(distanceKm),
  }
}
