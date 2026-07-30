import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useToday } from '../clock/useClock'
import { Resource } from '../components/Resource'
import { defaultMonth, eventsInMonth, monthGrid } from '../data/derive'
import type { BtlEvent } from '../data/types'
import { useEvents } from '../data/useResource'
import { formatDate, formatMonth } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Calendar.css'

/* How many chips a day cell shows before it collapses the rest behind a
 * button. Three fits the tallest weekday cell without pushing the row. */
const CHIPS_PER_DAY = 3

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

function shiftMonth(month: string, by: number): string {
  const [year, index] = month.split('-').map(Number)
  const moved = new Date(Date.UTC(year, index - 1 + by, 1))

  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}`
}

function EventChip({ event }: { event: BtlEvent }) {
  const { locale, t } = useI18n()

  return (
    <Link className="chip" to={`/${locale}/kalendar/${event.slug}`}>
      {/* The name wraps over as many lines as it needs and is never cut. */}
      {event.name}
      <i>
        {event.city}
        {', '}
        {t('units.raceCount', { count: event.raceIds.length })}
      </i>
    </Link>
  )
}

function Day({
  day,
  month,
  events,
  onOpen,
}: {
  day: number | null
  month: string
  events: BtlEvent[]
  onOpen: (date: string) => void
}) {
  const { locale, t } = useI18n()

  if (day === null) {
    return <div className="day day--outside" aria-hidden="true" />
  }

  const date = `${month}-${String(day).padStart(2, '0')}`
  const shown = events.slice(0, CHIPS_PER_DAY)
  const hidden = events.length - shown.length

  return (
    <div className="day">
      <button
        type="button"
        className="day__number"
        onClick={() => onOpen(date)}
        aria-label={`${formatDate(date, locale)}, ${t('calendar.showDay')}`}
      >
        {day}
      </button>

      {shown.map((event) => (
        <EventChip key={event.id} event={event} />
      ))}

      {hidden > 0 && (
        <button type="button" className="day__more" onClick={() => onOpen(date)}>
          {t('calendar.more', { count: hidden })}
        </button>
      )}
    </div>
  )
}

export function Calendar() {
  const { locale, t } = useI18n()
  const [params, setParams] = useSearchParams()
  const [openDay, setOpenDay] = useState<string | null>(null)
  const state = useEvents()
  const today = useToday()

  return (
    <div className="calendar">
      <h1>{t('calendar.title')}</h1>

      <Resource state={state}>
        {(events) => {
          const month = params.get('mesec') ?? defaultMonth(events, today)
          const [year, index] = month.split('-').map(Number)
          const inMonth = eventsInMonth(events, year, index)
          const byDay = new Map<string, BtlEvent[]>()

          for (const event of inMonth) {
            byDay.set(event.date, [...(byDay.get(event.date) ?? []), event])
          }

          const goTo = (next: string) => {
            setOpenDay(null)
            setParams({ mesec: next })
          }

          const dayEvents = openDay === null ? [] : (byDay.get(openDay) ?? [])

          return (
            <>
              <div className="calendar__bar">
                <button type="button" className="calendar__step" onClick={() => goTo(shiftMonth(month, -1))}>
                  {t('calendar.previousMonth')}
                </button>
                <h2 className="calendar__month">{formatMonth(month, locale)}</h2>
                <button type="button" className="calendar__step" onClick={() => goTo(shiftMonth(month, 1))}>
                  {t('calendar.nextMonth')}
                </button>
              </div>

              {inMonth.length === 0 && <p className="calendar__empty">{t('calendar.empty')}</p>}

              <div className="calendar__grid">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="calendar__weekday">
                    {t(`calendar.weekdays.${weekday}`)}
                  </div>
                ))}

                {monthGrid(year, index).map((day, cell) => (
                  <Day
                    key={cell}
                    day={day}
                    month={month}
                    events={
                      day === null ? [] : (byDay.get(`${month}-${String(day).padStart(2, '0')}`) ?? [])
                    }
                    onOpen={setOpenDay}
                  />
                ))}
              </div>

              {openDay !== null && (
                <section className="calendar__day-detail" aria-labelledby="day-detail-heading">
                  <h2 id="day-detail-heading">{formatDate(openDay, locale)}</h2>
                  {dayEvents.length === 0 ? (
                    <p>{t('calendar.empty')}</p>
                  ) : (
                    <ul>
                      {dayEvents.map((event) => (
                        <li key={event.id}>
                          <Link to={`/${locale}/kalendar/${event.slug}`}>{event.name}</Link>
                          {', '}
                          {event.city}
                          {', '}
                          {t(`calendar.status.${event.status}`)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" className="calendar__step" onClick={() => setOpenDay(null)}>
                    {t('calendar.closeDay')}
                  </button>
                </section>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
