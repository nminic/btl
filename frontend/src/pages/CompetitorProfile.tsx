import { Link, useParams } from 'react-router'
import { Resource } from '../components/Resource'
import { resultsOf, totalsOf } from '../data/derive'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Profile.css'

export function CompetitorProfile() {
  const { locale, t } = useI18n()
  const { memberNumber } = useParams()
  const state = combineResources(useCompetitors(), useResults(), useTeams())

  return (
    <Resource state={state}>
      {([competitors, results, teams]) => {
        const competitor = competitors.find((one) => one.memberNumber === memberNumber)

        if (competitor === undefined) {
          return <h1>{t('profile.notFound')}</h1>
        }

        const mine = resultsOf(results, competitor.memberNumber)
        const totals = totalsOf(mine)
        const team = teams.find((one) => one.id === competitor.teamId)

        return (
          <div className="profile">
            <header className="profile__head">
              <h1>
                {competitor.firstName} {competitor.lastName}
              </h1>
              <p className="profile__meta">
                <span className="profile__number">{competitor.memberNumber}</span>
                {' · '}
                {competitor.categoryCode}
                {' · '}
                {competitor.city}
                {' · '}
                {t('profile.memberSince', { season: competitor.firstSeason })}
              </p>
              <p className="profile__meta">
                {team === undefined ? (
                  t('profile.noTeam')
                ) : (
                  <Link to={`/${locale}/tim/${team.slug}`}>{team.name}</Link>
                )}
              </p>
            </header>

            <section className="counter" aria-labelledby="profile-totals">
              <h2 className="counter__title" id="profile-totals">
                {t('profile.allTime')}
              </h2>
              <dl className="counter__numbers">
                <div>
                  <dt>{t('profile.races')}</dt>
                  <dd>{formatNumber(totals.races, locale)}</dd>
                </div>
                <div>
                  <dt>{t('profile.kilometers')}</dt>
                  <dd>{formatNumber(totals.kilometers, locale)}</dd>
                </div>
                <div>
                  <dt>{t('profile.ascent')}</dt>
                  <dd>{formatNumber(totals.ascent, locale)}</dd>
                </div>
                <div>
                  <dt>{t('profile.time')}</dt>
                  <dd>{formatDuration(totals.seconds)}</dd>
                </div>
                <div>
                  <dt>{t('profile.points')}</dt>
                  <dd>{formatPoints(totals.points, locale)}</dd>
                </div>
              </dl>
            </section>

            <h2 className="profile__section">{t('profile.results')}</h2>

            {mine.length === 0 ? (
              <p className="profile__empty">{t('profile.noResults')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('profile.columns.date')}</th>
                      <th scope="col">{t('profile.columns.event')}</th>
                      <th scope="col">{t('rankings.columns.category')}</th>
                      <th scope="col" className="table__hide-phone">
                        {t('profile.columns.distance')}
                      </th>
                      <th scope="col" className="table__hide-phone">
                        {t('profile.columns.time')}
                      </th>
                      <th scope="col">{t('profile.columns.points')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mine.map((result) => (
                      <tr key={result.id}>
                        <td>{formatShortDate(result.date, locale)}</td>
                        <td>{result.eventName}</td>
                        <td>{t(`category.${result.category}`)}</td>
                        <td className="table__hide-phone">
                          {formatNumber(result.distanceKm, locale, 2)}
                        </td>
                        <td className="table__hide-phone">{formatDuration(result.seconds)}</td>
                        <td className="table__points">{formatPoints(result.points, locale)}</td>
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
