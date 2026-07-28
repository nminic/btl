import { Link } from 'react-router'
import { upcomingSeries } from '../../data/derive'
import type { BtlEvent } from '../../data/types'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'

const ROWS = 6

/* "Priprema, pozor, SAD!" The calendar is the main reason people come, so it
 * sits high and wide. A recurring event takes one row and says when it runs
 * next, instead of five consecutive Wednesdays eating the whole widget. */
export function CalendarExtract({ events, today }: { events: BtlEvent[]; today: string }) {
  const { locale, t } = useI18n()
  const series = upcomingSeries(events, today, ROWS)

  return (
    <section className="card" aria-labelledby="calendar-extract-heading">
      <h2 className="card__title" id="calendar-extract-heading">
        {t('home.readySetGo')}
      </h2>

      {series.length === 0 ? (
        <p className="card__empty">{t('calendar.empty')}</p>
      ) : (
        <ul className="extract">
          {series.map((entry) => (
            <li key={entry.next.id} className="extract__row">
              <span className="extract__date">{formatShortDate(entry.next.date, locale)}</span>
              <span className="extract__name">
                <Link to={`/${locale}/kalendar/${entry.next.slug}`}>{entry.name}</Link>
                {entry.more > 0 && (
                  <span className="extract__series"> {t('home.moreRuns', { count: entry.more })}</span>
                )}
              </span>
              <span className="extract__place">{entry.next.city}</span>
            </li>
          ))}
        </ul>
      )}

      <Link className="card__more" to={`/${locale}/kalendar`}>
        {t('home.seeCalendar')}
      </Link>
    </section>
  )
}
