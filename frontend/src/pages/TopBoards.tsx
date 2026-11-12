import { useProfileLink } from './profile/useProfileLink'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useFilterParams } from '../app/useFilterParams'
import { useToday } from '../clock/useClock'
import { ColumnChart, type ChartColumn } from '../components/ColumnChart'
import { Resource } from '../components/Resource'
import { SeasonPicker } from '../components/SeasonPicker'
import { offeredSeason, WARM_UP_ADDRESS } from '../components/season'
import { seasonShown, WARM_UP, warmUpShown, type SeasonView } from '../data/season'
import {
  bestSingleRaces,
  seasonsOnOffer,
  topByCategory,
  topByKilometers,
  topByProgress,
  topByTimeOnCourse,
  topPairs,
  pairsNow,
} from '../data/derive'
import type { PairRow, Placed, ProgressRow, TallyRow, TotalsRow } from '../data/derive'
import { pointsAtTheFreeze, type FrozenBoard, type FrozenPerson, type FrozenTables } from '../data/frozen'
import type { Competitor, RaceCategory, RacingPair, Result } from '../data/types'
import { combineFour, useCompetitors, useFrozenSeasons, usePairs, useResults } from '../data/useResource'
import { useFrozenTables } from '../data/useFrozenTables'
import { useFrozenPeople, type FrozenOne } from './frozen/frozenPeople'
import { formatCourseTime, formatDuration, formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { leaderClass } from '../components/podium'
import { mineIn, rowClass } from '../components/mine'
import { NamePlate, OverTwoLines } from '../components/NamePlate'
import { useSession } from '../session/useSession'
import './Rankings.css'
import './TopBoards.css'

/* The Top liste: the lists the rulebook counts out in the article „Top liste", which stand
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
 * the lists the article „Top liste" counts out, and the standing on that page is worked out
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

/* And five on the board of pairs, on which the owner rested the whole shape (PDL, 07.09.2026):
   „Kod parova stoje dve slicice jedna ispod druge, a u nivou svake ime i prezime jedno ispod
   drugog. **Ima mesta jer se prikazuje pet parova, ne deset.**" A row of a pair is four lines
   tall, so ten of them would be a box twice the height of the two beside it. */
const PAIR_PLACES = 5

/** One cell after the name, and how it is set: words read from the left,
 *  numbers from the right, and a column a telephone does not have room for. */
type Cell = {
  text: string
  /** A second line under the first, in the same cell. One board has one: the pairs carry the races
   *  they share under the points they scored on them (owner, 04.08.2026). */
  under?: string
  words?: boolean
  hidePhone?: boolean
}

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
  /** Written the way the board writes a name: over two lines on the three boards the owner asked
   *  to look like the standing of a competition, on one line on the board of best single races,
   *  which he grouped with the tables (07.09.2026). */
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
/* **The surname is no longer given up on a narrow card, and the whole mechanism is gone**
 * (owner, 07.09.2026). It was written on 05.08.2026 („umesto prezimena stavi samo inicijal sa
 * tačkom") because the name and the figure shared one line and a long surname wrapped. The owner
 * then asked for these boards to look like the standing of a competition, „ime, prezime" one under
 * the other, and a surname with a line of its own has room: measured at 360, where the card is
 * 328px, „Milovanović" fits whole. So the container query, the two spans and the initial went with
 * it, and `@container` no longer appears anywhere in the portal.
 */
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
                      {cell.under === undefined ? null : (
                        <span className="boards__under">{cell.under}</span>
                      )}
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

/** Where a frozen row's name leads and what keys it (`frozen/frozenPeople.ts`); a live row has none. */
type Frozen = { frozen?: { to: string | undefined; key: string } }

/** A best single race as a board draws it: the one race and nothing else of the result. */
type BestRace = {
  competitor: Competitor
  result: Pick<Result, 'id' | 'raceName' | 'distanceKm' | 'ascentM' | 'descentM' | 'seconds' | 'points'>
}

/**
 * WHAT EVERY BOARD OF A SEASON IS DRAWN FROM: the ladders of `derive.ts` over the results for a season read
 * live, the places the freeze wrote for a frozen one (`frozenSources`). One shape for both, so the boards are
 * drawn by one piece of markup and the two can never be laid out differently.
 */
type Sources = {
  byLength: (category: RaceCategory) => (Placed<TallyRow> & Frozen)[]
  progress: (Placed<ProgressRow> & Frozen)[]
  kilometers: (Placed<TallyRow> & Frozen)[]
  onCourse: (Placed<TotalsRow> & Frozen)[]
  pairs: (Placed<PairRow> & Frozen)[]
  bestRaces: (Placed<BestRace> & Frozen)[]
}

function liveSources(
  field: Competitor[],
  results: Result[],
  pairs: RacingPair[],
  season: SeasonView,
  frozenBefore: Map<string, number> | undefined,
): Sources {
  return {
    byLength: (category) => topByCategory(field, results, season, category, PLACES),
    progress: topByProgress(field, results, season, PROGRESS_PLACES, frozenBefore),
    kilometers: topByKilometers(field, results, season, PLACES),
    onCourse: topByTimeOnCourse(field, results, season, PLACES),
    pairs: topPairs(pairs, field, results, season, PAIR_PLACES),
    bestRaces: bestSingleRaces(field, results, season, PLACES),
  }
}

/**
 * THE BOARDS OF A FROZEN SEASON, as the freeze wrote them (PDL, 31.07.2026, „Zamrznuta sezona je
 * materijalizovan zapis, ne izračun"): every place of every list is the place written down, cut where the
 * board cuts the live one. Only the gain on the list of progress is read as the difference of the two
 * numbers its row holds, the season and the season before, because that is what the bar draws.
 */
function frozenSources(tables: FrozenTables, people: (one: FrozenPerson) => FrozenOne): Sources {
  const list = (board: string, length: string | null, places: number) =>
    tables.boards
      .filter((one) => one.board === board && one.length === length)
      .sort((left, right) => left.position - right.position)
      .slice(0, places)
  const placed = (one: FrozenBoard) => {
    const who = people(one)

    return {
      competitor: who.competitor,
      races: one.races,
      kilometers: one.kilometers,
      ascent: one.ascent,
      descent: one.descent,
      seconds: one.seconds,
      points: one.points,
      reachedOn: '',
      position: one.position,
      frozen: { to: who.to, key: `place-${one.position}` },
    }
  }

  return {
    byLength: (category) => list('byLength', category, PLACES).map(placed),
    progress: list('progress', null, PROGRESS_PLACES).map((one) => ({
      ...placed(one),
      previousPoints: Number(one.previousPoints),
      gain: one.points - Number(one.previousPoints),
    })),
    kilometers: list('kilometers', null, PLACES).map(placed),
    onCourse: list('timeOnCourse', null, PLACES).map(placed),
    pairs: [...tables.pairs]
      .sort((left, right) => left.position - right.position)
      .slice(0, PAIR_PLACES)
      .map((one) => {
        const first = people(one.halves[0])
        const second = people(one.halves[1])

        return {
          pair: {
            id: -one.position,
            season: tables.season,
            memberNumbers: [first.competitor.memberNumber, second.competitor.memberNumber],
          },
          competitors: [first.competitor, second.competitor],
          races: one.races,
          kilometers: one.kilometers,
          ascent: one.ascent,
          descent: one.descent,
          seconds: one.seconds,
          points: one.points,
          position: one.position,
          frozen: { to: undefined, key: `pair-${one.position}` },
        }
      }),
    bestRaces: list('bestRace', null, PLACES).map((one) => {
      const who = people(one)

      return {
        competitor: who.competitor,
        result: {
          id: -one.position,
          raceName: String(one.raceName),
          distanceKm: one.kilometers,
          ascentM: one.ascent,
          descentM: one.descent,
          seconds: one.seconds,
          points: one.points,
        },
        position: one.position,
        frozen: { to: who.to, key: `race-${one.position}` },
      }
    }),
  }
}

/** What the control at the top of the page is handed: the seasons, the value it shows and the one it
 *  opens on, as the address writes them, and whether the warm-up is one of the values. */
type Picker = { seasons: number[]; value: string; fallback: string; warmUp: boolean }

function Boards({
  competitors,
  results,
  pairs,
  frozenSeasons,
  seasonParam,
}: {
  competitors: Competitor[]
  results: Result[]
  pairs: RacingPair[]
  /** The seasons the freeze has written down (`/api/frozen-seasons`): the boards of one of them are its snapshot. */
  frozenSeasons: number[]
  seasonParam: string | null
}) {
  const today = useToday()
  /* The running season, and before the league has one its first, empty or not; and
     nothing before it on offer (owner, 16.10.2026 and 10.10.2026; `seasonShown`,
     `seasonsOnOffer`). Held against the offer, as on the table, so an address naming
     2019 shows this season under a control that says so. */
  const seasons = useMemo(() => seasonsOnOffer(results, today), [results, today])
  /* AND BEFORE THE FIRST SEASON HAS BEGUN, THE WARM-UP, WHICH IS WHAT THE PAGE OPENS ON (owner, 12.11.2026:
     „default predsezonsku sezonu na Top Listama", „zove Zagrevanje"; `warmUpShown`). From 1 January 2027
     it is no value of the control at all, so an address naming it falls back to the season shown, the way
     an address naming 2019 does. */
  const warmUp = warmUpShown(today)
  const fallback = warmUp ? WARM_UP_ADDRESS : String(seasonShown(today))
  const value = offeredSeason(seasonParam ?? '', seasons, fallback)
  const picker = { seasons, value, fallback, warmUp }

  if (value === WARM_UP_ADDRESS) {
    return <LiveBoards competitors={competitors} results={results} pairs={pairs} picker={picker} view={WARM_UP} frozenBefore={undefined} />
  }

  const season = Number(value)

  /* WHICH SEASON IS FROZEN IS THE RECORD'S AND NEVER THE CLOCK'S (PDL, derived 10.10.2026, „za čitanje
     zamrznutosti odlučuje zapis o činu, ne sat"). */
  if (frozenSeasons.includes(season)) {
    return <FrozenBoards competitors={competitors} picker={picker} season={season} />
  }

  /* And the season before frozen: the list of progress measures against what it held at its freeze. */
  if (frozenSeasons.includes(season - 1)) {
    return <LiveAfterAFrozenSeason competitors={competitors} results={results} pairs={pairs} picker={picker} season={season} />
  }

  return <LiveBoards competitors={competitors} results={results} pairs={pairs} picker={picker} view={season} frozenBefore={undefined} />
}

function FrozenBoards({ competitors, picker, season }: { competitors: Competitor[]; picker: Picker; season: number }) {
  const state = useFrozenTables(season)
  const people = useFrozenPeople(competitors, season)

  return (
    <Resource state={state}>
      {(tables) => <Drawn picker={picker} view={season} sources={frozenSources(tables, people)} />}
    </Resource>
  )
}

function LiveAfterAFrozenSeason({
  competitors,
  results,
  pairs,
  picker,
  season,
}: {
  competitors: Competitor[]
  results: Result[]
  pairs: RacingPair[]
  picker: Picker
  season: number
}) {
  const state = useFrozenTables(season - 1)

  return (
    <Resource state={state}>
      {(before) => (
        <LiveBoards
          competitors={competitors}
          results={results}
          pairs={pairs}
          picker={picker}
          view={season}
          frozenBefore={pointsAtTheFreeze(before)}
        />
      )}
    </Resource>
  )
}

function LiveBoards({
  competitors,
  results,
  pairs,
  picker,
  view,
  frozenBefore,
}: {
  competitors: Competitor[]
  results: Result[]
  pairs: RacingPair[]
  picker: Picker
  /** A season, or the warm-up: what every board below counts (`onTheBoardsOf` in `data/derive.ts`). */
  view: SeasonView
  frozenBefore: Map<string, number> | undefined
}) {
  /* Who the boards of this season are drawn from (PDL P11). The article „Top liste" is the
     standing of a season in several shapes, so the rule that holds for the table
     holds here.

     The list itself since 21.09.2026, for the reason `Rankings.tsx` writes out. */
  const field = competitors
  const sources = useMemo(
    () => liveSources(field, results, pairs, view, frozenBefore),
    [field, results, pairs, view, frozenBefore],
  )

  return <Drawn picker={picker} view={view} sources={sources} />
}

function Drawn({ picker, view, sources }: { picker: Picker; view: SeasonView; sources: Sources }) {
  const { locale, t } = useI18n()
  const { seasons, value, fallback, warmUp } = picker
  /* The sentences of an empty board say „in this season", which the warm-up is not, so it has its own. */
  const inWarmUp = view === WARM_UP

  /* Held steady across renders (`useProfileLink` is a `useCallback` over the reader and the
     locale), so it may sit in the list below without rebuilding the boards on every render. */
  const linkTo = useProfileLink()

  const boards = useMemo<Widget[]>(() => {
    /* A frozen row says where its name leads; a live one is asked of the reader here. */
    const profile = (row: { competitor: Competitor } & Frozen) =>
      row.frozen === undefined ? linkTo(row.competitor) : row.frozen.to
    const keyOf = (row: Frozen, live: string) => row.frozen?.key ?? live
    const noResults = t(inWarmUp ? 'topBoards.warmUpEmpty' : 'topBoards.empty')

    /* One of the five lists by length, as a chart of its own. On the front page
       these five turn one into another; here each stands still and keeps its own
       widget, which is what the owner asked for: "bez rotiranja (jer će svaki
       imati svoj prikaz)". */
    const byLength = (category: RaceCategory): Widget => ({
      kind: 'chart',
      id: category,
      title: t(`topBoards.byLength.${category}`),
      empty: noResults,
      columns: sources.byLength(category).map((column) => ({
        competitor: column.competitor,
        value: column.races,
        label: formatNumber(column.races, locale),
        place: t('topBoards.place', { position: column.position }),
        to: profile(column),
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
      empty: t(inWarmUp ? 'topBoards.warmUpProgress' : 'topBoards.progressEmpty'),
      columns: sources.progress.map((row) => ({
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
        to: profile(row),
      })),
    }

    const kilometers: Widget = {
      kind: 'table',
      id: 'kilometers',
      title: t('topBoards.kilometers'),
      columns: [{ text: t('topBoards.columns.distance') }],
      empty: noResults,
      places: sources.kilometers.map((row) => ({
        to: profile(row),
        key: keyOf(row, row.competitor.memberNumber),
        position: row.position,
        name: (
          <NamePlate competitors={[row.competitor]}>
            <OverTwoLines competitor={row.competitor} />
          </NamePlate>
        ),
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
      places: sources.onCourse.map((row) => ({
        to: profile(row),
        key: keyOf(row, row.competitor.memberNumber),
        position: row.position,
        name: (
          <NamePlate competitors={[row.competitor]}>
            <OverTwoLines competitor={row.competitor} />
          </NamePlate>
        ),
        members: [row.competitor.memberNumber],
        cells: [{ text: formatCourseTime(row.seconds) }],
      })),
    }

    /* The pairs. A pair is two members who confirmed each other (PDL P13) and it is ranked on the
       races they ran together (P12).

       **The whole of what the owner asked for, and it is four things** (04.08.2026, 07.09.2026):
       both names one under the other, whoever scored more of the pair's points on top, their points
       together to the right, and **the races they share below those points**. Two circles, one
       above the other, and four lines beside them.

       This board stood empty until 07.09.2026 and said so, because a pair is made by two members
       confirming each other and nothing in the data said who had. The owner then asked for two
       pairs to be mocked so he could see the shape; the flow that really makes one is the next
       increment. */
    const bestPairs: Widget = {
      kind: 'table',
      id: 'pairs',
      title: t('topBoards.pairs'),
      columns: [{ text: t('topBoards.columns.points') }],
      places: sources.pairs.map((row) => ({
        key: keyOf(row, String(row.pair.id)),
        position: row.position,
        /* No link on the row: a pair is two people and there is no one profile to lead to. The
           `Place` said so before there was a pair to draw. */
        name: (
          <NamePlate competitors={row.competitors}>
            {/* One element per person, so the pair's own rule lays the two of them as two rows
                and each of those holds a name over two lines: four lines in all, which is what
                the owner asked for (07.09.2026). Without the wrapper the four halves would each
                be a row of that grid and the gap would fall between a given name and its own
                surname. */}
            {row.competitors.map((one) => (
              <span key={one.memberNumber}>
                <OverTwoLines competitor={one} />
              </span>
            ))}
          </NamePlate>
        ),
        members: row.competitors.map((one) => one.memberNumber),
        cells: [
          {
            text: formatPoints(row.points, locale),
            /* Under the points and not beside them, which is where the owner put it
               (04.08.2026): „sa desne strane stoji njihov ukupan broj BTL bodova, a ispod toga
               broj zajednickih trka." */
            under: t('topBoards.sharedRaces', { count: row.races }),
          },
        ],
      })),
      empty: t(inWarmUp ? 'topBoards.warmUpPairs' : 'topBoards.pairsNone'),
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
        /* The race and not the event it belonged to, as everywhere else a result
           is listed (owner, 23.08.2026, extended to this board 24.08.2026: „treba
           da bude naziv trke onda"). This board was not in the list when that was
           decided, so it went on naming the event, and an event with nine races on
           one day printed nine rows of the same text. */
        { text: t('topBoards.columns.race'), words: true },
        { text: t('rankings.columns.distance'), hidePhone: true },
        { text: t('rankings.columns.ascent'), hidePhone: true },
        { text: t('rankings.columns.descent'), hidePhone: true },
        { text: t('rankings.columns.time'), hidePhone: true },
        { text: t('rankings.columns.points') },
      ],
      empty: noResults,
      places: sources.bestRaces.map((row) => ({
        to: profile(row),
        key: keyOf(row, String(row.result.id)),
        position: row.position,
        name: <NamePlate competitors={[row.competitor]}>{nameOf(row.competitor)}</NamePlate>,
        members: [row.competitor.memberNumber],
        cells: [
          { text: row.result.raceName, words: true },
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
      bestPairs,
      bestRaces,
    ]
  }, [sources, locale, t, linkTo, inWarmUp])

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
        <SeasonPicker seasons={seasons} season={value} fallback={fallback} warmUp={warmUp} />
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
  const { pairsMade, pairsBroken } = useSession()
  const [params] = useFilterParams()
  /* Only what the boards show. The teams went off this page with the layout of
     04.08.2026, and the file of teams went with them. */
  const state = combineFour(useCompetitors(), useResults(), usePairs(), useFrozenSeasons())

  return (
    <div className="boards rankings--tooled">
      <h1>{t('topBoards.title')}</h1>

      <Resource state={state}>
        {([competitors, results, fromFile, frozen]) => (
          <Boards
            competitors={competitors}
            results={results}
            frozenSeasons={frozen.map((one) => one.season)}
            /* Through what this visit has made and broken, so a pair confirmed a moment ago is on
               the board the moment it exists, and one that was ended is off it (`pairsNow`). */
            pairs={pairsNow(fromFile, pairsMade, pairsBroken)}
            seasonParam={params.get('sezona')}
          />
        )}
      </Resource>
    </div>
  )
}
