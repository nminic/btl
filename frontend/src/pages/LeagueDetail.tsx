import { Link, useParams } from 'react-router'
import { Resource } from '../components/Resource'
import { combineResources, useEvents, useLeagues, useRaces } from '../data/useResource'
import { formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Profile.css'

/* A league is a subset of events and a way of grouping the field, never a
 * different scoring formula. Its own page is therefore mostly the list of
 * events that count towards it, plus the rules and prizes that are written for
 * it. Both of those hide themselves while nobody has written them. */
export function LeagueDetail() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const state = combineResources(useLeagues(), useEvents(), useRaces())

  return (
    <Resource state={state}>
      {([leagues, events]) => {
        const league = leagues.find((one) => one.slug === slug)

        if (league === undefined) {
          return <h1>{t('leagues.notFound')}</h1>
        }

        const counting = events
          .filter((event) => league.eventIds.includes(event.id))
          .sort((left, right) => left.date.localeCompare(right.date))

        return (
          <div className="profile">
            <header className="profile__head">
              <p className="profile__meta">
                <Link to={`/${locale}/lige`}>{t('leagues.backToLeagues')}</Link>
              </p>
              <h1>{league.name}</h1>
              <p className="profile__meta">
                {t('leagues.season', { season: league.season })}
                {' · '}
                {league.groupsByCategory ? t('leagues.byCategory') : t('leagues.byGenderOnly')}
              </p>
            </header>

            {league.rules !== '' && (
              <section aria-labelledby="league-rules">
                <h2 className="profile__section" id="league-rules">
                  {t('leagues.rules')}
                </h2>
                <p className="profile__text">{league.rules}</p>
              </section>
            )}

            {league.prizes !== '' && (
              <section aria-labelledby="league-prizes">
                <h2 className="profile__section" id="league-prizes">
                  {t('leagues.prizes')}
                </h2>
                <p className="profile__text">{league.prizes}</p>
              </section>
            )}

            <h2 className="profile__section">
              {t('leagues.countingEvents')}{' '}
              <span className="profile__count">{counting.length}</span>
            </h2>

            {counting.length === 0 ? (
              <p className="profile__empty">{t('leagues.noEvents')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('profile.columns.date')}</th>
                      <th scope="col">{t('profile.columns.event')}</th>
                      <th scope="col">{t('event.place')}</th>
                      <th scope="col">{t('event.races')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counting.map((event) => (
                      <tr key={event.id}>
                        <td>{formatShortDate(event.date, locale)}</td>
                        <td>
                          <Link to={`/${locale}/kalendar/${event.slug}`}>{event.name}</Link>
                        </td>
                        <td>{event.city}</td>
                        <td>{event.raceIds.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      }}
    </Resource>
  )
}
