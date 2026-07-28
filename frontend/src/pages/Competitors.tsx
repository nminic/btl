import { Link, useSearchParams } from 'react-router'
import { Resource } from '../components/Resource'
import { totalsOf } from '../data/derive'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'

export function Competitors() {
  const { locale, t } = useI18n()
  const [params, setParams] = useSearchParams()
  const search = params.get('trazi') ?? ''
  const state = combineResources(useCompetitors(), useResults(), useTeams())

  return (
    <div className="rankings">
      <h1>{t('competitors.title')}</h1>

      <Resource state={state}>
        {([competitors, results]) => {
          const needle = search.trim().toLowerCase()
          const rows = competitors
            .filter((competitor) =>
              `${competitor.firstName} ${competitor.lastName} ${competitor.memberNumber} ${competitor.city}`
                .toLowerCase()
                .includes(needle),
            )
            .map((competitor) => ({
              competitor,
              totals: totalsOf(results.filter((r) => r.memberNumber === competitor.memberNumber)),
            }))

          return (
            <>
              <div className="rankings__filters">
                <label className="rankings__field rankings__field--wide">
                  <span>{t('competitors.search')}</span>
                  <input
                    type="search"
                    value={search}
                    placeholder={t('competitors.searchPlaceholder')}
                    onChange={(e) =>
                      setParams(e.target.value === '' ? {} : { trazi: e.target.value })
                    }
                  />
                </label>
              </div>

              <p className="rankings__count">{t('competitors.count', { count: rows.length })}</p>

              {rows.length === 0 ? (
                <p className="rankings__empty">{t('competitors.empty')}</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        <th scope="col">{t('competitors.columns.category')}</th>
                        <th scope="col">{t('competitors.columns.city')}</th>
                        <th scope="col" className="table__hide-phone">
                          {t('competitors.columns.races')}
                        </th>
                        <th scope="col">{t('competitors.columns.points')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ competitor, totals }) => (
                        <tr key={competitor.memberNumber}>
                          <td>
                            <Link to={`/${locale}/takmicar/${competitor.memberNumber}`}>
                              {competitor.firstName} {competitor.lastName}
                            </Link>{' '}
                            <span className="table__member-number">{competitor.memberNumber}</span>
                          </td>
                          <td>{competitor.categoryCode}</td>
                          <td>{competitor.city}</td>
                          <td className="table__hide-phone">{formatNumber(totals.races, locale)}</td>
                          <td className="table__points">{formatPoints(totals.points, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
