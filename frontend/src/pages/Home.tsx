import { Link } from 'react-router'
import { Resource } from '../components/Resource'
import { combineResources, useCompetitors, useEvents, useResults } from '../data/useResource'
import { formatDate, formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Home.css'

const UPCOMING_ON_HOME = 3

export function Home() {
  const { locale, t } = useI18n()
  const state = combineResources(useCompetitors(), useEvents(), useResults())

  return (
    <div className="home">
      <h1 className="home__title">{t('app.name')}</h1>
      <p className="home__lead">{t('home.lead')}</p>

      <Resource state={state}>
        {([competitors, events, results]) => {
          const kilometers = results.reduce((sum, result) => sum + result.distanceKm, 0)
          const upcoming = [...events]
            .sort((left, right) => left.date.localeCompare(right.date))
            .slice(0, UPCOMING_ON_HOME)

          return (
            <>
              {/* The counter is the one place where gold carries a surface,
                  because it is the scoreboard of the whole league. */}
              <section className="counter" aria-labelledby="brojac-naslov">
                <h2 className="counter__title" id="brojac-naslov">
                  {t('home.countersTitle')}
                </h2>
                <dl className="counter__numbers">
                  <div>
                    <dt>{t('home.members')}</dt>
                    <dd>{formatNumber(competitors.length, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t('home.races')}</dt>
                    <dd>{formatNumber(results.length, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t('home.events')}</dt>
                    <dd>{formatNumber(events.length, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t('home.kilometers')}</dt>
                    <dd>{formatNumber(kilometers, locale)}</dd>
                  </div>
                </dl>
              </section>

              <section className="home__upcoming" aria-labelledby="sledeci-naslov">
                <h2 className="home__section-title" id="sledeci-naslov">
                  {t('home.nextEvents')}
                </h2>
                <ul className="home__events">
                  {upcoming.map((event) => (
                    <li key={event.id} className="home__event">
                      <span className="home__event-date">{formatDate(event.date, locale)}</span>
                      <span className="home__event-name">{event.name}</span>
                      <span className="home__event-place">
                        {event.city}
                        {', '}
                        {t('units.raceCount', { count: event.raceIds.length })}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to={`/${locale}/kalendar`}>{t('home.seeCalendar')}</Link>
              </section>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
