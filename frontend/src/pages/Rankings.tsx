import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Resource } from '../components/Resource'
import {
  categoriesOf,
  categoryOfMember,
  defaultSeason,
  deltaApplies,
  endOfPreviousMonth,
  seasonsWithResults,
  standingWithDelta,
} from '../data/derive'
import type { Competitor, Gender, Result } from '../data/types'
import { combinePair, useCompetitors, useResults } from '../data/useResource'
import { formatDuration, formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'

/* Podium places carry gold, and nothing else on this screen does. Gold means
 * achievement here, so it is spent on the three rows that earned it. */
const PODIUM = 3

/**
 * The Δ cell: how the row has moved since the end of last month (PDL P12).
 *
 * The arrow is hidden from a screen reader and the words beside it are hidden
 * from the eye, because "▲2" is a shape rather than a sentence and a reader
 * announcing the name of a triangle tells nobody anything.
 *
 * Exported for its own test: on any real season the portal has, every row is
 * level, so the screen alone never shows the other three cases.
 */
export function Delta({ places }: { places: number | undefined }) {
  const { t } = useI18n()

  /* Nothing at all for a member who was not in the table last month. An arrow
   * drawn from their first race would claim a climb they never made (PDL P12). */
  if (places === undefined) {
    return null
  }

  if (places === 0) {
    return (
      <>
        <span aria-hidden="true">–</span>
        <span className="visually-hidden">{t('rankings.delta.level')}</span>
      </>
    )
  }

  const up = places > 0

  return (
    <span className={up ? 'delta delta--up' : 'delta delta--down'}>
      <span aria-hidden="true">
        {up ? '▲' : '▼'}
        {Math.abs(places)}
      </span>
      <span className="visually-hidden">
        {t(up ? 'rankings.delta.up' : 'rankings.delta.down', { count: Math.abs(places) })}
      </span>
    </span>
  )
}

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
  today,
  onChange,
}: {
  competitors: Competitor[]
  results: Result[]
  filters: Filters
  today: string
  onChange: (next: Record<string, string>) => void
}) {
  const { locale, t } = useI18n()
  const { gender, category, search, seasonParam } = filters

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

    return defaultSeason(
      results.filter((one) => ofGender.has(one.memberNumber)),
      today,
    )
  }, [competitors, results, gender, seasonParam, today])

  /* The Δ column measures against the end of last month, and it is left out
   * entirely on a season that day falls outside of (PDL P12): in January the
   * season had not begun and in a frozen one nothing can move any more. A column
   * of blanks or a column of dashes says as little as the other. */
  const referenceDay = endOfPreviousMonth(today)
  const showsDelta = deltaApplies(season, referenceDay)

  const rows = useMemo(
    () =>
      standingWithDelta(
        competitors,
        results,
        { season, gender, categoryCode: category, search },
        referenceDay,
      ),
    [competitors, results, season, gender, category, search, referenceDay],
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
          <table className={showsDelta ? 'table table--with-delta' : 'table'}>
            <thead>
              <tr>
                <th scope="col">{t('rankings.columns.position')}</th>
                {showsDelta && (
                  <th scope="col" className="table__hide-phone">
                    {t('rankings.columns.delta')}
                  </th>
                )}
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
                  className={row.position <= PODIUM ? 'podium' : undefined}
                >
                  <td className="table__position">{row.position}</td>
                  {showsDelta && (
                    <td className="table__hide-phone table__delta">
                      <Delta places={row.delta} />
                    </td>
                  )}
                  <td>
                    <Link to={`/${locale}/takmicar/${row.competitor.memberNumber}`}>
                      {row.competitor.firstName} {row.competitor.lastName}
                    </Link>{' '}
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

/* The day is a prop with the clock behind it, the way every other screen that
 * reads a date does it (Membership, EnrolmentSlot, CalendarExtract). Nothing in
 * the application passes it; it is what lets a test put the standing inside a
 * running season, which is the only time the Δ column has anything to say. */
export function Rankings({
  today = new Date().toISOString().slice(0, 10),
}: { today?: string } = {}) {
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
            today={today}
            onChange={change}
          />
        )}
      </Resource>
    </div>
  )
}
