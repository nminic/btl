import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useToday } from '../clock/useClock'
import { Resource } from '../components/Resource'
import {
  bestSingleRaces,
  defaultSeason,
  rankTeams,
  seasonOf,
  seasonsWithResults,
  topByCategory,
  topByKilometers,
  topByProgress,
  topByTimeOnCourse,
  fieldFor,
} from '../data/derive'
import type { Competitor, RaceCategory, Result, Team } from '../data/types'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatCourseTime, formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'
import './TopBoards.css'

/* The Top 10 boards: the lists the rulebook counts out in Article 56, which
 * stand beside the season table rather than inside it. There are eleven of
 * them, they appear in the order the rulebook names them, every one of them
 * keeps ten places and no more, and they all read the same season, which is
 * chosen once at the top of the page (PDL P12 and P28a).
 *
 * The ordering rules, tie-breakers included, live in src/data/derive.ts. This
 * file only lays them out.
 */
const PLACES = 10

/**
 * The five lengths in the order Article 56 counts them out, longest first (PDL
 * P28a). This one screen is that article on a page, so the article decides the
 * order on it; everywhere else on the portal the five are shown shortest first
 * and stay that way (CATEGORIES in src/data/derive.ts).
 */
const BY_RULEBOOK: RaceCategory[] = ['ultra', 'marathon', 'long', 'half', 'short']

type Place = {
  /** Where the name leads. A profile on most boards, a team page on the team
   *  board, because the row is about the team and not about one member.
   *
   *  Missing where there is nothing to lead to: a member whose fee has run out
   *  has no visible profile (PDL P11), so their name stands in the board with no
   *  link on it, the same as in the tables. */
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
  /** Whether the middle column holds a number. The event name on the board of
   *  best races is words and reads from the left, quietly; the size of a team is
   *  a number and has to read like every other number on the page. */
  detailIsNumber?: boolean
  /** What the column of names is called, when "Član" is not what is in it. */
  nameLabel?: string
  places: Place[]
  /** What stands in place of the table when the board has no places, which is
   *  not always the same sentence: a season without results and a list whose
   *  measure nobody has decided on are two different answers. */
  empty: ReactNode
}

function Board({
  id,
  title,
  valueLabel,
  detailLabel,
  detailIsNumber,
  nameLabel,
  places,
  empty,
}: BoardData) {
  const { t } = useI18n()
  const headingId = `board-${id}`
  const detailClass = detailIsNumber === true ? 'boards__count' : 'boards__detail'

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
                <th scope="col">{nameLabel ?? t('topBoards.columns.member')}</th>
                {detailLabel !== undefined && (
                  <th scope="col" className={detailClass}>
                    {detailLabel}
                  </th>
                )}
                <th scope="col">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {places.map((place) => (
                <tr key={place.key}>
                  <td className="table__position">{place.position}</td>
                  <td>
                    {place.to === undefined ? place.name : <Link to={place.to}>{place.name}</Link>}
                  </td>
                  {place.detail !== undefined && <td className={detailClass}>{place.detail}</td>}
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
  teams,
  seasonParam,
  onSeason,
}: {
  competitors: Competitor[]
  results: Result[]
  teams: Team[]
  seasonParam: string | null
  onSeason: (season: string) => void
}) {
  const { locale, t } = useI18n()

  const today = useToday()
  const seasons = useMemo(() => seasonsWithResults(results), [results])
  const fallback = useMemo(() => defaultSeason(results, today), [results, today])
  const season = seasonParam === null ? fallback : Number(seasonParam)
  /* Who the boards of this season are drawn from (PDL P11). Article 56 is the
     standing of a season in eleven shapes, so the rule that holds for the table
     holds here. */
  const field = useMemo(() => fieldFor(competitors, season, today), [competitors, season, today])

  /* One pass over the results per board, and the season only changes when
   * somebody changes it, so the boards are not rebuilt on every render. */
  const boards = useMemo<BoardData[]>(() => {
    const profile = (who: Competitor) =>
      who.active ? `/${locale}/takmicar/${who.memberNumber}` : undefined
    const noResults = t('topBoards.empty')

    /* Boards seven to eleven of Article 56, in the order the article names them:
     * ultras, marathons, long races, half marathons, short races. This page is
     * the article, so the article decides. */
    const lengths = BY_RULEBOOK.map((category) => ({
      id: category,
      title: t(`topBoards.byLength.${category}`),
      valueLabel: t('topBoards.columns.races'),
      empty: noResults,
      places: topByCategory(field, results, season, category, PLACES).map((column) => ({
        to: profile(column.competitor),
        key: column.competitor.memberNumber,
        position: column.position,
        name: nameOf(column.competitor),
        value: formatNumber(column.races, locale),
      })),
    }))

    /* The team board reads the chosen season like every other board, so the
     * results are narrowed before they are summed. The teams page beside it
     * sums the whole history, which is why rankTeams takes the results it is
     * given rather than a season. */
    const inSeason = results.filter((result) => seasonOf(result) === season)

    return [
      {
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
      },
      {
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
      },
      {
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
      },
      /* Fourth in the rulebook: the best progress. The measure was settled on
         30.07.2026 (PDL P12): the points gained on the previous season, and not
         a change of position or anything measured against last month. Whoever
         did not race the season before is not on the board, which is why the
         board can be empty for a season that is otherwise full. The season
         before it stands beside the gain, so the number can be read rather than
         taken on trust. */
      {
        id: 'progress',
        title: t('topBoards.progress'),
        valueLabel: t('topBoards.columns.gain'),
        detailLabel: t('topBoards.columns.previousSeason'),
        detailIsNumber: true,
        empty: t('topBoards.progressEmpty'),
        places: topByProgress(field, results, season, PLACES).map((row) => ({
          to: profile(row.competitor),
          key: row.competitor.memberNumber,
          position: row.position,
          name: nameOf(row.competitor),
          detail: formatPoints(row.previousPoints, locale),
          value: formatPoints(row.gain, locale),
        })),
      },
      {
        id: 'teams',
        title: t('topBoards.teams'),
        nameLabel: t('topBoards.columns.team'),
        valueLabel: t('topBoards.columns.points'),
        detailLabel: t('topBoards.columns.members'),
        detailIsNumber: true,
        empty: noResults,
        places: rankTeams(teams, competitors, inSeason, season)
          .filter((row) => row.totals.races > 0)
          .slice(0, PLACES)
          .map((row) => ({
            to: `/${locale}/tim/${row.team.slug}`,
            key: row.team.id,
            position: row.position,
            name: row.team.name,
            detail: formatNumber(row.members, locale),
            value: formatPoints(row.totals.points, locale),
          })),
      },
      /* Sixth in the rulebook: the pairs. A pair is two members who confirmed
         each other (PDL P13) and it is ranked on the races they ran together
         (P12); neither the pairing nor the joint race exists in the data the
         prototype reads, and inventing one would be worse than an empty
         board. Verification says the same thing about the queues that have no
         table yet. */
      {
        id: 'pairs',
        title: t('topBoards.pairs'),
        valueLabel: t('topBoards.columns.points'),
        places: [] as Place[],
        empty: t('topBoards.pairsSoon'),
      },
      ...lengths,
    ]
  }, [competitors, field, results, teams, season, locale, t])

  return (
    <>
      <div className="boards__filters rankings__head-tool">
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
          <Board key={board.id} {...board} />
        ))}
      </div>
    </>
  )
}

export function TopBoards() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const state = combineResources(useCompetitors(), useResults(), useTeams())

  function changeSeason(season: string) {
    const merged = new URLSearchParams(params)

    merged.set('sezona', season)
    setParams(merged)
  }

  return (
    <div className="boards rankings--tooled">
      <h1>{t('topBoards.title')}</h1>
      <p className="boards__intro">{t('topBoards.intro')}</p>

      <Resource state={state}>
        {([competitors, results, teams]) => (
          <Boards
            competitors={competitors}
            results={results}
            teams={teams}
            seasonParam={params.get('sezona')}
            onSeason={changeSeason}
          />
        )}
      </Resource>
    </div>
  )
}
