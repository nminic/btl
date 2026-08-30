import { isoDate } from '../../forms/dateField'
import { categoryOf } from '../../data/raceCategory'
import { raceKind } from '../../data/raceKind'
import type { Race, RaceKind } from '../../data/types'

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
   * Which of the three kinds the race is. Its limit sits beside it, in hours, which
   * is the unit this table asks in; the record keeps seconds (`data/types.ts`).
   *
   * Both are columns since 30.08.2026, and both are on the row for a second reason
   * besides being typed: saving the event writes every row back over the race it
   * came from (`AdminEvents.tsx`, `editRecord(row.id, storedRow(row, written))`), so
   * a field the row does not carry is a field that save deletes. Measured that day
   * on the record and not on the screen: without them, a race read into a row and
   * written back out of it came back a race of a length with no limit.
   *
   * One of the three words and not plain text, because the row does read it: what
   * a race must say about itself depends on which kind it is, and a race that does
   * not fix its length cannot be made to give one (`whatIsMissing`). An earlier
   * turn of this had it as text, on the reasoning that a row only carries the
   * word; that was true of the save and false of the bounds, which is the half
   * that refuses.
   */
  kind: RaceKind
  /**
   * How long a timed race lasts, **in hours**, which is the unit the table asks in
   * and the owner's own („24 h", „6 h"). The record keeps seconds
   * (`data/types.ts`), so the unit is in the name on both sides and `storedRow`
   * does the one conversion there is.
   */
  limitHours: string
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
> &
  Pick<Race, 'kind' | 'limitSeconds'>

/**
 * A row for a race being entered, as the table opens it.
 *
 * Its own function and not an object written into the table, because the words it
 * puts in `kind` are words `raceLabel` will read back and nothing between the two
 * checks them: written where they were, `kind: 'ludilo'` passed the whole package
 * (measured 30.08.2026). Here they are read by a case.
 *
 * A race entered by hand is a race of a length, because a length is the only thing
 * this table asks for; the day it asks for the kind as well, this is where the
 * answer comes from.
 */
export function newRaceRow(eventName: string, eventDate: string): RaceRow {
  return {
    id: '',
    /* Named after the event it is entered under, which is what „po default-u naziv
       događaja" means; it follows the event until somebody types into it. */
    name: eventName,
    renamed: 'no',
    date: isoDate(eventDate) === '' ? '' : eventDate,
    kind: 'length',
    limitHours: '',
    distanceKm: '',
    ascentM: '',
    descentM: '',
  }
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
      limitHours: race.limitSeconds === 0 ? '' : String(race.limitSeconds / 3600),
      distanceKm: String(race.distanceKm),
      ascentM: String(race.ascentM),
      descentM: String(race.descentM),
    }))
}

/** Every measure a row carries, in the order the table draws them. A list rather
 *  than the keys of `BOUNDS`, so it can be walked without an assertion and so a
 *  measure added there and forgotten here does not compile. */
export const MEASURES = ['distanceKm', 'limitHours', 'ascentM', 'descentM'] as const

export const BOUNDS: Record<(typeof MEASURES)[number], { least: number; most: number }> = {
  distanceKm: { least: 0.1, most: 1000 },
  /* A limit of nought is not a limit, and two hundred hours is the ceiling the two
     forms that ask a member for a time already agree on
     (`definitions/unos-rezultata.form.json`). */
  limitHours: { least: 0.1, most: 200 },
  ascentM: { least: 0, most: 30000 },
  descentM: { least: 0, most: 30000 },
}

/**
 * Whether this row has to give a measure, which is the one home for that question.
 *
 * A race does not fix every measure there is: one of a length fixes its length, a
 * timed one fixes how long it lasts, a free one fixes neither. What a race does not
 * fix it carries as nought, and nought is outside the bounds on purpose, since it
 * passes „not empty" and is not a distance. So without this an event holding a
 * timed or a free race could not be saved at all.
 *
 * One home and not five, because the answer is read in five places and they had
 * drifted: `whatIsMissing` decides whether the save happens, `isWrong` decides
 * which cell is marked, and the table decides which cell says it is required and
 * what its `min` is. A row that the save let through was at the same time drawn as
 * required and marked wrong, which sends a screen reader into a cell it has nothing
 * to fix with (WCAG 2.2 SC 3.3.1, and ADL A31 on a fact with more than one home).
 *
 * There is a fourth reader that cannot be one of these, and it is written by hand:
 * the words of the refusal (`i18n`, `admin.form.racesRefused`). One sentence stands
 * for the whole table, so it cannot name what is wrong with one row, and until
 * 30.08.2026 it said every race must give a length, which stopped being true the
 * moment two of the three kinds stopped fixing one.
 *
 * It does not try to say it conditionally either, which was the next thing tried
 * and worse: „a race that fixes a length" names a property this table does not
 * draw, and the only thing on the screen that looks like it, the number in the
 * length cell, points the other way. The exempt row shows „0" and the refused one
 * shows nothing, so a reader following the words lands on the wrong row. The
 * sentence now says what every race must have and sends the reader to the marked
 * cells, which are marked one by one and correctly. That the sentence itself does
 * not name the row is a fault of its own, written down in PENDING since
 * 23.08.2026.
 *
 * The climb and the fall are never asked for: a course has both whichever way it is
 * run, and an empty one is read as nought. That they are nonetheless held to their
 * bounds is the other question, and it has a home of its own (`isBounded`).
 */
export function asksFor(row: Pick<RaceRow, 'kind'>, field: keyof typeof BOUNDS): boolean {
  /* Through the one function that knows the three words, like every other reader of
     a kind (`data/raceKind.ts`). The row's word is already read that way on the way
     in, so nothing here can be anything else today; asked all the same, so that
     which readers happen to be fed a checked word is not a thing anybody has to
     work out. */
  const kind = raceKind(row.kind)

  if (field === 'distanceKm') {
    return kind === 'length'
  }

  if (field === 'limitHours') {
    return kind === 'time'
  }

  return false
}

/** Whether this row has to give a length, by name, since that is the question most
 *  of its readers ask. `asksFor` underneath, so there is still one answer. */
export function asksLength(row: Pick<RaceRow, 'kind'>): boolean {
  return asksFor(row, 'distanceKm')
}

/** And whether it has to give a limit. */
export function asksLimit(row: Pick<RaceRow, 'kind'>): boolean {
  return asksFor(row, 'limitHours')
}

/**
 * Whether a cell refuses anything at all, which is a different question from whether
 * it is required and has to be asked separately.
 *
 * The climb and the fall are never required and always bounded: a course has both
 * whichever way it is run, and an empty one is read as nought. A length and a limit
 * are bounded exactly where they are asked for, because a race that does not fix one
 * carries nought and nought is outside the bounds on purpose.
 *
 * Both questions have one home each, and every reader asks through them: the save
 * (`whatIsMissing`), the marking of a refused cell (`isWrong`), what the control
 * itself announces, required and floor and ceiling (`EventRaces.tsx`), and what the
 * record is written with (`storedRow`, which zeroes the measure the kind does not
 * fix). They were three separate readings once and drifted; then a fourth was added
 * and drifted again, announcing a floor on a cell nothing checks.
 */
export function isBounded(row: Pick<RaceRow, 'kind'>, field: keyof typeof BOUNDS): boolean {
  return field === 'ascentM' || field === 'descentM' || asksFor(row, field)
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

  /* Nothing is wrong with a measure the race does not fix, whichever measure it is:
     it carries nought on purpose, and nought is outside the bounds on purpose. */
  if (!isBounded(row, field)) {
    return false
  }

  return !withinBounds(row[field], field)
}

/**
 * What a row is missing, or nothing where it is finished.
 *
 * The day and its measure are what a race is; a race with no measure the kind it is
 * fixes is not one, and a morning nothing runs on is not a morning. **The climb and the fall are
 * not asked for** (owner, 23.08.2026: „uspon i spust nisu obavezni, jer ako su
 * prazni tumače se kao 0/0"), which is also what the calendar already holds for
 * a flat road race.
 *
 * A length of nought is refused rather than kept: it passes „not empty" and is
 * not a distance, and the whole standing is worked out from it.
 */
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
  /* Walked over every field that has bounds rather than listed, so a measure added
     to `BOUNDS` is asked about without anybody remembering to. */
  return MEASURES.find((field) => isBounded(row, field) && !withinBounds(row[field], field))
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
    /* Hours in the table, seconds on the record, and nought where the race does not
       run to a limit at all. Rounded because a tenth of an hour is 360 seconds
       exactly but a third is not, and a limit is a whole number of seconds or it is
       not a length of time anybody can be held to.

       Nought rather than whatever the cell still holds, because a reader may type a
       limit, change their mind about the kind and save: the cell keeps what was
       typed and nothing on the screen says otherwise, so without this the record
       goes out as a race of a length carrying a limit of twenty four hours. That is
       the shape `data/data.test.tsx` refuses in the file, written by the one screen
       that makes races.

       Read without a fallback: a timed race with an empty limit never reaches here,
       because the save asks `allFinished` first and a limit outside its bounds is
       what that refuses. A fallback would be a second answer to a question that has
       one, and nothing could ever fell it. */
    limitSeconds: asksLimit(row) ? String(Math.round(Number(row.limitHours) * 3600)) : '0',
    /* And the same the other way: a length belongs to a race that fixes one, so a
       race turned into a timed one does not carry the kilometres somebody typed
       before they changed their mind. */
    distanceKm: asksLength(row) ? String(distanceKm) : '0',
    ascentM: String(Number(row.ascentM === '' ? 0 : row.ascentM)),
    descentM: String(Number(row.descentM === '' ? 0 : row.descentM)),
    category: categoryOf(asksLength(row) ? distanceKm : 0),
  }
}
