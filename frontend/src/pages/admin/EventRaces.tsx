import { DatePicker } from '../../forms/DatePicker'
import { useEffect, useRef } from 'react'
import { daysBetween, fieldDate, isoDate, shiftDate } from '../../forms/dateField'
import { useI18n } from '../../i18n/useI18n'
import { RACE_KINDS } from '../../data/types'
import { raceKind } from '../../data/raceKind'
import {
  asksFor,
  BOUNDS,
  boundsOf,
  keptWhole,
  newRaceRow,
  RACE_CELLS,
  sentenceFor,
  whyWrong,
  type RaceCell,
  type RaceRow,
} from './raceRows'
import './Entity.css'

/**
 * The id of the sentence that says what is wrong with ONE cell, which that cell is described by.
 *
 * <p>Built from the row's place in the table and the cell's own name, and never from the cell
 * alone: the same column stands in every row, so an id that left the row out would give two cells
 * of one column the first one's sentence (`adminEntities.test.tsx` asks it of the length of two
 * rows). The place and not the race's own number, because a row being entered has none.
 */
const problemId = (at: number, field: RaceCell) => `race-${String(at)}-${field}-problem`

/** The id of the sentence that says why the server did not take one row, built the same way. */
const refusalId = (at: number) => `race-${String(at)}-refused`

/**
 * WHAT THE LAST PRESS DID NOT SAVE, as the screen above hands it in.
 *
 * <p>Owner, 03.10.2026, „Događaj ostaje, trke čekaju": when saving the races fails, the event stays
 * saved and the form stays open with the races and a clear message of what did not go through. So
 * every race the route refused is named here, beside the row it was, with the route's own reason.
 *
 * <p><b>A row is found by its OBJECT and never by its place</b>, which is how `AdminEvents.tsx`
 * already finds the row a race was just made from. The table can gain and lose rows after a
 * press; a refusal kept by position would then be read out beside whatever row came to stand
 * there. Found by its object, a refusal belongs to the row as it was SENT: a row changed since
 * is a different row, and its old refusal goes with the change.
 */
export type NotSaved = {
  /** The words for every row the route refused, by the row that was sent. */
  rows: ReadonlyMap<RaceRow, string>
  /** And the races the press meant to take away and the route kept, already named. */
  kept: readonly { named: string; words: string }[]
}

const NOTHING_REFUSED: NotSaved = { rows: new Map(), kept: [] }

/**
 * The races of one event, entered in the table itself.
 *
 * A race is one length of one morning, so it is defined inside the event and
 * nowhere else (owner, 06.08.2026). It had a screen of its own, then a form of
 * its own that opened over the event's, and since 23.08.2026 it has neither: „u
 * redu ne postoji dugme Otvori, nego je dan trke datepicker... a dužina, uspon i
 * spust mogu da se unesu u samoj tabeli".
 *
 * Nothing here saves. The rows are held by the screen above and written when the
 * one button under them is pressed (AdminEvents.tsx), which is what makes the
 * whole thing one question rather than two: an event and the mornings it runs on
 * are entered together and refused together.
 */

export function EventRaces({
  eventName,
  eventDate,
  rows,
  onRows,
  refused,
  hasRaces,
  notSaved = NOTHING_REFUSED,
}: {
  eventName: string
  /** The day the form above is showing, which is what a new row opens on: „dan
   *  trke... se prvo menja default u sve što pokazuje Datum događaja gore (mogu
   *  promeniti naknadno ako želim)". Read as it stands rather than off the record,
   *  so a race entered under a date that has not been saved yet still lands on
   *  it. */
  eventDate: string
  rows: RaceRow[]
  onRows: (rows: RaceRow[]) => void
  /** Whether the last press was refused, which is when a row that is unfinished
   *  starts saying so. Before that it is merely unfinished, which is the ordinary
   *  state of a row somebody is still typing into. */
  refused: boolean
  /**
   * Whether the event this stands under is one that has races at all.
   *
   * A gathering and a training have none (owner, 23.08.2026), so nothing of this is
   * drawn for them. Handed in rather than left to the screen above to draw or not,
   * because this component remembers the day the rows were last lined up with, and
   * a component that is taken off the screen forgets: measured by a round, a date
   * changed while the table was away left every row where it was, so the same two
   * moves gave two different answers depending on whether the kind had been touched
   * in between. Kept mounted, the memory survives and the rows follow the event as
   * the owner asked on 10.08.2026.
   */
  hasRaces: boolean
  /** What the server refused at the last press, if anything (`NotSaved` above). */
  notSaved?: NotSaved
}) {
  const { locale, t } = useI18n()
  /* The day the form was showing when these rows were last lined up with it. */
  const wasOn = useRef(eventDate)

  /**
   * The races move with the event, by the same number of days (owner,
   * 10.08.2026): two races on the Saturday and one on the Sunday stay two and one
   * after the date is moved, and whichever of them did not want to move is
   * corrected in its own row.
   *
   * On the screen and not at the save, which is the difference the owner's change
   * of 23.08.2026 makes: the mornings move in the table while somebody watches.
   *
   * **Only on a day that is finished being typed.** A date box is typed into a
   * digit at a time, and „07/06/19" is a date as far as a parser is concerned:
   * moving on every keystroke moved the rows once per digit and left a race in
   * 1971. Both the day before and the day after have to be whole, which is what
   * the width says.
   */
  useEffect(() => {
    const whole = (day: string) => day.length === 10 && isoDate(day) !== ''

    if (!whole(eventDate) || eventDate === wasOn.current) {
      return
    }

    const from = wasOn.current

    wasOn.current = eventDate

    if (!whole(from)) {
      return
    }

    /* Never nought: both days are whole and they are not the same one. */
    const by = daysBetween(isoDate(from), isoDate(eventDate))

    onRows(
      rows.map((row) =>
        /* A row whose day has been emptied stays empty; it is a row somebody is
           still typing into, and there is nothing to move it from. */
        isoDate(row.date) === ''
          ? row
          : { ...row, date: fieldDate(shiftDate(isoDate(row.date), by)) },
      ),
    )
  }, [eventDate, onRows, rows])

  /* The day the form was showing when these rows were last lined up with its name. */
  const wasCalled = useRef(eventName)

  /**
   * And a race that still carries its event's name follows it when the event is
   * renamed (owner, 23.08.2026); one that was renamed by hand keeps what it was
   * given, which is what `renamed` is for.
   *
   * On the screen for the same reason the days move on the screen: the table is
   * what somebody is looking at while they type the new name into the field above
   * it, and a table that says the old one is a table that is lying about what the
   * press will write.
   */
  useEffect(() => {
    if (eventName === wasCalled.current) {
      return
    }

    wasCalled.current = eventName

    onRows(rows.map((row) => (row.renamed ? row : { ...row, name: eventName })))
  }, [eventName, onRows, rows])

  const change = (at: number, over: Partial<RaceRow>) => {
    onRows(rows.map((row, index) => (index === at ? { ...row, ...over } : row)))
  }

  /**
   * What a cell is called, by its column and its row: „Uspon (m), 2. trka".
   *
   * <p>One home for what three places used to write out, because the name has to be the SAME
   * words in the control's own label and in the sentence about it: a reader who hears the cell and
   * then looks for it in the list under the table finds it by that name. A column is „Dužina"
   * twenty times over, and a row number is what tells the twenty apart.
   */
  const cellName = (field: RaceCell, at: number) =>
    `${t(
      field === 'name'
        ? 'admin.field.raceName'
        : field === 'date'
          ? 'admin.field.raceDate'
          : `admin.field.${field}`,
    )}, ${t('admin.form.raceNumber', { which: String(at + 1) })}`

  /**
   * WHAT IS WRONG WITH ONE CELL, once a press has been refused and not before.
   *
   * <p>Before that a cell is merely unfinished, which is the ordinary state of one somebody is
   * typing into, and a sentence under every half-typed number would be noise. After it, the cell
   * is marked, described, and named in the list under the table (WCAG 2.2 SC 3.3.1 and 3.3.3).
   */
  const why = (row: RaceRow, field: RaceCell) => (refused ? whyWrong(row, field) : undefined)

  /** Every marked cell of the table and why, in the order the table is read: row by row, and the
   *  cells of one row in the order they are drawn. */
  const problems = rows.flatMap((row, at) =>
    RACE_CELLS.flatMap((field) => {
      const reason = why(row, field)

      return reason === undefined ? [] : [{ at, field, reason }]
    }),
  )

  /** Every row the route refused at the last press, in the order the table is read. Walked over
   *  the rows and asked of the map, so a row that has changed since is simply not found. */
  const refusedHere = rows.flatMap((row, at) => {
    const words = notSaved.rows.get(row)

    return words === undefined ? [] : [{ at, row, words }]
  })

  /**
   * What the name of a row is described by: the sentence about its own name, where that is
   * marked, and the sentence about why the server did not take the row, where it did not.
   *
   * <p>The name and not every cell, because a refusal is about the RACE: the route names one
   * reason for the whole row, and which cell it is about is not always one cell (a limit beside
   * a race of a length is the kind and the limit at once). The name is the cell the row is read
   * by (owner, 23.08.2026), so a reader who lands on it hears why the race was not saved.
   */
  const nameDescribedBy = (row: RaceRow, at: number): string | undefined => {
    const ids = [
      ...(why(row, 'name') === undefined ? [] : [problemId(at, 'name')]),
      ...(notSaved.rows.has(row) ? [refusalId(at)] : []),
    ]

    return ids.length === 0 ? undefined : ids.join(' ')
  }

  /** One measurement of one race, in its own cell. Labelled by row and column,
   *  because „Dužina" twenty times over is twenty controls a screen reader cannot
   *  tell apart. */
  const measure = (row: RaceRow, at: number, field: keyof typeof BOUNDS) => {
    /* Whether the row has to give this measure, asked of the one home rather than
       handed in by the caller. Handed in, the caller wrote `false` for the climb and
       the fall and named the other two by hand, which is three places to keep in
       step with one answer. */
    const asked = asksFor(row, field)
    /* This cell and not „the first thing wrong in the row": a climb of minus five
       hundred is as wrong as the fall of minus nine hundred beside it, and a cell
       that says it is fine sends a reader looking somewhere else
       (WCAG 2.2 SC 3.3.1). */
    const wrong = why(row, field) !== undefined

    return (
      <input
        className="field__control"
        /* A TEXT BOX WITH A NUMERIC KEYBOARD, and not `type="number"`, since 02.10.2026.
           A number box in a Serbian browser refuses the comma Serbian writes a decimal
           with and reports it as empty, so „21,1" typed into the length of a race read
           as no length at all; the owner decided that day „Polje za broj prima i zarez i
           tacku, a portal salje tacku", and this table is where an administrator types a
           length. What the cell takes is read by `raceRows.ts` (`read`), and what leaves
           it by `storedRow`. The climb and the fall are kept whole by the server, so they
           are offered digits alone (`keptWhole`).
         *
           ~~`min`, `max` and `step`~~ went with the number box. They announced the bounds
           this cell refuses outside of, and only where it refuses anything; on a text box
           they announce nothing to anybody and constrain nothing, so kept they would be a
           claim with nobody to hear it. The bounds are what the save holds the cell to
           (`isBounded`, `isWrong`), and a cell outside them is marked when it is refused. */
        type="text"
        inputMode={keptWhole(field) ? 'numeric' : 'decimal'}
        value={row[field]}
        /* Named by its row as well as its column. „Dužina" twenty times over is
           twenty controls a screen reader cannot tell apart, and the table has no
           row heading to read it with. */
        aria-label={cellName(field, at)}
        aria-required={asked}
        aria-invalid={wrong}
        /* Described by the sentence under the table that is about THIS cell, and only while it is
           marked: a description on a cell that is fine would be read out beside nothing wrong. */
        aria-describedby={wrong ? problemId(at, field) : undefined}
        onChange={(event) => change(at, { [field]: event.target.value })}
      />
    )
  }

  /* Nothing on the screen for an event that has no races, and yet still here: the
     hooks above go on running, so the rows keep following the event while the table
     is away and are found as they were when the kind comes back. */
  if (!hasRaces) {
    return null
  }

  return (
    <section className="entity-races" aria-labelledby="races-of-event">
      <h2 id="races-of-event" className="profile__section">
        {t('admin.racesOf', { event: eventName })}
      </h2>


      {rows.length === 0 ? (
        /* Said rather than left as an empty table. An event with no races yet is
           the ordinary state of one entered a fortnight before its distances are
           known (reportResult.test), not a fault. */
        <p className="profile__empty">{t('admin.noRaces')}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <caption className="visually-hidden">
              {t('admin.racesOf', { event: eventName })}
            </caption>
            <thead>
              <tr>
                {/* The name first, because it is what the row is read by (owner,
                    23.08.2026: „u okviru događaja editabilno polje Trka treba da
                    bude u prvoj koloni").

                    The category used to stand beside it and was taken back out the
                    same day: „U dodavanju trka na događaju (administriranje) ne
                    treba da postoji Kategorija kolona ipak." It was read off the
                    length and never asked for, so nothing is lost that the length
                    beside it does not already say, and the room it took is what the
                    button at the end of the row was missing. */}
                <th scope="col">{t('admin.field.raceName')}</th>
                {/* The day, because an event may run over more than one (owner,
                    10.08.2026). */}
                <th scope="col">{t('admin.field.raceDate')}</th>
                {/* Which of the three kinds the race is, and how long a timed one
                    lasts. Two columns and not one: the length and the limit are two
                    different questions in two different units, and a single cell
                    that changed unit under the reader would carry a number typed as
                    kilometres into a race measured in hours.

                    Neither is hidden on a phone. Nothing else in this table is, and
                    hiding these two would leave an administrator on a 360 pixel
                    screen unable to make a timed race at all, and unable to see the
                    cell a refused save marks. The table grows wider than its box and
                    scrolls inside it, which is the shape the owner chose on
                    23.08.2026 for exactly this table. */}
                <th scope="col" className="races__kind">
                  {t('event.raceKind')}
                </th>
                <th scope="col" className="races__measure">
                  {t('event.distance')}
                </th>
                <th scope="col" className="races__measure">
                  {t('event.raceLimit')}
                </th>
                <th scope="col" className="races__measure">
                  {t('event.ascent')}
                </th>
                <th scope="col" className="races__measure">
                  {t('event.descent')}
                </th>
                <th scope="col">{t('admin.form.record')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, at) => (
                <tr key={row.id === '' ? `nova-${String(at)}` : row.id}>
                  <td>
                    <input
                      className="field__control"
                      type="text"
                      value={row.name}
                      /* Named by its row as well as its column, like every other
                         control of this table. */
                      aria-label={cellName('name', at)}
                      aria-required="true"
                      aria-invalid={why(row, 'name') !== undefined}
                      aria-describedby={nameDescribedBy(row, at)}
                      /* The column's own explanation, said again for every box in
                         it: a heading is not read out with the control on every
                         reader, and a hint nobody is pointed at is a hint nobody
                         hears. */
                      /* Changed by hand, so this race stops following its event:
                         renaming the event afterwards leaves it alone
                         (owner, 23.08.2026). */
                      onChange={(event) => change(at, { name: event.target.value, renamed: true })}
                    />
                  </td>
                  <td>
                    <DatePicker
                      id={`race-date-${String(at)}`}
                      name={`race-date-${String(at)}`}
                      value={row.date}
                      label={cellName('date', at)}
                      required
                      invalid={why(row, 'date') !== undefined}
                      describedBy={
                        why(row, 'date') === undefined ? undefined : problemId(at, 'date')
                      }
                      onChange={(next) => change(at, { date: next })}
                    />
                  </td>
                  <td className="races__kind">
                    <select
                      className="field__control"
                      value={row.kind}
                      /* Named by its row as well as its column, like every other
                         control in this table: „Vrsta" twenty times over is twenty
                         controls a screen reader cannot tell apart. */
                      aria-label={`${t('event.raceKind')}, ${t('admin.form.raceNumber', {
                        which: String(at + 1),
                      })}`}
                      /* Read through the one function that knows the three words,
                         like every other reader of a kind (`data/raceKind.ts`): a
                         select can only offer what is drawn above, but nothing in
                         the type of a change event says so. */
                      onChange={(event) => change(at, { kind: raceKind(event.target.value) })}
                    >
                      {RACE_KINDS.map((one) => (
                        <option key={one} value={one}>
                          {t(`race.kind.${one}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="races__measure">
                    {/* And nothing about the row above it. Two races of one length
                        on one morning were refused until 23.08.2026; the owner said
                        that day that a course can genuinely be run twice over the
                        same distance and the same climb, rarely but really, and
                        that the portal must not forbid it. */}
                    {measure(row, at, 'distanceKm')}
                  </td>
                  <td className="races__measure">
                    {measure(row, at, 'limitHours')}
                  </td>
                  <td className="races__measure">{measure(row, at, 'ascentM')}</td>
                  <td className="races__measure">{measure(row, at, 'descentM')}</td>
                  <td>
                    <button
                      type="button"
                      className="entity-open entity-delete"
                      aria-label={t('admin.form.removeRow', {
                        which: String(at + 1),
                      })}
                      onClick={() => onRows(rows.filter((_, index) => index !== at))}
                    >
                      {t('admin.form.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* WHAT IS WRONG WITH EACH MARKED CELL, in words, once a press has been refused (PENDING,
          review of PR 463; WCAG 2.2 SC 3.3.1 and 3.3.3).

          UNDER THE TABLE AND NOT IN THE CELLS, because the columns are narrow on purpose and a
          sentence of eighty letters in a cell of five rem is a cell a dozen lines tall (the table
          scrolls inside its box, owner 23.08.2026). Each one names its cell by column and row, so
          it can be found without the colour, and each cell is described by its own
          (`aria-describedby`), so a reader who lands on the cell hears what is wrong with it
          without having to go and look. The sentence over the table says only that nothing was
          saved. */}
      {problems.length > 0 && (
        <ul className="races__problems" aria-label={t('admin.race.wrong.list')}>
          {problems.map(({ at, field, reason }) => (
            <li key={`${String(at)}-${field}`}>
              <span>{cellName(field, at)}: </span>
              <span id={problemId(at, field)}>
                {t(sentenceFor(field, reason), boundsOf(field, locale))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* WHAT THE LAST PRESS DID NOT SAVE, each race with the route's own reason (owner,
          03.10.2026: the form stays open „sa trkama i jasnom porukom šta nije prošlo").

          Under the table like the list above, and drawn the same way, because both answer the
          same question about the same rows: what is still wrong. The one sentence that says the
          event IS saved is an alert over the form (`AdminEvents.tsx`); these are plain items, so
          a press that refused three races is read out once and not four times. A row is named
          by its place and by its name together, which is what tells „2. trka" from a row the
          reader has since moved; a race the press meant to take away and the route kept has no
          row left, and is named by its own name and day. */}
      {(refusedHere.length > 0 || notSaved.kept.length > 0) && (
        <ul className="races__problems" aria-label={t('admin.race.notSaved')}>
          {refusedHere.map(({ at, row, words }) => (
            <li key={`refused-${String(at)}`}>
              <span>
                {t('admin.form.raceNumber', { which: String(at + 1) })} ({row.name}):{' '}
              </span>
              <span id={refusalId(at)}>{words}</span>
            </li>
          ))}
          {notSaved.kept.map(({ named, words }, at) => (
            <li key={`kept-${String(at)}`}>
              <span>{named}: </span>
              <span>{words}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Opens a row rather than a form (owner, 23.08.2026: „klik na Nova trka
          otvara novi red u tabeli"), on the day the event above is showing.
          `type="button"`, because it stands inside the event's own form and a
          button without one sends it. */}
      <button
        type="button"
        className="button button--secondary"
        onClick={() => onRows([...rows, newRaceRow(eventName, eventDate)])}
      >
        {t('admin.form.new.races')}
      </button>
    </section>
  )
}
