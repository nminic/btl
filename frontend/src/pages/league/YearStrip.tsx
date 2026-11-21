import { Link } from 'react-router'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import type { EventRaces } from './leagueCounting'

/**
 * THE YEAR OF A COMPETITION AS A LINE: ONE DOT FOR EVERY EVENT IT COUNTS, THE NEXT ONE GOLD.
 *
 * Owner, 21.11.2026 (PDL, „Strana „Lige” se radi po predlogu B”), chosen between the ones offered:
 * „Traka kroz godinu (tačka za svaki događaj, sledeći zlatan) ostaje; nije kalendar nego slika spiska
 * događaja, a klik na tačku vodi na događaj (odluka od 22.08.2026 „poseban kalendar nema” ostaje).”
 *
 * **A picture of the list under it, and nothing more.** It is drawn from exactly what
 * `LeagueEvents.tsx` lists (`EventRaces`, the events with at least one counted race), so the line and
 * the list cannot disagree about which days a competition has.
 *
 * **What a reader working by ear is given is one sentence, and the line is hidden from him.** The
 * dots are links for the mouse and the finger, and each of them is the same address as the name of
 * its event in the list right below, which is the control that meets WCAG 2.2 SC 2.5.8 and SC 2.1.1:
 * eight more stops for the keyboard would be eight stops that lead nowhere the list does not.
 * `tabIndex={-1}` keeps them out of the order, which is also what lets `aria-hidden` stand over them.
 *
 * **Where a dot stands** is the day of the year its event falls on, against the length of the
 * season's year, so a competition read in December and one read in March draw the same line.
 *
 * `mini` is the one on a card of the showcase: no months, no links (the whole card is the link that
 * opens the competition), and no sentence, because the card already says how many events it has.
 */
export function YearStrip({
  counting,
  season,
  today,
  mini = false,
}: {
  counting: EventRaces[]
  season: number
  today: string
  mini?: boolean
}) {
  const { locale, t } = useI18n()
  const days = [...counting].sort((left, right) => left.event.date.localeCompare(right.event.date))
  const next = days.find(({ event }) => event.date >= today)
  const months = t('leagues.months').split(' ')
  const todayAt = today.startsWith(`${season}-`) ? placeOf(today, season) : null

  const line = (
    <div className={mini ? 'leagues__year leagues__year--mini' : 'leagues__year'} aria-hidden="true">
      <span className="leagues__year-line" />
      {todayAt !== null && <span className="leagues__year-today" style={{ '--at': `${todayAt}%` }} />}
      {days.map(({ event }) => {
        const state = event === next?.event ? 'next' : event.date < today ? 'held' : 'ahead'
        const dot = `leagues__dot leagues__dot--${state}`
        const at = { '--at': `${placeOf(event.date, season)}%` }

        return mini ? (
          <span key={event.id} className={dot} style={at} />
        ) : (
          <Link
            key={event.id}
            className={dot}
            style={at}
            to={`/${locale}/kalendar/${event.slug}`}
            tabIndex={-1}
            title={`${event.name} (${formatShortDate(event.date, locale)})`}
          />
        )
      })}
      {!mini && (
        <span className="leagues__months">
          {months.map((month) => (
            <span key={month}>
              <span className="leagues__month-long">{month}</span>
              <span className="leagues__month-short">{month.slice(0, 1)}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  )

  if (mini) {
    return line
  }

  return (
    <>
      <p className="visually-hidden">
        {next === undefined
          ? t('leagues.yearHeld', { count: days.length, number: days.length })
          : t('leagues.yearNext', {
              count: days.length,
              number: days.length,
              next: formatShortDate(next.event.date, locale),
            })}
      </p>
      {line}
    </>
  )
}

/** How far into the season's year a day falls, as a share of it in per cent, to one decimal. */
function placeOf(day: string, season: number): number {
  const start = Date.UTC(season, 0, 1)
  const length = Date.UTC(season + 1, 0, 1) - start
  const at = Date.parse(`${day}T00:00:00Z`) - start

  return Math.round((Math.min(Math.max(at, 0), length) / length) * 1000) / 10
}
