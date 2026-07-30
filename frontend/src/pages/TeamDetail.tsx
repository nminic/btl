import { Link, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { Resource } from '../components/Resource'
import { Counters } from './home/Counters'
import { categoryOfMember, EMPTY_TOTALS, totalsByMember, totalsOf } from '../data/derive'
import { SEASON } from '../data/pricing'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Profile.css'

/* A team is the only entity besides a competitor that carries a standing, so
 * its page is built the same way: totals on top, then the people who made
 * them, ordered by what each contributed. */
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
        const perMember = totalsByMember(results)
        const totals = totalsOf(results.filter((one) => numbers.has(one.memberNumber)))

        const rows = members
          .map((member) => ({
            member,
            totals: perMember.get(member.memberNumber) ?? EMPTY_TOTALS,
          }))
          .sort((left, right) => right.totals.points - left.totals.points)

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

              <Counters totals={totals} seasonLabel={t('teams.together')} />

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
                      {rows.map((row, index) => (
                        <tr
                          key={row.member.memberNumber}
                          className={index < 3 ? 'podium' : undefined}
                        >
                          <td className="table__position">{index + 1}</td>
                          <td>
                            <Link to={`/${locale}/takmicar/${row.member.memberNumber}`}>
                              {row.member.firstName} {row.member.lastName}
                            </Link>{' '}
                            <span className="table__member-number">{row.member.memberNumber}</span>
                          </td>
                          <td>{categoryOfMember(row.member, SEASON)}</td>
                          <td className="table__hide-phone">
                            {formatNumber(row.totals.races, locale)}
                          </td>
                          <td className="table__points">
                            {formatPoints(row.totals.points, locale)}
                          </td>
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
