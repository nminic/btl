import { Link, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { Resource } from '../components/Resource'
import { combinePair, useEvents, useRaces } from '../data/useResource'
import { formatDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { EventChip } from './calendar/DayChips'
import { LengthLegend } from './calendar/LengthLegend'
import './Calendar.css'

/** A date, as the address writes it: four digits, a dash, two, a dash, two. */
const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The day the address names, or null if it does not name one.
 *
 * The shape is not the value. `2019-13-45` is four digits, a dash, two, a dash,
 * two, and it is not a day: formatting it throws, and the whole screen became
 * the error page instead of saying there is nothing on that day. The round trip
 * through a real date is what also catches `2019-02-31`, which the parser
 * quietly rolls forward to 3 March and which would otherwise draw a page headed
 * with a day nobody asked for.
 */
function dayFrom(date: string | undefined): string | null {
  if (date === undefined || !DATE.test(date)) {
    return null
  }

  const parsed = new Date(`${date}T00:00:00Z`)

  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date
}

/**
 * Everything on one day, on a page of its own (owner, 31.07.2026).
 *
 * A cell in the grid shows five events and no more; the rest are here. It is a
 * page rather than a panel under the grid because a day is a thing somebody
 * sends to somebody else: "look what is on that Saturday" is a link, and a panel
 * that opens inside a screen is not one. The old day panel drew itself below the
 * whole grid, which on a telephone meant below everything, and pressing a date
 * looked like it did nothing at all.
 *
 * A date the address does not recognise is the same answer as a date with
 * nothing on it, and both of them lead back to the month.
 */
export function CalendarDay() {
  const { locale, t } = useI18n()
  const { date } = useParams()
  const state = combinePair(useEvents(), useRaces())
  const asked = dayFrom(date)

  const month = asked === null ? null : asked.slice(0, 7)

  return (
    <div className="calendar">
      {asked !== null && (
        <PageMeta
          title={t('seo.calendarDay.recordTitle', { date: formatDate(asked, locale) })}
          description={t('seo.calendarDay.recordDescription', {
            date: formatDate(asked, locale),
          })}
        />
      )}

      {/* The way back and the heading need no data, so they are outside the
          Resource and stay on screen while the events travel. Every other screen
          in the portal keeps its heading outside for the same reason. */}
      <h1>
        {asked === null
          ? t('calendar.title')
          : t('calendar.dayTitle', { date: formatDate(asked, locale) })}
      </h1>

      {/* The way back, under the heading and not over it: the page began with a
          link rather than with its own heading, so a reader listing the headings met
          a control before learning which page they were on (WCAG 2.2, 1.3.1 and
          2.4.6; owner, 04.09.2026). Kept a link and not dressed as a button, because
          it is a way out and not an action. */}
      <p className="calendar__back">
        <Link to={month === null ? `/${locale}/kalendar` : `/${locale}/kalendar?mesec=${month}`}>
          {t('calendar.title')}
        </Link>
      </p>

      <Resource state={state}>
        {([events, races]) => {
          const onThatDay = asked === null ? [] : events.filter((one) => one.date === asked)

          return onThatDay.length === 0 ? (
            <p className="calendar__empty">{t('calendar.dayEmpty')}</p>
          ) : (
            <>
              <ul className="day-list">
                {onThatDay.map((event) => (
                  <li key={event.id}>
                    <EventChip event={event} races={races} />
                  </li>
                ))}
              </ul>
              {/* The dots are here too, so somebody who landed straight on this
                  address is not left with five colours and no key. */}
              <LengthLegend />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
