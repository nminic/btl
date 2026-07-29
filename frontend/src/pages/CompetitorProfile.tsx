import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CategoryDonut } from '../components/CategoryDonut'
import { Resource } from '../components/Resource'
import { Counters } from './home/Counters'
import { CATEGORIES, categoryOfMember, resultsOf, seasonsWithResults, totalsOf } from '../data/derive'
import { SEASON } from '../data/pricing'
import type { Competitor, RaceCategory, Result, Team } from '../data/types'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Profile.css'

const ALL = 'sve'

function countsOf(results: Result[]): Map<RaceCategory, number> {
  const counts = new Map<RaceCategory, number>()

  for (const result of results) {
    counts.set(result.category, (counts.get(result.category) ?? 0) + 1)
  }

  return counts
}

/* The profile is the centre of the portal, so it answers more than "what did
 * this person run". The season and the length filter narrow the table, the
 * totals and the bars follow the same filter, and every one of them lives in
 * the address so a view can be sent as a link. */
function ProfileBody({
  competitor,
  results,
  team,
}: {
  competitor: Competitor
  results: Result[]
  team: Team | undefined
}) {
  const { locale, t } = useI18n()
  const [params, setParams] = useSearchParams()
  const season = params.get('sezona') ?? ALL
  const category = params.get('kategorija') ?? ALL

  const mine = useMemo(
    () => resultsOf(results, competitor.memberNumber),
    [results, competitor.memberNumber],
  )
  const seasons = useMemo(() => seasonsWithResults(mine), [mine])

  const shown = useMemo(
    () =>
      mine
        .filter((result) => season === ALL || result.date.startsWith(season))
        .filter((result) => category === ALL || result.category === category),
    [mine, season, category],
  )

  const totals = useMemo(() => totalsOf(shown), [shown])

  function change(key: string, value: string) {
    const merged = new URLSearchParams(params)

    if (value === ALL) {
      merged.delete(key)
    } else {
      merged.set(key, value)
    }

    setParams(merged)
  }

  return (
    <div className="profile">
      <header className="profile__head">
        <h1>
          {competitor.firstName} {competitor.lastName}
        </h1>
        <p className="profile__meta">
          <span className="profile__number">{competitor.memberNumber}</span>
          {' · '}
          {categoryOfMember(competitor, SEASON)}
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

      <div className="profile__filters">
        <label className="rankings__field">
          <span>{t('rankings.season')}</span>
          <select value={season} onChange={(e) => change('sezona', e.target.value)}>
            <option value={ALL}>{t('profile.allTime')}</option>
            {seasons.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="rankings__field">
          <span>{t('event.category')}</span>
          <select value={category} onChange={(e) => change('kategorija', e.target.value)}>
            <option value={ALL}>{t('profile.allCategories')}</option>
            {CATEGORIES.map((one) => (
              <option key={one} value={one}>
                {t(`category.${one}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Counters totals={totals} seasonLabel={season === ALL ? t('profile.allTime') : t('home.season', { season })} />

      <section aria-labelledby="profile-chart-heading">
        <h2 className="profile__section" id="profile-chart-heading">
          {t('profile.byCategory')}
        </h2>
        <CategoryDonut counts={countsOf(shown)} caption={t('profile.byCategory')} />
      </section>

      <h2 className="profile__section">
        {t('profile.results')} <span className="profile__count">{shown.length}</span>
      </h2>

      {shown.length === 0 ? (
        <p className="profile__empty">
          {mine.length === 0 ? t('profile.noResults') : t('profile.noneInFilter')}
        </p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <caption className="visually-hidden">{t('profile.results')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('profile.columns.date')}</th>
                <th scope="col">{t('profile.columns.event')}</th>
                <th scope="col">{t('rankings.columns.category')}</th>
                <th scope="col" className="table__hide-phone">
                  {t('profile.columns.distance')}
                </th>
                <th scope="col" className="table__hide-phone">
                  {t('rankings.columns.ascent')}
                </th>
                <th scope="col" className="table__hide-phone">
                  {t('rankings.columns.descent')}
                </th>
                <th scope="col" className="table__hide-phone">
                  {t('profile.columns.time')}
                </th>
                <th scope="col">{t('profile.columns.points')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((result) => (
                <tr key={result.id}>
                  <td>{formatShortDate(result.date, locale)}</td>
                  <td>{result.eventName}</td>
                  <td>{t(`category.${result.category}`)}</td>
                  <td className="table__hide-phone">
                    {formatNumber(result.distanceKm, locale, 2)}
                  </td>
                  <td className="table__hide-phone">{formatNumber(result.ascentM, locale)}</td>
                  <td className="table__hide-phone">{formatNumber(result.descentM, locale)}</td>
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
}

export function CompetitorProfile({ memberNumber: given }: { memberNumber?: string } = {}) {
  const { t } = useI18n()
  const params = useParams()
  const memberNumber = given ?? params.memberNumber
  const state = combineResources(useCompetitors(), useResults(), useTeams())

  return (
    <Resource state={state}>
      {([competitors, results, teams]) => {
        const competitor = competitors.find((one) => one.memberNumber === memberNumber)

        if (competitor === undefined) {
          return <h1>{t('profile.notFound')}</h1>
        }

        return (
          <ProfileBody
            competitor={competitor}
            results={results}
            team={teams.find((one) => one.id === competitor.teamId)}
          />
        )
      }}
    </Resource>
  )
}
