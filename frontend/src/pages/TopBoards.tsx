import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Resource } from '../components/Resource'
import {
  bestSingleRaces,
  CATEGORIES,
  defaultSeason,
  seasonsWithResults,
  topByCategory,
  topByKilometers,
  topByTimeOnCourse,
} from '../data/derive'
import type { Competitor, Result } from '../data/types'
import { combinePair, useCompetitors, useResults } from '../data/useResource'
import { formatCourseTime, formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './TopBoards.css'

/* The top boards from PDL P12: the lists that stand beside the season table
 * rather than inside it. Every one of them keeps ten places and no more, and
 * they all read the same season, which is chosen once at the top of the page.
 *
 * The ordering rules, tie-breakers included, live in src/data/derive.ts. This
 * file only lays them out.
 */
const PLACES = 10

/** Podium places carry gold here for the same reason they do in the table. */
const PODIUM = 3

type Place = {
  /** Whose place it is; also the address of the profile behind the name. */
  memberNumber: string
  /** Unique within one board, which a member number is not on the race board:
   *  the same runner can hold two of the ten best races. */
  key: string
  /** Not the row number: a tie nothing separates is a shared place, so a board
   *  can read 1, 1, 3 (PDL P12). The numbering is done in src/data/derive.ts,
   *  where the ladder of each board is. */
  position: number
  name: string
  /** The middle column, on the boards that have one. */
  detail?: string
  value: string
}

function Board({
  id,
  title,
  valueLabel,
  detailLabel,
  places,
  empty,
}: {
  id: string
  title: string
  valueLabel: string
  detailLabel?: string
  places: Place[]
  empty: ReactNode
}) {
  const { locale, t } = useI18n()
  const headingId = `board-${id}`

  return (
    <section className="boards__board" aria-labelledby={headingId}>
      <h2 className="boards__title" id={headingId}>
        {title}
      </h2>

      {places.length === 0 ? (
        <p className="boards__empty">{empty}</p>
      ) : (
        <div className="table-scroll">
          <table className="table" aria-labelledby={headingId}>
            <thead>
              <tr>
                <th scope="col">{t('topBoards.columns.position')}</th>
                <th scope="col">{t('topBoards.columns.member')}</th>
                {detailLabel !== undefined && <th scope="col">{detailLabel}</th>}
                <th scope="col">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {places.map((place) => (
                <tr key={place.key} className={place.position <= PODIUM ? 'podium' : undefined}>
                  <td className="table__position">{place.position}</td>
                  <td>
                    <Link to={`/${locale}/takmicar/${place.memberNumber}`}>{place.name}</Link>
                  </td>
                  {place.detail !== undefined && <td className="boards__detail">{place.detail}</td>}
                  <td className="table__points">{place.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function nameOf(competitor: Competitor): string {
  return `${competitor.firstName} ${competitor.lastName}`
}

function Boards({
  competitors,
  results,
  seasonParam,
  onSeason,
}: {
  competitors: Competitor[]
  results: Result[]
  seasonParam: string | null
  onSeason: (season: string) => void
}) {
  const { locale, t } = useI18n()

  const seasons = useMemo(() => seasonsWithResults(results), [results])
  const fallback = useMemo(
    () => defaultSeason(results, new Date().toISOString().slice(0, 10)),
    [results],
  )
  const season = seasonParam === null ? fallback : Number(seasonParam)

  /* One pass over the results per board, and the season only changes when
   * somebody changes it, so the nine boards are not rebuilt on every render. */
  const boards = useMemo(() => {
    const lengths = CATEGORIES.map((category) => ({
      id: category,
      title: t(`topBoards.byLength.${category}`),
      valueLabel: t('topBoards.columns.races'),
      places: topByCategory(competitors, results, season, category, PLACES).map((column) => ({
        memberNumber: column.competitor.memberNumber,
        key: column.competitor.memberNumber,
        position: column.position,
        name: nameOf(column.competitor),
        value: formatNumber(column.races, locale),
      })),
    }))

    return [
      ...lengths,
      {
        id: 'best-races',
        title: t('topBoards.bestRaces'),
        valueLabel: t('topBoards.columns.points'),
        detailLabel: t('topBoards.columns.event'),
        places: bestSingleRaces(competitors, results, season, PLACES).map((row) => ({
          memberNumber: row.competitor.memberNumber,
          key: row.result.id,
          position: row.position,
          name: nameOf(row.competitor),
          detail: row.result.eventName,
          value: formatPoints(row.result.points, locale),
        })),
      },
      {
        id: 'kilometers',
        title: t('topBoards.kilometers'),
        valueLabel: t('topBoards.columns.distance'),
        places: topByKilometers(competitors, results, season, PLACES).map((row) => ({
          memberNumber: row.competitor.memberNumber,
          key: row.competitor.memberNumber,
          position: row.position,
          name: nameOf(row.competitor),
          value: formatNumber(row.kilometers, locale, 2),
        })),
      },
      {
        id: 'on-course',
        title: t('topBoards.onCourse'),
        valueLabel: t('topBoards.columns.time'),
        places: topByTimeOnCourse(competitors, results, season, PLACES).map((row) => ({
          memberNumber: row.competitor.memberNumber,
          key: row.competitor.memberNumber,
          position: row.position,
          name: nameOf(row.competitor),
          value: formatCourseTime(row.seconds),
        })),
      },
    ]
  }, [competitors, results, season, locale, t])

  return (
    <>
      <div className="boards__filters">
        <label className="boards__field">
          <span>{t('topBoards.season')}</span>
          <select value={season} onChange={(event) => onSeason(event.target.value)}>
            {seasons.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="boards__grid">
        {boards.map((board) => (
          <Board key={board.id} {...board} empty={t('topBoards.empty')} />
        ))}

        {/* The pairs board has nothing behind it yet. A pair is two members who
            confirmed each other (PDL P13) and it is ranked on the races they ran
            together (P12); neither the pairing nor the joint race exists in the
            data the prototype reads, and inventing one would be worse than an
            empty board. Verification says the same thing about the queues that
            have no table yet. */}
        <Board
          id="pairs"
          title={t('topBoards.pairs')}
          valueLabel={t('topBoards.columns.points')}
          places={[]}
          empty={t('topBoards.pairsSoon')}
        />
      </div>
    </>
  )
}

export function TopBoards() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const state = combinePair(useCompetitors(), useResults())

  function changeSeason(season: string) {
    const merged = new URLSearchParams(params)

    merged.set('sezona', season)
    setParams(merged)
  }

  return (
    <div className="boards">
      <h1>{t('topBoards.title')}</h1>
      <p className="boards__intro">{t('topBoards.intro')}</p>

      <Resource state={state}>
        {([competitors, results]) => (
          <Boards
            competitors={competitors}
            results={results}
            seasonParam={params.get('sezona')}
            onSeason={changeSeason}
          />
        )}
      </Resource>
    </div>
  )
}
