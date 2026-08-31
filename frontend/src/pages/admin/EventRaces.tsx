import { DatePicker } from '../../forms/DatePicker'
import { useEffect, useRef } from 'react'
import { daysBetween, fieldDate, isoDate, shiftDate } from '../../forms/dateField'
import { useI18n } from '../../i18n/useI18n'
import { RACE_KINDS } from '../../data/types'
import { raceKind } from '../../data/raceKind'
import { asksFor, BOUNDS, isBounded, isWrong, newRaceRow, type RaceRow } from './raceRows'
import './Entity.css'

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
}) {
  const { t } = useI18n()
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

    onRows(rows.map((row) => (row.renamed === 'yes' ? row : { ...row, name: eventName })))
  }, [eventName, onRows, rows])

  const change = (at: number, over: Partial<RaceRow>) => {
    onRows(rows.map((row, index) => (index === at ? { ...row, ...over } : row)))
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
    const wrong = refused && isWrong(row, field)
    /* Whether this cell refuses anything at all, which is not the same as whether it
       is required: the climb and the fall are never required and are always bounded,
       and a measure the race does not fix is neither. Read off the one home the
       refusal and the marking read (`raceRows.isBounded`), so the control cannot
       announce a rule the save does not hold it to; tied by hand to one field name,
       it announced a floor on the limit of every race that has none. */
    const bounded = isBounded(row, field)

    return (
      <input
        className="field__control"
        type="number"
        inputMode="decimal"
        /* The bounds this cell refuses outside of, and only where it refuses
           anything. A race that does not fix a length carries nought, and a
           control announcing „at least a tenth of a kilometre" over a value of
           nought announces a rule that was lifted from it. Both ends and not only
           the floor: a ceiling on a cell nothing checks is the same untruth the
           other way round, and it stood for one round saying the opposite of the
           floor beside it. Asked of the same `isBounded` the refusal and the
           marking ask, so these do not drift again. */
        min={bounded ? BOUNDS[field].least : undefined}
        max={bounded ? BOUNDS[field].most : undefined}
        step="any"
        value={row[field]}
        /* Named by its row as well as its column. „Dužina" twenty times over is
           twenty controls a screen reader cannot tell apart, and the table has no
           row heading to read it with. */
        aria-label={`${t(`admin.field.${field}`)}, ${t('admin.form.raceNumber', {
          which: String(at + 1),
        })}`}
        aria-required={asked}
        aria-invalid={wrong}
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
                      aria-label={`${t('admin.field.raceName')}, ${t('admin.form.raceNumber', {
                        which: String(at + 1),
                      })}`}
                      aria-required="true"
                      aria-invalid={refused && isWrong(row, 'name')}
                      /* The column's own explanation, said again for every box in
                         it: a heading is not read out with the control on every
                         reader, and a hint nobody is pointed at is a hint nobody
                         hears. */
                      /* Changed by hand, so this race stops following its event:
                         renaming the event afterwards leaves it alone
                         (owner, 23.08.2026). */
                      onChange={(event) => change(at, { name: event.target.value, renamed: 'yes' })}
                    />
                  </td>
                  <td>
                    <DatePicker
                      id={`race-date-${String(at)}`}
                      name={`race-date-${String(at)}`}
                      value={row.date}
                      label={`${t('admin.field.raceDate')}, ${t('admin.form.raceNumber', {
                        which: String(at + 1),
                      })}`}
                      required
                      invalid={refused && isWrong(row, 'date')}
                      describedBy={undefined}
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
