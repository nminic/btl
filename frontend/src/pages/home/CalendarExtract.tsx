import { Link } from 'react-router'
import { dotsAt, upcomingSeries } from '../../data/derive'
import type { BtlEvent, Race } from '../../data/types'
import { formatDayMonth } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
/* For the five colours of `.length-dot`, which live in the table sheet because
   the results table draws them too (styles/table.css). The front page needs it
   said out loud more than the calendar does: Home.css asks only for the counter,
   so nothing else on this screen was bringing the colours along.

   The dots and not the card around them. `.card` and the `.extract` names are in
   Home.css, which this file does not ask for either; that is the same fault and
   it is written down as open (ADL A7) rather than fixed here, since only
   table.css is read by the test that keeps this honest. */
import '../../styles/table.css'

const ROWS = 6

/* "Priprema, pozor, SAD!" The calendar is the main reason people come, so what
 * is next stands high on the page.
 *
 * One line per event: the day and month, the lengths it holds as coloured dots,
 * then the name (owner, 31.07.2026). The name is not in bold and never wraps: a
 * second line here would put this widget out of step with the chart beside it,
 * which is the whole point of the two of them sharing a row, so a name that does
 * not fit ends in an ellipsis.
 *
 * The dots are the same five colours as everywhere else, one per length actually
 * run at that event rather than one per race. There is no legend here; the
 * calendar carries it (owner, 31.07.2026).
 *
 * A recurring event takes one row and says when it runs next, instead of five
 * consecutive Wednesdays eating the whole widget.
 */
export function CalendarExtract({
  events,
  races,
  today,
}: {
  events: BtlEvent[]
  races: Race[]
  today: string
}) {
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
          {series.map((entry) => {
            const lengths = dotsAt(entry.next, races)

            return (
              <li key={entry.next.id} className="extract__row">
                {/* A real date underneath, so what a machine reads is never the
                    shortened form a person reads. */}
                <time className="extract__date" dateTime={entry.next.date}>
                  {formatDayMonth(entry.next.date)}
                </time>
                <span className="extract__name">
                  <Link to={`/${locale}/kalendar/${entry.next.slug}`}>{entry.name}</Link>
                  {entry.more > 0 && (
                    <span className="extract__series">
                      {' '}
                      {t('home.moreRuns', { count: entry.more })}
                    </span>
                  )}
                </span>
                <span className="extract__lengths">
                  {lengths.map((one) => (
                    <span
                      key={one}
                      className={`length-dot length-dot--${one}`}
                      aria-hidden="true"
                    />
                  ))}
                  {/* The colours mean nothing to anyone who cannot separate
                      them, so the names travel with the dots. */}
                  <span className="visually-hidden">
                    {lengths.map((one) => t(`category.${one}`)).join(', ')}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {/* On the month today is in (owner, 04.08.2026), which is not where the
          calendar opens by itself: left to choose, it opens on the first month
          that has anything in it, and in a league whose season starts in January
          that is months away from whoever pressed this. */}
      <Link className="card__more" to={`/${locale}/kalendar?mesec=${today.slice(0, 7)}`}>
        {t('home.seeCalendar')}
      </Link>
    </section>
  )
}
