import { Resource } from '../components/Resource'
import { rankTeams } from '../data/derive'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'

export function Teams() {
  const { locale, t } = useI18n()
  const state = combineResources(useTeams(), useCompetitors(), useResults())

  return (
    <div className="rankings">
      <h1>{t('teams.title')}</h1>

      <Resource state={state}>
        {([teams, competitors, results]) => {
          const rows = rankTeams(teams, competitors, results)

          return (
            <>
              <p className="rankings__note">{t('teams.note')}</p>

              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('rankings.columns.position')}</th>
                      <th scope="col">{t('teams.columns.team')}</th>
                      <th scope="col">{t('teams.columns.city')}</th>
                      <th scope="col">{t('teams.columns.members')}</th>
                      <th scope="col">{t('teams.columns.points')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.team.id} className={index === 0 ? 'podium' : undefined}>
                        <td className="table__position">{index + 1}</td>
                        <td>{row.team.name}</td>
                        <td>{row.team.city}</td>
                        <td>{formatNumber(row.members, locale)}</td>
                        <td className="table__points">{formatPoints(row.totals.points, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
