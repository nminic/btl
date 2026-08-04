import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { useToday } from '../clock/useClock'
import { Resource } from '../components/Resource'
import {
  defaultMonth,
  eventsInMonth,
  monthDays,
  monthFrom,
  monthNumbers,
  shiftMonth,
} from '../data/derive'
import type { BtlEvent, Race } from '../data/types'
import { combinePair, useEvents, useRaces } from '../data/useResource'
import { formatDate, formatMonth } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { EventChip } from './calendar/DayChips'
import { LengthLegend } from './calendar/LengthLegend'
import './Calendar.css'
import { useFilterParams } from '../app/useFilterParams'

/* How many events a day shows before the rest go to the day's own page (owner,
 * 31.07.2026). Five: a day with six is rare enough that sending it to a page of
 * its own costs almost nobody a click, and a day with twelve would otherwise
 * make its whole row twelve chips tall. */
const EVENTS_PER_DAY = 5

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

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
 * thing. Saturday and Sunday carry the number in gold instead, which is the
 * owner's own proposal (04.08.2026): a weekend is what a runner looks for first,
 * and the two marks stay apart because one is a ring and the other is ink. A
 * weekend that is also today wears both.
 */
function Day({
  day,
  month,
  today,
  weekend,
  events,
  races,
  first,
}: {
  day: number
  month: string
  today: string
  /** Saturday or Sunday. */
  weekend: boolean
  events: BtlEvent[]
  races: Race[]
  /** Which column the first of the month sits in, on the days it is the first. */
  first?: number
}) {
  const { locale, t } = useI18n()
  const date = `${month}-${String(day).padStart(2, '0')}`
  const shown = events.slice(0, EVENTS_PER_DAY)
  const hidden = events.length - shown.length

  return (
    <div
      className={[
        'day',
        date === today ? 'day--today' : '',
        weekend ? 'day--weekend' : '',
        first === undefined ? '' : 'day--first',
      ]
        .filter(Boolean)
        .join(' ')}
      style={first === undefined ? undefined : ({ '--day-start': first } as CSSProperties)}
    >
      {/* The number is not a control any more. Pressing a day used to open a
          panel under the whole grid, which on a telephone is under everything,
          so it looked like nothing had happened. What leads somewhere is the
          event, and the day itself only when it holds more than fits. */}
      {/* Both marks are spoken as well as drawn: a colour cannot be the only
          way to know which day it is (WCAG 2.2 SC 1.4.1), and below tablet width
          the days stack with no column headings over them, so the ink is the
          only thing left saying that a day is a weekend at all. */}
      <span className="day__number">
        {day}
        {date === today && <span className="visually-hidden">, {t('calendar.today')}</span>}
        {weekend && <span className="visually-hidden">, {t('calendar.weekend')}</span>}
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

/**
 * The arrow on a step, drawn rather than typed.
 *
 * It was the characters &#8249; and &#8250;, and they sit low in their own line
 * box: measured on the page, their ink was four pixels below the middle of the
 * button while the word "Danas" beside them was half a pixel above it, which is
 * exactly the row not lining up that the owner reported (03.08.2026). Nothing
 * about the box was wrong; the glyph is drawn where the font says, and no amount
 * of centring the box moves the ink inside it.
 *
 * A path is centred because it is drawn centred, in the same shape and the same
 * stroke as the caret in the header (src/app/LanguageMenu.tsx). It carries no
 * name: the button around it has one, and a symbol is a drawing rather than a
 * label.
 */
function Chevron({ back = false }: { back?: boolean }) {
  return (
    <svg
      className="calendar__chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={back ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  )
}

export function Calendar() {
  const { locale, t } = useI18n()
  const [params, setParams] = useFilterParams()
  const state = combinePair(useEvents(), useRaces())
  const today = useToday()

  return (
    <div className="calendar">
      {/* Outside the Resource: a screen that says nothing at all while it waits
          is the one thing every other screen here avoids. */}
      <h1>{t('calendar.title')}</h1>

      <Resource state={state}>
        {([events, races]) => {
          const month = monthFrom(params.get('mesec'), defaultMonth(events, today))
          const { year, index } = monthNumbers(month)
          const { days, offset } = monthDays(year, index)
          const byDay = new Map<string, BtlEvent[]>()

          for (const event of eventsInMonth(events, year, index)) {
            byDay.set(event.date, [...(byDay.get(event.date) ?? []), event])
          }

          return (
            <>
              {/* Danas, then the two steps, then the month (owner, 01.08.2026).
                  The steps are arrows and nothing else, so each carries a name of
                  its own: a symbol is a drawing and a drawing is not a label. */}
              <div className="calendar__bar">
                <button
                  type="button"
                  className="calendar__today"
                  /* Nothing to go back to when it is already here. Disabled
                     rather than hidden, so the row does not change shape under
                     somebody stepping through the months. */
                  disabled={month === today.slice(0, 7)}
                  onClick={() => setParams({ mesec: today.slice(0, 7) })}
                >
                  {t('calendar.today')}
                </button>
                <button
                  type="button"
                  className="calendar__step"
                  aria-label={t('calendar.previousMonth')}
                  onClick={() => setParams({ mesec: shiftMonth(month, -1) })}
                >
                  <Chevron back />
                </button>
                <button
                  type="button"
                  className="calendar__step"
                  aria-label={t('calendar.nextMonth')}
                  onClick={() => setParams({ mesec: shiftMonth(month, 1) })}
                >
                  <Chevron />
                </button>
                <h2 className="calendar__month">{formatMonth(month, locale)}</h2>
              </div>

              {/* Nothing is said about a month with no events in it (owner,
                  04.08.2026: "Ne treba da šetam mesec gore dole zbog tog
                  disclaimera"). The empty grid says it, and the sentence moved
                  the grid down a line every time somebody stepped past a quiet
                  month. The widget on the front page keeps its own, because
                  there the alternative is a card with nothing in it at all. */}

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
                    /* Which day of the week it is, worked out from the column the
                       month starts in: the week runs from Monday, so the last two
                       of the seven are the weekend. */
                    weekend={(offset + day - 1) % 7 >= 5}
                    /* The first of the month carries which column it belongs in
                       and the rest follow it. Nothing is drawn for the days of
                       the month before or the month after: they were squares of
                       nothing, and they read as days with nothing on rather than
                       as days of another month.

                       The column is handed to CSS as a value and applied there,
                       never here. Written straight onto the element it placed
                       day one in column six on a telephone as well, where there
                       is no seven column grid to be in: the implicit grid then
                       grew six columns to hold it and the month spilled a
                       thousand pixels off the side of the screen. */
                    first={day === 1 ? offset + 1 : undefined}
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
