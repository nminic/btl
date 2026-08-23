import { DatePicker } from '../../forms/DatePicker'
import { categoryOf } from '../../data/raceCategory'
import { useEffect, useRef } from 'react'
import { daysBetween, fieldDate, isoDate, shiftDate } from '../../forms/dateField'
import { useI18n } from '../../i18n/useI18n'
import { BOUNDS, clashesWith, whatIsMissing, type RaceRow } from './raceRows'
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

  const change = (at: number, over: Partial<RaceRow>) => {
    onRows(rows.map((row, index) => (index === at ? { ...row, ...over } : row)))
  }

  /** One measurement of one race, in its own cell. Labelled by row and column,
   *  because „Dužina" twenty times over is twenty controls a screen reader cannot
   *  tell apart. */
  const measure = (
    row: RaceRow,
    at: number,
    field: 'distanceKm' | 'ascentM' | 'descentM',
    asked: boolean,
  ) => {
    /* Every kind of wrong this cell can be, not only „missing": a climb of minus
       five hundred is as wrong as an empty length, and a cell that says it is fine
       sends a reader looking somewhere else (WCAG 2.2 SC 3.3.1). */
    const wrong = refused && whatIsMissing(row) === field

    return (
      <input
        className="field__control"
        type="number"
        inputMode="decimal"
        min={BOUNDS[field].least}
        max={BOUNDS[field].most}
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
                {/* The day, because an event may run over more than one (owner,
                    10.08.2026). */}
                <th scope="col">{t('admin.field.raceDate')}</th>
                <th scope="col">{t('event.distance')}</th>
                <th scope="col">{t('event.ascent')}</th>
                <th scope="col">{t('event.descent')}</th>
                <th scope="col">{t('event.category')}</th>
                <th scope="col">{t('admin.form.record')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, at) => (
                <tr key={row.id === '' ? `nova-${String(at)}` : row.id}>
                  <td>
                    <DatePicker
                      id={`race-date-${String(at)}`}
                      name={`race-date-${String(at)}`}
                      value={row.date}
                      label={`${t('admin.field.raceDate')}, ${t('admin.form.raceNumber', {
                        which: String(at + 1),
                      })}`}
                      required
                      invalid={refused && whatIsMissing(row) === 'date'}
                      describedBy={undefined}
                      onChange={(next) => change(at, { date: next })}
                    />
                  </td>
                  <td>
                    {measure(row, at, 'distanceKm', true)}
                    {/* And that this row is not the row above it. A race has no
                        name of its own, so two of one length on one morning are
                        two entries nothing tells apart (raceRows.ts). Said on
                        both, because neither is the wrong one; what is wrong is
                        that there are two. */}
                    {refused && clashesWith(rows, at) && (
                      <span className="field__error">{t('admin.form.raceTwice')}</span>
                    )}
                  </td>
                  <td>{measure(row, at, 'ascentM', false)}</td>
                  <td>{measure(row, at, 'descentM', false)}</td>
                  {/* Read off the length and never asked for, which is the rule
                      the portal has always kept: there is nothing to decide and
                      nothing to get wrong (data/raceCategory.ts). An empty length
                      has no category yet, and a dash says so without pretending to
                      one. */}
                  <td>
                    {Number(row.distanceKm) > 0
                      ? t(`category.${categoryOf(Number(row.distanceKm))}`)
                      : '–'}
                  </td>
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
        onClick={() =>
          onRows([
            ...rows,
            {
              id: '',
              date: isoDate(eventDate) === '' ? '' : eventDate,
              distanceKm: '',
              ascentM: '',
              descentM: '',
            },
          ])
        }
      >
        {t('admin.form.new.races')}
      </button>
    </section>
  )
}
