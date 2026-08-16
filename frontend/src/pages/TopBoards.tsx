import { profilePath } from './profileAddress'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useFilterParams } from '../app/useFilterParams'
import { useToday } from '../clock/useClock'
import { ColumnChart, type ChartColumn } from '../components/ColumnChart'
import { Resource } from '../components/Resource'
import { SeasonPicker } from '../components/SeasonPicker'
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
import { formatCourseTime, formatDuration, formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { leaderClass } from '../components/podium'
import { mineIn, rowClass } from '../components/mine'
import { useSession } from '../session/useSession'
import './Rankings.css'
import './TopBoards.css'

/* The Top liste: the lists the rulebook counts out in Article 55, which stand
 * beside the season table rather than inside it. They keep ten places and no
 * more, except the best progress, which keeps five (owner, 04.08.2026), and they
 * all read the same season, which is chosen once at the top of the page (PDL P12
 * and P28a).
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

/** Five, not ten (owner, 04.08.2026). Ten bars of a gain is a wall; the board is
 *  about who moved, and five says that. */
const PROGRESS_PLACES = 5

/** One cell after the name, and how it is set: words read from the left,
 *  numbers from the right, and a column a telephone does not have room for. */
type Cell = { text: string; words?: boolean; hidePhone?: boolean }

type Place = {
  /** Where the name leads. Missing where there is nothing to lead to: a member
   *  whose fee has run out has no visible profile (PDL P11), so their name
   *  stands in the board with no link on it, the same as in the tables. */
  to?: string
  /** Unique within one board, which a member number is not on the race board:
   *  the same runner can hold two of the ten best races. */
  key: string
  /** Not the row number: the numbering is done in src/data/derive.ts, where the
   *  ladder of each board is, and a board drawn here may be cut short or
   *  filtered. Until 11.08.2026 the reason was stronger, since a tie nothing
   *  separated was a shared place and a board could read 1, 1, 3 (PDL P12). */
  position: number
  /** Written out, or written to give up its surname where the card is too
   *  narrow to hold both words (`NameOrInitial`). */
  name: ReactNode
  /** Whose row this is, so it can be marked for whoever is reading it
   *  (src/components/mine.ts). Two of them on a board of pairs, and none at all
   *  on a board whose rows are not about people. */
  members: string[]
  /** Everything after the name, in the order the headings name it. Most boards
   *  have one; the board of best single races has six, because the owner asked
   *  for the whole of a result there (04.08.2026). */
  cells: Cell[]
}

type BoardData = {
  id: string
  title: string
  /** What the columns after the name are called, one for one with the cells. */
  columns: Cell[]
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

/**
 * How a cell is set.
 *
 * Words to the left and quiet, figures to the right: the shared table pushes its
 * first three columns to the left, which is right for a name and wrong for a
 * number, so both say which they are.
 *
 * The last cell of a row is the measure the board ranks by, and it wears
 * `table__points`, which is what the portal draws a figure in bold with, and in
 * gold on the row that leads (src/styles/table.css). Read off the position
 * rather than from a flag on the cell, because it is not a property of the cell:
 * it is what being last on a board means.
 *
 * A row only, which is why the headings ask for none of it. A heading is already
 * bold from the shared table and stands in no row that can lead, so the mark
 * draws nothing there; put on it, it would be a class that says the portal
 * treats this heading differently and it does not.
 *
 * A column the telephone has no room for goes, and what a telephone keeps is the
 * four the standing keeps: the place, the name, one column of its own, and the
 * measure (PDL P12).
 */
/**
 * A name that gives up its surname when the card it stands in has no room for
 * both words (owner, 05.08.2026: "umesto prezimena stavi samo inicijal sa
 * tačkom").
 *
 * Which cards those are is a question about width and not about how long a name
 * is: at 900px the board of time on course wraps "Predrag Simić" at thirteen
 * characters, while the board of kilometres beside it holds "Ksenija Vasiljević"
 * at eighteen, because the column of figures next to the name is wider on one
 * than on the other. So the card asks itself (`@container` in TopBoards.css)
 * rather than anybody counting letters.
 *
 * Both pieces are always in the markup, and only one of them is ever drawn. The
 * surname is taken off the screen rather than out of the page, so the whole name
 * is the accessible name at every width and stays the accessible name even if
 * the stylesheet never arrives; the initial is `aria-hidden`, or a reader would
 * hear the letter and then the surname it stands for.
 *
 * A copy of the surname that only the narrow card lets into the page would do
 * the same job with one rule less, and would hand the accessible name over to a
 * stylesheet: with none applied, which is how these screens are tested, the
 * surname is in the name twice.
 */
function NameOrInitial({ competitor }: { competitor: Competitor }) {
  return (
    <>
      {competitor.firstName} <span className="boards__family">{competitor.lastName}</span>
      <span className="boards__initial" aria-hidden="true">
        {`${competitor.lastName.slice(0, 1)}.`}
      </span>
    </>
  )
}

function cellClass(cell: Cell, last: boolean): string {
  return [
    cell.words === true ? 'boards__detail' : 'boards__figure',
    last ? 'table__points' : '',
    cell.hidePhone === true ? 'table__hide-phone' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function Board({ id, title, columns, places, empty }: BoardData) {
  const { t } = useI18n()
  /* Whoever is reading, so their own row is marked on every board that is a
     table (owner, 05.08.2026). Not on the charts: a bar with a face over it is
     already a picture of one person, and the owner drew that line himself. */
  const { memberNumber: mine } = useSession()
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
                {columns.map((column) => (
                  <th key={column.text} scope="col" className={cellClass(column, false)}>
                    {column.text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {places.map((place) => (
                /* Gold for the leader alone here, not for three (owner,
                   04.08.2026): "Nagrade se i dodeljuju samo najboljima." */
                <tr
                  key={place.key}
                  className={rowClass(
                    leaderClass(place.position),
                    mineIn(place.members, mine),
                  )}
                >
                  <td className="table__position">
                    {place.position}
                    {mineIn(place.members, mine) === undefined ? null : (
                      <span className="visually-hidden"> {t('rankings.myRow')}</span>
                    )}
                  </td>
                  <td>
                    {place.to === undefined ? place.name : <Link to={place.to}>{place.name}</Link>}
                  </td>
                  {/* By position, because that is what a cell is here: a row is
                      a fixed tuple in the order the headings name, and it never
                      reorders. Keyed by what it says instead, two cells of one
                      row can carry the same figure, which the ascent and the
                      descent of a race regularly do. */}
                  {place.cells.map((cell, index) => (
                    <td key={index} className={cellClass(cell, index === place.cells.length - 1)}>
                      {cell.text}
                    </td>
                  ))}
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

function Boards({
  competitors,
  results,
  seasonParam,
}: {
  competitors: Competitor[]
  results: Result[]
  seasonParam: string | null
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
      who.active ? profilePath(who, locale) : undefined
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
      columns: topByProgress(field, results, season, PROGRESS_PLACES).map((row) => ({
        competitor: row.competitor,
        value: row.points,
        /* In points as the portal writes them everywhere else, to two decimals
           (owner, 04.08.2026). They were written rounded to whole points for a
           day, and a whole point is not what a BTL point is: two people a
           quarter of a point apart both read the same number. */
        label: formatPoints(row.gain, locale),
        reading: t('topBoards.columns.gain'),
        place: t('topBoards.place', { position: row.position }),
        base: {
          value: row.previousPoints,
          label: formatPoints(row.previousPoints, locale),
          reading: t('topBoards.columns.previousSeason'),
        },
        to: profile(row.competitor),
      })),
    }

    const kilometers: Widget = {
      kind: 'table',
      id: 'kilometers',
      title: t('topBoards.kilometers'),
      columns: [{ text: t('topBoards.columns.distance') }],
      empty: noResults,
      places: topByKilometers(field, results, season, PLACES).map((row) => ({
        to: profile(row.competitor),
        key: row.competitor.memberNumber,
        position: row.position,
        name: <NameOrInitial competitor={row.competitor} />,
        members: [row.competitor.memberNumber],
        cells: [{ text: formatNumber(row.kilometers, locale, 2) }],
      })),
    }

    const onCourse: Widget = {
      kind: 'table',
      id: 'on-course',
      title: t('topBoards.onCourse'),
      columns: [{ text: t('topBoards.columns.time') }],
      empty: noResults,
      places: topByTimeOnCourse(field, results, season, PLACES).map((row) => ({
        to: profile(row.competitor),
        key: row.competitor.memberNumber,
        position: row.position,
        name: <NameOrInitial competitor={row.competitor} />,
        members: [row.competitor.memberNumber],
        cells: [{ text: formatCourseTime(row.seconds) }],
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
      columns: [{ text: t('topBoards.columns.points') }],
      places: [],
      empty: t('topBoards.pairsSoon'),
    }

    /* The whole of a result, across the whole width of the page (owner,
       04.08.2026). It carried the event and the points, which said what the board
       ranks by and nothing about the race that earned it; a reader looking at the
       ten best runs of a season wants to see what they were. */
    const bestRaces: Widget = {
      kind: 'table',
      id: 'best-races',
      title: t('topBoards.bestRaces'),
      /* Four of the eight go on a telephone, which is the rule the standing
         keeps and the reason it keeps it: everything else forces a sideways
         scroll nobody reads (PDL P12). What is left is the place, the name, the
         event and the points. */
      columns: [
        { text: t('topBoards.columns.event'), words: true },
        { text: t('rankings.columns.distance'), hidePhone: true },
        { text: t('rankings.columns.ascent'), hidePhone: true },
        { text: t('rankings.columns.descent'), hidePhone: true },
        { text: t('rankings.columns.time'), hidePhone: true },
        { text: t('rankings.columns.points') },
      ],
      empty: noResults,
      places: bestSingleRaces(field, results, season, PLACES).map((row) => ({
        to: profile(row.competitor),
        key: row.result.id,
        position: row.position,
        name: nameOf(row.competitor),
        members: [row.competitor.memberNumber],
        cells: [
          { text: row.result.eventName, words: true },
          { text: formatNumber(row.result.distanceKm, locale, 2), hidePhone: true },
          { text: formatNumber(row.result.ascentM, locale), hidePhone: true },
          { text: formatNumber(row.result.descentM, locale), hidePhone: true },
          { text: formatDuration(row.result.seconds), hidePhone: true },
          { text: formatPoints(row.result.points, locale) },
        ],
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
        {/* The shared control, as on the teams and on a profile. This screen had
            a copy of the same markup, written before the control was shared; two
            copies of one shape drift, and this is the shape the owner asked the
            others to be brought to (04.08.2026).

            `fallback` is the season this screen opens on, so the address carries
            a year only while it is not that one, which is what every other
            screen does and is the one thing that changed here. */}
        <SeasonPicker seasons={seasons} season={String(season)} fallback={String(fallback)} />
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
  const [params] = useFilterParams()
  /* Only what the boards show. The teams went off this page with the layout of
     04.08.2026, and the file of teams went with them. */
  const state = combinePair(useCompetitors(), useResults())

  return (
    <div className="boards rankings--tooled">
      <h1>{t('topBoards.title')}</h1>

      <Resource state={state}>
        {([competitors, results]) => (
          <Boards
            competitors={competitors}
            results={results}
            seasonParam={params.get('sezona')}
          />
        )}
      </Resource>
    </div>
  )
}
