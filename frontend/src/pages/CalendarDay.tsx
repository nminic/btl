import { Link, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { Resource } from '../components/Resource'
import { combinePair, useEvents, useRaces } from '../data/useResource'
import { formatDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { EventChip } from './calendar/DayChips'
import './Calendar.css'

/** A date, as the address writes it: four digits, a dash, two, a dash, two. */
const DATE = /^\d{4}-\d{2}-\d{2}$/

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
  const asked = date !== undefined && DATE.test(date) ? date : null

  return (
    <Resource state={state}>
      {([events, races]) => {
        const onThatDay = asked === null ? [] : events.filter((one) => one.date === asked)
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

            <p className="calendar__back">
              <Link to={month === null ? `/${locale}/kalendar` : `/${locale}/kalendar?mesec=${month}`}>
                {t('calendar.title')}
              </Link>
            </p>

            <h1>
              {asked === null ? t('calendar.title') : t('calendar.dayTitle', { date: formatDate(asked, locale) })}
            </h1>

            {onThatDay.length === 0 ? (
              <p className="calendar__empty">{t('calendar.empty')}</p>
            ) : (
              <ul className="day-list">
                {onThatDay.map((event) => (
                  <li key={event.id}>
                    <EventChip event={event} races={races} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      }}
    </Resource>
  )
}
