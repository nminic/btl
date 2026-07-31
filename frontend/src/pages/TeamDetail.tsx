import { Link, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { Resource } from '../components/Resource'
import { Counters } from './home/Counters'
import { categoryOfMember, rankMembers, totalsOf } from '../data/derive'
import { SEASON } from '../data/pricing'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Profile.css'
import { CompetitorName } from '../components/CompetitorName'

/* A team is the only entity besides a competitor that carries a standing, so
 * its page is built the same way: totals on top, then the people who made
 * them, ordered by what each contributed. */

/** Gold on the podium, as in every other table. */
const PODIUM = 3

export function TeamDetail() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const state = combineResources(useTeams(), useCompetitors(), useResults())

  return (
    <Resource state={state}>
      {([teams, competitors, results]) => {
        const team = teams.find((one) => one.slug === slug)

        if (team === undefined) {
          return <h1>{t('teams.notFound')}</h1>
        }

        const members = competitors.filter((one) => one.teamId === team.id)
        const numbers = new Set(members.map((one) => one.memberNumber))
        const totals = totalsOf(results.filter((one) => numbers.has(one.memberNumber)))
        /* Places, not row numbers, and the whole ladder rather than points
           alone: two members level on points used to be given 1 and 2 by the
           order they happened to be in, while the list of teams beside this one
           already shared the place (PDL P12). */
        const rows = rankMembers(members, results)

        return (
          <>
            <PageMeta
              title={t('seo.team.recordTitle', { name: team.name, city: team.city })}
              description={t('seo.team.recordDescription', { name: team.name })}
            />

            <div className="profile">
              <header className="profile__head">
                <p className="profile__meta">
                  <Link to={`/${locale}/timovi`}>{t('teams.backToTeams')}</Link>
                </p>
                <h1>{team.name}</h1>
                <p className="profile__meta">
                  {team.city}
                  {' · '}
                  {t('units.memberCount', { count: members.length })}
                </p>
              </header>

              <Counters totals={totals} title={t('teams.together')} />

              <h2 className="profile__section">{t('teams.members')}</h2>

              {rows.length === 0 ? (
                <p className="profile__empty">{t('teams.noMembers')}</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">{t('rankings.columns.position')}</th>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        <th scope="col">{t('competitors.columns.category')}</th>
                        <th scope="col" className="table__hide-phone">
                          {t('competitors.columns.races')}
                        </th>
                        <th scope="col">{t('competitors.columns.points')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.competitor.memberNumber}
                          className={row.position <= PODIUM ? 'podium' : undefined}
                        >
                          <td className="table__position">{row.position}</td>
                          <td>
                            <CompetitorName competitor={row.competitor} />{' '}
                            <span className="table__member-number">
                              {row.competitor.memberNumber}
                            </span>
                          </td>
                          <td>{categoryOfMember(row.competitor, SEASON)}</td>
                          <td className="table__hide-phone">{formatNumber(row.races, locale)}</td>
                          <td className="table__points">{formatPoints(row.points, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      }}
    </Resource>
  )
}
