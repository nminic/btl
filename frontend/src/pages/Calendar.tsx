import type { CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useToday } from '../clock/useClock'
import { Resource } from '../components/Resource'
import { defaultMonth, eventsInMonth, monthDays } from '../data/derive'
import type { BtlEvent, Race } from '../data/types'
import { combinePair, useEvents, useRaces } from '../data/useResource'
import { formatDate, formatMonth } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { EventChip } from './calendar/DayChips'
import { LengthLegend } from './calendar/LengthLegend'
import './Calendar.css'

/* How many events a day shows before the rest go to the day's own page (owner,
 * 31.07.2026). Five: a day with six is rare enough that sending it to a page of
 * its own costs almost nobody a click, and a day with twelve would otherwise
 * make its whole row twelve chips tall. */
const EVENTS_PER_DAY = 5

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

function shiftMonth(month: string, by: number): string {
  const [year, index] = month.split('-').map(Number)
  const moved = new Date(Date.UTC(year, index - 1 + by, 1))

  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * One day of the month.
 *
 * The row is as tall as its tallest day and a day is as tall as what is on it
 * (owner, 31.07.2026). No cell of a fixed height and nothing scrolling inside a
 * day: a scroll bar inside a square a seventh of the page wide is a thing nobody
 * finds, and a fixed height meant either cutting a Saturday with four races or
 * giving every empty Tuesday room for four.
 *
 * Today is ringed in gold and is the only day that is, so the ring means one
 * thing.
 */
function Day({
  day,
  month,
  today,
  events,
  races,
  style,
}: {
  day: number
  month: string
  today: string
  events: BtlEvent[]
  races: Race[]
  style?: CSSProperties
}) {
  const { locale, t } = useI18n()
  const date = `${month}-${String(day).padStart(2, '0')}`
  const shown = events.slice(0, EVENTS_PER_DAY)
  const hidden = events.length - shown.length

  return (
    <div className={date === today ? 'day day--today' : 'day'} style={style}>
      {/* The number is not a control any more. Pressing a day used to open a
          panel under the whole grid, which on a telephone is under everything,
          so it looked like nothing had happened. What leads somewhere is the
          event, and the day itself only when it holds more than fits. */}
      <span className="day__number">
        {day}
        {date === today && <span className="visually-hidden">, {t('calendar.today')}</span>}
      </span>

      {shown.map((event) => (
        <EventChip key={event.id} event={event} races={races} />
      ))}

      {hidden > 0 && (
        <Link className="day__more" to={`/${locale}/kalendar/dan/${date}`}>
          {t('calendar.more', { count: hidden })}
          <span className="visually-hidden">, {formatDate(date, locale)}</span>
        </Link>
      )}
    </div>
  )
}

export function Calendar() {
  const { locale, t } = useI18n()
  const [params, setParams] = useSearchParams()
  const state = combinePair(useEvents(), useRaces())
  const today = useToday()

  return (
    <div className="calendar">
      <Resource state={state}>
        {([events, races]) => {
          const month = params.get('mesec') ?? defaultMonth(events, today)
          const [year, index] = month.split('-').map(Number)
          const { days, offset } = monthDays(year, index)
          const byDay = new Map<string, BtlEvent[]>()

          for (const event of eventsInMonth(events, year, index)) {
            byDay.set(event.date, [...(byDay.get(event.date) ?? []), event])
          }

          return (
            <>
              {/* Level with the heading and to its right, the same place the
                  season control sits on a competitor (owner, 31.07.2026). */}
              <div className="calendar__head">
                <h1>{t('calendar.title')}</h1>
                <button
                  type="button"
                  className="calendar__today"
                  onClick={() => setParams({ mesec: today.slice(0, 7) })}
                >
                  {t('calendar.toToday')}
                </button>
              </div>

              <div className="calendar__bar">
                <button
                  type="button"
                  className="calendar__step"
                  onClick={() => setParams({ mesec: shiftMonth(month, -1) })}
                >
                  {t('calendar.previousMonth')}
                </button>
                <h2 className="calendar__month">{formatMonth(month, locale)}</h2>
                <button
                  type="button"
                  className="calendar__step"
                  onClick={() => setParams({ mesec: shiftMonth(month, 1) })}
                >
                  {t('calendar.nextMonth')}
                </button>
              </div>

              {byDay.size === 0 && <p className="calendar__empty">{t('calendar.empty')}</p>}

              <div className="calendar__grid">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="calendar__weekday">
                    {t(`calendar.weekdays.${weekday}`)}
                  </div>
                ))}

                {days.map((day) => (
                  <Day
                    key={day}
                    day={day}
                    month={month}
                    today={today}
                    events={byDay.get(`${month}-${String(day).padStart(2, '0')}`) ?? []}
                    races={races}
                    /* The first of the month is put in its own column and the
                       rest follow it. Nothing is drawn for the days of the month
                       before or the month after: they were squares of nothing,
                       and they read as days with nothing on rather than as days
                       belonging to another month. */
                    style={day === 1 ? { gridColumnStart: offset + 1 } : undefined}
                  />
                ))}
              </div>

              <LengthLegend />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
