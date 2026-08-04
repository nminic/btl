import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useFilterParams } from '../app/useFilterParams'
import { useToday } from '../clock/useClock'
import { ColumnChart, type ChartColumn } from '../components/ColumnChart'
import { Resource } from '../components/Resource'
import {
  bestSingleRaces,
  defaultSeason,
  seasonsWithResults,
  topByCategory,
  topByKilometers,
  topByProgress,
  topByTimeOnCourse,
  fieldFor,
} from '../data/derive'
import type { Competitor, RaceCategory, Result } from '../data/types'
import { combinePair, useCompetitors, useResults } from '../data/useResource'
import { formatCourseTime, formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { podiumClass } from '../components/podium'
import './Rankings.css'
import './TopBoards.css'

/* The Top liste: the lists the rulebook counts out in Article 55, which stand
 * beside the season table rather than inside it. Every one of them keeps ten
 * places and no more, and they all read the same season, which is chosen once at
 * the top of the page (PDL P12 and P28a).
 *
 * The layout is the owner's, 04.08.2026, and it is two thirds against one:
 *
 *   left, one under another    the five lengths as charts, then the best
 *                              progress as a chart, then the best single races
 *                              across the whole of that width
 *   right, each two rows tall  the most kilometres, the longest on course, the
 *                              best pairs
 *
 * The board of the best teams went off this page entirely: the teams have a page
 * of their own, and that is where a standing of teams belongs. It stays one of
 * the lists Article 55 counts out, and the standing on that page is worked out
 * per season by the same `rankTeams`; what is gone is this page's own view of
 * it, not the ranking.
 *
 * The order in the markup is two lengths, then the board that stands beside
 * them, and so on: it is what a phone reads top to bottom, and on a wide screen
 * every board still follows the rows it was placed against. It is deliberately
 * not the wide screen read strictly across each row, because a board on the
 * right spans two rows on the left and so belongs to neither of them; putting it
 * after the two it stands beside is the one order that reads the same both
 * ways.
 *
 * The ordering rules, tie-breakers included, live in src/data/derive.ts. This
 * file only lays them out.
 */
const PLACES = 10

type Place = {
  /** Where the name leads. Missing where there is nothing to lead to: a member
   *  whose fee has run out has no visible profile (PDL P11), so their name
   *  stands in the board with no link on it, the same as in the tables. */
  to?: string
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

type BoardData = {
  id: string
  title: string
  valueLabel: string
  detailLabel?: string
  places: Place[]
  /** What stands in place of the table when the board has no places, which is
   *  not always the same sentence: a season without results and a list whose
   *  measure nobody has decided on are two different answers. */
  empty: ReactNode
}

type ChartData = {
  id: string
  title: string
  columns: ChartColumn[]
  empty: string
}

/** One board on the page, drawn either way. The tag is what the grid places by
 *  and what this file renders by, so a board cannot be laid out as one thing and
 *  drawn as another. */
type Widget = ({ kind: 'chart' } & ChartData) | ({ kind: 'table' } & BoardData)

function Board({ id, title, valueLabel, detailLabel, places, empty }: BoardData) {
  const { t } = useI18n()
  const headingId = `board-${id}`

  return (
    <section className={`boards__board boards__board--${id}`} aria-labelledby={headingId}>
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
                {detailLabel !== undefined && (
                  <th scope="col" className="boards__detail">
                    {detailLabel}
                  </th>
                )}
                <th scope="col">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {places.map((place) => (
                /* Gold on the podium, as everywhere else (src/components/podium.ts). */
                <tr key={place.key} className={podiumClass(place.position)}>
                  <td className="table__position">{place.position}</td>
                  <td>
                    {place.to === undefined ? place.name : <Link to={place.to}>{place.name}</Link>}
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

/* A board drawn as bars (owner, 04.08.2026: "uradi grafikone kao sa naslovne
   strane"). The gold band under the bars is the heading of the board, so a
   reader moving by heading walks all ten of them whichever way they are drawn. */
function Chart({ id, title, columns, empty }: ChartData) {
  return (
    <div className={`boards__board boards__board--${id}`}>
      <ColumnChart
        columns={columns}
        caption={title}
        captionId={`board-${id}`}
        empty={empty}
        label={title}
      />
    </div>
  )
}

function nameOf(competitor: Competitor): string {
  return `${competitor.firstName} ${competitor.lastName}`
}

/** Points as they are written into a bar: rounded, with no decimals (owner,
 *  04.08.2026). A bar is read at a glance, and two decimals on it are two
 *  characters nobody reads. */
function rounded(points: number, locale: string): string {
  return formatNumber(Math.round(points), locale)
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

  const today = useToday()
  const seasons = useMemo(() => seasonsWithResults(results), [results])
  const fallback = useMemo(() => defaultSeason(results, today), [results, today])
  const season = seasonParam === null ? fallback : Number(seasonParam)
  /* Who the boards of this season are drawn from (PDL P11). Article 55 is the
     standing of a season in several shapes, so the rule that holds for the table
     holds here. */
  const field = useMemo(() => fieldFor(competitors, season, today), [competitors, season, today])

  /* One pass over the results per board, and the season only changes when
   * somebody changes it, so the boards are not rebuilt on every render. */
  const boards = useMemo<Widget[]>(() => {
    const profile = (who: Competitor) =>
      who.active ? `/${locale}/takmicar/${who.memberNumber}` : undefined
    const noResults = t('topBoards.empty')

    /* One of the five lists by length, as a chart of its own. On the front page
       these five turn one into another; here each stands still and keeps its own
       widget, which is what the owner asked for: "bez rotiranja (jer će svaki
       imati svoj prikaz)". */
    const byLength = (category: RaceCategory): Widget => ({
      kind: 'chart',
      id: category,
      title: t(`topBoards.byLength.${category}`),
      empty: noResults,
      columns: topByCategory(field, results, season, category, PLACES).map((column) => ({
        key: column.competitor.memberNumber,
        competitor: column.competitor,
        value: column.races,
        label: formatNumber(column.races, locale),
        place: t('topBoards.place', { position: column.position }),
        to: profile(column.competitor),
      })),
    })

    /* The best progress, as a chart of two levels (owner, 04.08.2026): the
       season before at the foot of the bar, this season's gain on top of it, so
       the whole column is this season and the split says where it came from.

       The measure was settled on 30.07.2026 (PDL P12): the points gained on the
       previous season, and not a change of position or anything measured against
       last month. Whoever did not race the season before is not on the board,
       which is why it can be empty in a season that is otherwise full, and why
       it stays empty until the league has two seasons behind it. The owner knows
       and asked that it be kept until then, to be looked at.

       One thing follows from the shape the owner asked for and is worth saying
       out loud: the bars are ordered by the gain and drawn by the whole season,
       so they do not step down in height the way every other chart here does.
       Somebody who gained little on a large total stands below somebody who
       gained much on a small one, and their bar is the taller of the two. That is
       what "the season before at the foot, the gain on top of it" means. */
    const progress: Widget = {
      kind: 'chart',
      id: 'progress',
      title: t('topBoards.progress'),
      empty: t('topBoards.progressEmpty'),
      columns: topByProgress(field, results, season, PLACES).map((row) => ({
        key: row.competitor.memberNumber,
        competitor: row.competitor,
        value: row.points,
        label: rounded(row.gain, locale),
        reading: t('topBoards.columns.gain'),
        place: t('topBoards.place', { position: row.position }),
        base: {
          value: row.previousPoints,
          label: rounded(row.previousPoints, locale),
          reading: t('topBoards.columns.previousSeason'),
        },
        to: profile(row.competitor),
      })),
    }

    const kilometers: Widget = {
      kind: 'table',
      id: 'kilometers',
      title: t('topBoards.kilometers'),
      valueLabel: t('topBoards.columns.distance'),
      empty: noResults,
      places: topByKilometers(field, results, season, PLACES).map((row) => ({
        to: profile(row.competitor),
        key: row.competitor.memberNumber,
        position: row.position,
        name: nameOf(row.competitor),
        value: formatNumber(row.kilometers, locale, 2),
      })),
    }

    const onCourse: Widget = {
      kind: 'table',
      id: 'on-course',
      title: t('topBoards.onCourse'),
      valueLabel: t('topBoards.columns.time'),
      empty: noResults,
      places: topByTimeOnCourse(field, results, season, PLACES).map((row) => ({
        to: profile(row.competitor),
        key: row.competitor.memberNumber,
        position: row.position,
        name: nameOf(row.competitor),
        value: formatCourseTime(row.seconds),
      })),
    }

    /* The pairs. A pair is two members who confirmed each other (PDL P13) and it
       is ranked on the races they ran together (P12); neither the pairing nor
       the joint race exists in the data the prototype reads, and inventing one
       would be worse than an empty board. Verification says the same thing about
       the queues that have no table yet.

       The owner asked for both names one under the other, whoever scored more on
       top, their points together to the right and the races they share below
       that (04.08.2026). None of that can be drawn from nothing, so the shape
       arrives with the pairs themselves. */
    const pairs: Widget = {
      kind: 'table',
      id: 'pairs',
      title: t('topBoards.pairs'),
      valueLabel: t('topBoards.columns.points'),
      places: [],
      empty: t('topBoards.pairsSoon'),
    }

    const bestRaces: Widget = {
      kind: 'table',
      id: 'best-races',
      title: t('topBoards.bestRaces'),
      valueLabel: t('topBoards.columns.points'),
      detailLabel: t('topBoards.columns.event'),
      empty: noResults,
      places: bestSingleRaces(field, results, season, PLACES).map((row) => ({
        to: profile(row.competitor),
        key: row.result.id,
        position: row.position,
        name: nameOf(row.competitor),
        detail: row.result.eventName,
        value: formatPoints(row.result.points, locale),
      })),
    }

    /* Two lengths and the board that stands beside them, then the next two, and
       so on, with the best single races under all of it. See the head of this
       file for why this and not strictly across each row. */
    return [
      byLength('ultra'),
      byLength('marathon'),
      kilometers,
      byLength('long'),
      byLength('half'),
      onCourse,
      byLength('short'),
      progress,
      pairs,
      bestRaces,
    ]
  }, [field, results, season, locale, t])

  return (
    <>
      <div className="boards__filters rankings__head-tool">
        <label className="rankings__field">
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
        {boards.map((board) =>
          board.kind === 'chart' ? (
            <Chart key={board.id} {...board} />
          ) : (
            <Board key={board.id} {...board} />
          ),
        )}
      </div>
    </>
  )
}

export function TopBoards() {
  const { t } = useI18n()
  const [params, setParams] = useFilterParams()
  /* Only what the boards show. The teams went off this page with the layout of
     04.08.2026, and the file of teams went with them. */
  const state = combinePair(useCompetitors(), useResults())

  function changeSeason(season: string) {
    const merged = new URLSearchParams(params)

    merged.set('sezona', season)
    setParams(merged)
  }

  return (
    <div className="boards rankings--tooled">
      <h1>{t('topBoards.title')}</h1>

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
