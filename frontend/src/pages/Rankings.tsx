import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useToday } from '../clock/useClock'
import { CompetitorName } from '../components/CompetitorName'
import { Resource } from '../components/Resource'
import {
  categoriesOf,
  categoryOfMember,
  defaultSeason,
  fieldFor,
  rankingFor,
  seasonsWithResults,
} from '../data/derive'
import type { Competitor, Gender, Result } from '../data/types'
import { combinePair, useCompetitors, useResults } from '../data/useResource'
import { formatDuration, formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { podiumClass } from '../components/podium'
import './Rankings.css'

type Filters = {
  gender: Gender
  category: string | undefined
  search: string
  seasonParam: string | null
}

/* Split out and memoised: the standing sums thousands of results, and without
 * this it was recomputed on every keystroke in the search box. */
function Standing({
  competitors,
  results,
  filters,
  onChange,
}: {
  competitors: Competitor[]
  results: Result[]
  filters: Filters
  onChange: (next: Record<string, string>) => void
}) {
  const { locale, t } = useI18n()
  const { gender, category, search, seasonParam } = filters
  const today = useToday()

  const seasons = useMemo(() => seasonsWithResults(results), [results])

  const season = useMemo(() => {
    if (seasonParam !== null) {
      return Number(seasonParam)
    }

    // The default follows the list being shown, not the data as a whole: a
    // season can have a full women's field and a single man in it.
    const ofGender = new Set(
      competitors.filter((one) => one.gender === gender).map((one) => one.memberNumber),
    )

    return defaultSeason(results.filter((one) => ofGender.has(one.memberNumber)), today)
  }, [competitors, results, gender, seasonParam, today])

  /* Who this season's table is drawn from (PDL P11, and `fieldFor` for why).
   *
   * At the call site rather than inside `rankingFor`, because it is a rule about
   * what a list shows and not about how a standing is worked out. Inside, it
   * would also have reached the awards, where taking a row out shifts everybody
   * below it and quietly rewrites who came third in a season already run. */
  const field = useMemo(() => fieldFor(competitors, season, today), [competitors, season, today])

  const rows = useMemo(
    () => rankingFor(field, results, { season, gender, categoryCode: category, search }),
    [field, results, season, gender, category, search],
  )

  return (
    <>
      <p className="rankings__note">{t('rankings.historyNote')}</p>

      <div className="rankings__filters">
        <div className="rankings__tabs" role="group" aria-label={t('rankings.title')}>
          <button
            type="button"
            aria-pressed={gender === 'M'}
            onClick={() => onChange({ pol: 'm', kategorija: '' })}
          >
            {t('rankings.men')}
          </button>
          <button
            type="button"
            aria-pressed={gender === 'F'}
            onClick={() => onChange({ pol: 'z', kategorija: '' })}
          >
            {t('rankings.women')}
          </button>
        </div>

        <label className="rankings__field">
          <span>{t('rankings.season')}</span>
          <select value={season} onChange={(e) => onChange({ sezona: e.target.value })}>
            {seasons.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="rankings__field">
          <span>{t('rankings.columns.category')}</span>
          <select value={category ?? ''} onChange={(e) => onChange({ kategorija: e.target.value })}>
            <option value="">{t('rankings.allCategories')}</option>
            {categoriesOf(competitors, gender, season).map((code) => (
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
            onChange={(e) => onChange({ trazi: e.target.value })}
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
                <tr
                  key={row.competitor.memberNumber}
                  /* Gold on the podium, as everywhere else
                     (src/components/podium.ts). */
                  className={podiumClass(row.position)}
                >
                  <td className="table__position">{row.position}</td>
                  <td>
                    <CompetitorName competitor={row.competitor} />{' '}
                    <span className="table__member-number">{row.competitor.memberNumber}</span>
                  </td>
                  <td>{categoryOfMember(row.competitor, season)}</td>
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
}

export function Rankings() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  /* Only what the standing shows. Waiting on the events as well meant the whole
   * table turned into an error message if that one file failed, over data no row
   * in it has ever read. */
  const state = combinePair(useCompetitors(), useResults())

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
        {([competitors, results]) => (
          <Standing
            competitors={competitors}
            results={results}
            filters={{
              gender: params.get('pol') === 'z' ? 'F' : 'M',
              category: params.get('kategorija') ?? undefined,
              search: params.get('trazi') ?? '',
              seasonParam: params.get('sezona'),
            }}
            onChange={change}
          />
        )}
      </Resource>
    </div>
  )
}
