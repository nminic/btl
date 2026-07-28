import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Resource } from '../components/Resource'
import { EMPTY_TOTALS, totalsByMember } from '../data/derive'
import type { Competitor, Result } from '../data/types'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'

/* Split out and memoised: totals used to be recomputed by filtering the whole
 * result set once per competitor, which is thirty passes over three thousand
 * rows for one screen. */
function CompetitorTable({
  competitors,
  results,
  search,
  onSearch,
}: {
  competitors: Competitor[]
  results: Result[]
  search: string
  onSearch: (value: string) => void
}) {
  const { locale, t } = useI18n()
  const totals = useMemo(() => totalsByMember(results), [results])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return competitors
      .filter((competitor) =>
        `${competitor.firstName} ${competitor.lastName} ${competitor.memberNumber} ${competitor.city}`
          .toLowerCase()
          .includes(needle),
      )
      .map((competitor) => ({
        competitor,
        totals: totals.get(competitor.memberNumber) ?? EMPTY_TOTALS,
      }))
  }, [competitors, totals, search])

  return (
    <>
      <div className="rankings__filters">
        <label className="rankings__field rankings__field--wide">
          <span>{t('competitors.search')}</span>
          <input
            type="search"
            value={search}
            placeholder={t('competitors.searchPlaceholder')}
            onChange={(e) => onSearch(e.target.value)}
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
              {rows.map(({ competitor, totals: own }) => (
                <tr key={competitor.memberNumber}>
                  <td>
                    <Link to={`/${locale}/takmicar/${competitor.memberNumber}`}>
                      {competitor.firstName} {competitor.lastName}
                    </Link>{' '}
                    <span className="table__member-number">{competitor.memberNumber}</span>
                  </td>
                  <td>{competitor.categoryCode}</td>
                  <td>{competitor.city}</td>
                  <td className="table__hide-phone">{formatNumber(own.races, locale)}</td>
                  <td className="table__points">{formatPoints(own.points, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export function Competitors() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const search = params.get('trazi') ?? ''
  const state = combineResources(useCompetitors(), useResults(), useTeams())

  return (
    <div className="rankings">
      <h1>{t('competitors.title')}</h1>

      <Resource state={state}>
        {([competitors, results]) => (
          <CompetitorTable
            competitors={competitors}
            results={results}
            search={search}
            onSearch={(value) => setParams(value === '' ? {} : { trazi: value })}
          />
        )}
      </Resource>
    </div>
  )
}
