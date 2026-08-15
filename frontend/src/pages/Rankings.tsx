import { categoryLabel } from '../data/categories'
import { useMemo } from 'react'
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
import { mineClass, rowClass } from '../components/mine'
import { useSession } from '../session/useSession'
import './Rankings.css'
import { useFilterParams } from '../app/useFilterParams'

type Filters = {
  gender: Gender
  category: string | undefined
  seasonParam: string | null
}

/* Split out and memoised: the standing sums thousands of results, and a
 * category pressed is a whole table counted again. It was worse: until the
 * search box went (owner, 31.07.2026) this ran on every letter typed. */
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
  const { gender, category, seasonParam } = filters
  const today = useToday()
  /* Whoever is reading, so their own row is marked (owner, 05.08.2026). Null for
     a visitor, and then no row is anybody's. */
  const { memberNumber: mine } = useSession()

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
    () => rankingFor(field, results, { season, gender, categoryCode: category }),
    [field, results, season, gender, category],
  )

  /* No sentence under the heading (owner, 04.08.2026). It said that the 2027
     season had not started and that what stands here is trial data, which is
     true of the whole portal until January and was being said on two screens
     out of thirty. */
  return (
    <>
      {/* Level with the heading, at the far right, where every screen with a
          control keeps it (owner, 05.08.2026). It is the one thing on this row
          that says which table is being read rather than narrowing it, so it
          belongs with the name of the screen and not among the filters. */}
      <div className="rankings__head-tool">
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
      </div>

      {/* Season and categories in one row, their names on one line and their
          controls on the line below it (owner, 11.08.2026). They were on two
          rows with the categories under the season, which put two controls of
          one purpose at two heights.

          The categories are chosen by pressing one rather than out of a list
          that has to be opened first: a category is one of eight or so, all of
          them worth seeing at once, and a select showed one and hid the rest
          behind two presses. Written out on the control and short in the table
          (owner, 05.08.2026): a column heading is read against the eight beside
          it and lives on the width of a telephone, a label on a control is read
          on its own.

          There were three fields here and one of them was a search box, which
          the owner had it taken out on 31.07.2026: it was the most expensive
          thing on the screen, since the whole standing was summed again on
          every letter typed, and it answered a question the list of
          competitors already answers (PDL P12). */}
      <div className="rankings__filters">
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

        <div
          className="rankings__field rankings__field--categories"
          role="group"
          aria-labelledby="rankings-categories"
        >
          <span id="rankings-categories">{t('rankings.categoryFilter')}</span>
          <div className="rankings__categories">
            <button
              type="button"
              className={
                category === undefined
                  ? 'rankings__category rankings__category--on'
                  : 'rankings__category'
              }
              aria-pressed={category === undefined}
              onClick={() => onChange({ kategorija: '' })}
            >
              {t('rankings.allCategories')}
            </button>
            {categoriesOf(competitors, gender, season).map((code) => (
              <button
                key={code}
                type="button"
                className={
                  category === code
                    ? 'rankings__category rankings__category--on'
                    : 'rankings__category'
                }
                aria-pressed={category === code}
                onClick={() => onChange({ kategorija: code })}
              >
                {categoryLabel(code, t)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Said of the people counted, not of a word that covers both (owner,
          05.08.2026): nine women are "9 takmičarki", and the case follows the
          number the way Serbian asks, one takmičarka, two takmičarke, five
          takmičarki. */}
      <p className="rankings__count">
        {t(gender === 'F' ? 'rankings.rowCountWomen' : 'rankings.rowCount', {
          count: rows.length,
        })}
      </p>

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
                     (src/components/podium.ts), and blue on the row of whoever
                     is reading (src/components/mine.ts). A row can be both. */
                  className={rowClass(
                    podiumClass(row.position),
                    mineClass(row.competitor.memberNumber, mine),
                  )}
                >
                  <td className="table__position">
                    {row.position}
                    {/* Heard instead of the colour, in the first cell of the
                        row, which here is the one that numbers it: it reads as
                        part of the place rather than as a word on a name. The
                        results of an event have no such column, so there it is
                        said in the cell that carries the name. */}
                    {mineClass(row.competitor.memberNumber, mine) === undefined ? null : (
                      <span className="visually-hidden"> {t('rankings.myRow')}</span>
                    )}
                  </td>
                  <td>
                    <CompetitorName competitor={row.competitor} />{' '}
                    <span className="table__member-number">{row.competitor.memberNumber}</span>
                  </td>
                  <td>{categoryLabel(categoryOfMember(row.competitor, season), t)}</td>
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
  const [params, setParams] = useFilterParams()
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
    <div className="rankings rankings--tooled">
      <h1>{t('rankings.title')}</h1>

      <Resource state={state}>
        {([competitors, results]) => (
          <Standing
            competitors={competitors}
            results={results}
            filters={{
              gender: params.get('pol') === 'z' ? 'F' : 'M',
              category: params.get('kategorija') ?? undefined,
              seasonParam: params.get('sezona'),
            }}
            onChange={change}
          />
        )}
      </Resource>
    </div>
  )
}
