import { Link, useSearchParams } from 'react-router'
import { Resource } from '../components/Resource'
import { categoriesOf, defaultSeason, rankingFor, seasonsWithResults } from '../data/derive'
import type { Gender } from '../data/types'
import { combineResources, useCompetitors, useEvents, useResults } from '../data/useResource'
import { formatDuration, formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'

/* Podium places carry gold, and nothing else on this screen does. Gold means
 * achievement here, so it is spent on the three rows that earned it. */
const PODIUM = 3

export function Rankings() {
  const { locale, t } = useI18n()
  const [params, setParams] = useSearchParams()
  const state = combineResources(useCompetitors(), useResults(), useEvents())

  const gender: Gender = params.get('pol') === 'z' ? 'F' : 'M'
  const category = params.get('kategorija') ?? undefined
  const search = params.get('trazi') ?? ''

  function change(next: Record<string, string>) {
    const merged = new URLSearchParams(params)

    for (const [key, value] of Object.entries(next)) {
      if (value === '') {
        merged.delete(key)
      } else {
        merged.set(key, value)
      }
    }

    setParams(merged)
  }

  return (
    <div className="rankings">
      <h1>{t('rankings.title')}</h1>

      <Resource state={state}>
        {([competitors, results]) => {
          const seasons = seasonsWithResults(results)
          const today = new Date().toISOString().slice(0, 10)
          // The default follows the list being shown, not the data as a whole:
          // a season can have a full women's field and a single man in it.
          const ofGender = new Set(
            competitors.filter((one) => one.gender === gender).map((one) => one.memberNumber),
          )
          const season = Number(
            params.get('sezona') ??
              defaultSeason(
                results.filter((one) => ofGender.has(one.memberNumber)),
                today,
              ),
          )
          const rows = rankingFor(competitors, results, {
            season,
            gender,
            categoryCode: category,
            search,
          })

          return (
            <>
              <p className="rankings__note">{t('rankings.historyNote')}</p>

              <div className="rankings__filters">
                <div className="rankings__tabs" role="group" aria-label={t('rankings.title')}>
                  <button
                    type="button"
                    aria-pressed={gender === 'M'}
                    onClick={() => change({ pol: 'm', kategorija: '' })}
                  >
                    {t('rankings.men')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={gender === 'F'}
                    onClick={() => change({ pol: 'z', kategorija: '' })}
                  >
                    {t('rankings.women')}
                  </button>
                </div>

                <label className="rankings__field">
                  <span>{t('rankings.season')}</span>
                  <select value={season} onChange={(e) => change({ sezona: e.target.value })}>
                    {seasons.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="rankings__field">
                  <span>{t('rankings.columns.category')}</span>
                  <select
                    value={category ?? ''}
                    onChange={(e) => change({ kategorija: e.target.value })}
                  >
                    <option value="">{t('rankings.allCategories')}</option>
                    {categoriesOf(competitors, gender).map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="rankings__field rankings__field--wide">
                  <span>{t('rankings.search')}</span>
                  <input
                    type="search"
                    value={search}
                    placeholder={t('rankings.searchPlaceholder')}
                    onChange={(e) => change({ trazi: e.target.value })}
                  />
                </label>
              </div>

              <p className="rankings__count">{t('rankings.rowCount', { count: rows.length })}</p>

              {rows.length === 0 ? (
                <p className="rankings__empty">{t('rankings.empty')}</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">{t('rankings.columns.position')}</th>
                        <th scope="col">{t('rankings.columns.member')}</th>
                        <th scope="col">{t('rankings.columns.category')}</th>
                        <th scope="col" className="table__hide-phone">
                          {t('rankings.columns.races')}
                        </th>
                        <th scope="col" className="table__hide-phone">
                          {t('rankings.columns.distance')}
                        </th>
                        <th scope="col" className="table__hide-phone">
                          {t('rankings.columns.ascent')}
                        </th>
                        <th scope="col" className="table__hide-phone">
                          {t('rankings.columns.descent')}
                        </th>
                        <th scope="col" className="table__hide-phone">
                          {t('rankings.columns.time')}
                        </th>
                        <th scope="col">{t('rankings.columns.points')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.competitor.memberNumber} className={row.position <= PODIUM ? 'podium' : undefined}>
                          <td className="table__position">{row.position}</td>
                          <td>
                            <Link to={`/${locale}/takmicar/${row.competitor.memberNumber}`}>
                              {row.competitor.firstName} {row.competitor.lastName}
                            </Link>{' '}
                            <span className="table__member-number">{row.competitor.memberNumber}</span>
                          </td>
                          <td>{row.competitor.categoryCode}</td>
                          <td className="table__hide-phone">{row.races}</td>
                          <td className="table__hide-phone">{formatNumber(row.kilometers, locale, 2)}</td>
                          <td className="table__hide-phone">{formatNumber(row.ascent, locale)}</td>
                          <td className="table__hide-phone">{formatNumber(row.descent, locale)}</td>
                          <td className="table__hide-phone">{formatDuration(row.seconds)}</td>
                          <td className="table__points">{formatPoints(row.points, locale)}</td>
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
