import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { raceLabel } from '../../data/raceLabel'
import type { BtlEvent, League, Race, Result } from '../../data/types'
import { formatDayMonth, formatPoints } from '../../i18n/format'
import { at, first, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { aCompetitor } from '../../test/theAnswer'
import { setupUser } from '../../test/user'

/**
 * A COMPETITION THAT COUNTS SOME OF THE RACES OF A DAY, ON THE SCREENS THAT DRAW IT.
 *
 * **What this file is for, and what the files beside it cannot be.** `leagueTable.test.ts` and
 * `leagueCounting.test.ts` measure the two functions with arrangements built to part „the races
 * the record names" from „the races of the days the record names". This file measures that the
 * screens ask those functions and nobody else: the standing, the box that lists the days and the
 * races under them, and the two numbers on the row of a competition. A screen that went back to
 * working a list out of `eventIds` for itself would leave both unit files green.
 *
 * **Every other case about these screens counts a day whole**, because the generated file does:
 * its competitions name every race of every day they hold. That is what the record says when
 * nobody has chosen, and it cannot tell a screen that obeys the races from one that obeys the
 * days (`pages/details.test.tsx`, `pages/league/leagueResults.test.tsx`). So the competition is
 * served here with the races chosen, and everything else comes off the disc as it always does.
 *
 * **The decisions this is written against** (owner, 12.09.2026, `PDL.md`): „Moderacija lige:
 * uređuje. Neograničen broj događaja i trka; izbor događaja bira sve njegove trke odjednom, a sme
 * se izabrati i samo neka trka." And: „Spisak na strani propratne lige ide dvostepeno: događaj, a
 * ispod njega imenovane trke koje u ligu ulaze, da član vidi zašto mu neka trka sa tog dana nije u
 * tabeli. Ali u samoj tabeli rezultata lige kolona i dalje nosi samo datum".
 */

/** `brdska-2019`, the competition of the generated data that holds days of several races. */
const RUN = '/sr/liga/brdska-2019'
const LIST = '/sr/lige?sezona=2019'

/**
 * The three days of it this file counts, and how much of each.
 *
 * - `BTL trening trek` runs three races on one morning (244, 245, 246), and the competition counts
 *   the MIDDLE one by id and by length: not the first and not the last, so a reading that takes
 *   either end of a day is not satisfied by luck;
 * - `Šidski novogodišnji maraton` runs two (1088, 1089), and the competition counts BOTH: a day
 *   counted whole, which is the control that says a reading counting too little is caught too, and
 *   the reason there are four races counted on three days and the two numbers cannot be taken for
 *   one another;
 * - `Mrazijada` runs one (758), and it counts.
 *
 * In the order the server would list them, which is the calendar's and then the id.
 */
const THE_ONLY_ONE = 758
const BOTH_OF_TWO = [1088, 1089]
const THE_MIDDLE_OF_THREE = 245
const COUNTED = [THE_ONLY_ONE, ...BOTH_OF_TWO, THE_MIDDLE_OF_THREE]

/** The arrangement above, read off the files, because a case that silently measured nothing the
 *  day the data is generated again is the fault this file exists to stop. The events returned are
 *  the days of this competition and no others: the file holds fourteen events called „BTL trening
 *  trek", and only one of them is in it. */
function theArrangement(): { events: BtlEvent[]; races: Race[] } {
  const everyEvent: BtlEvent[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/test/mock/events.json'), 'utf-8'),
  )
  const races: Race[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/test/mock/races.json'), 'utf-8'),
  )
  const leagues: League[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/test/mock/leagues.json'), 'utf-8'),
  )
  const league = must(
    leagues.find((one) => one.slug === 'brdska-2019'),
    'takmičenje brdska-2019',
  )
  const events = everyEvent.filter((one) => league.eventIds.includes(one.id))
  const raceIdsOf = (name: string) =>
    races
      .filter((race) => events.find((one) => one.id === race.eventId)?.name === name)
      .map((race) => race.id)
      .sort((left, right) => left - right)

  expect(raceIdsOf('BTL trening trek')).toEqual([244, 245, 246])
  expect(raceIdsOf('Šidski novogodišnji maraton')).toEqual(BOTH_OF_TWO)
  expect(raceIdsOf('Mrazijada')).toEqual([THE_ONLY_ONE])

  return { events, races }
}

const ran = (id: number, memberNumber: string, raceId: number, points: number): Result => ({
  id,
  memberNumber,
  raceId,
  raceName: 'Trka',
  eventName: 'Događaj',
  eventSlug: 'dogadjaj',
  date: '2019-01-27',
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  seconds: 3000,
  points,
  category: 'short',
})

/**
 * Who ran what, and every number in it is chosen so that a wrong reading gives a different one.
 *
 * - `000001` ran the counted race of `BTL trening trek` and both of the others: 10 is the answer,
 *   and 10 + 7 is 17, 10 + 3 is 13 and 10 + 7 + 3 is 20, none of them the 10. At `Šidski` both
 *   races count, so the cell is the two added, 11 (owner, 07.09.2026: „onda ce dole u njegovu
 *   celiju biti upisan zbir bodova sa obe trke"). The total is 21.
 * - `000002` ran only races the competition does not count, both of them on a day it does: nobody
 *   who read days would leave them out of the table, and they are not in it.
 * - `000003` ran one counted race and nothing else, which is the member no reading can get wrong.
 */
const RAN: Result[] = [
  ran(1, '000001', 245, 10),
  ran(2, '000001', 244, 7),
  ran(3, '000001', 246, 3),
  ran(4, '000001', 1088, 5),
  ran(5, '000001', 1089, 6),
  ran(6, '000002', 244, 50),
  ran(7, '000002', 246, 60),
  ran(8, '000003', 245, 8),
]

const JSON_HEADERS = { 'content-type': 'application/json' }

/** The competition, served with its races chosen and with the days named as the file wrote them. */
let stopServing: (() => void) | null = null

function servedCountingFour(): void {
  const leagues: League[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/test/mock/leagues.json'), 'utf-8'),
  )

  stopServing = serverThat((asked) => {
    /* The address without what was asked of it, which none of these three sends today. */
    const path = asked.replace(/\?.*$/, '')

    if (path === '/api/leagues') {
      /* **Only the races change.** `eventIds` is left as the file wrote it, eleven days with races
         on ten of them, so the two fields of the record disagree the way a hand-written file makes
         them disagree and every reading by days gives a different answer from the right one. */
      return new Response(
        JSON.stringify(
          leagues.map((one) => (one.slug === 'brdska-2019' ? { ...one, raceIds: COUNTED } : one)),
        ),
        { status: 200, headers: JSON_HEADERS },
      )
    }

    if (path === '/api/competitors') {
      return new Response(
        JSON.stringify(
          [
            ['000001', 'Prvić'],
            ['000002', 'Drugić'],
            ['000003', 'Trećić'],
          ].map(([memberNumber, lastName]) => ({
            ...aCompetitor,
            memberNumber,
            firstName: 'Takmičar',
            lastName,
            photo: null,
            crop: null,
          })),
        ),
        { status: 200, headers: JSON_HEADERS },
      )
    }

    if (path === '/api/results') {
      return new Response(JSON.stringify(RAN), { status: 200, headers: JSON_HEADERS })
    }

    return null
  }).stop
}

/** Put back after every case, whatever became of the one before it (`leagueResults.test.tsx` says
 *  why a `finally` inside the case is the wrong place for it). */
afterEach(() => {
  stopServing?.()
  stopServing = null
})

const placings = (table: ReturnType<typeof within>): HTMLElement[] =>
  table
    .getAllByRole('row')
    .filter(
      (row: HTMLElement) =>
        within(row).queryAllByRole('rowheader').length > 0 &&
        within(row).queryAllByRole('cell').length > 0,
    )

describe('the standing of a competition that counts some of the races of a day', () => {
  it('adds up only the races it counts, and has no row for somebody who ran none of them', async () => {
    theArrangement()
    servedCountingFour()

    renderAt(RUN)

    const table = within(await screen.findByRole('table', { name: 'Poredak takmičenja' }))
    const rows = placings(table)

    /* Two people: `000002` ran two races of a day it counts and not one race it counts, and is not
       here. */
    expect(rows).toHaveLength(2)
    expect(within(first(rows)).getByRole('rowheader')).toHaveTextContent('Prvić')
    expect(within(at(rows, 1)).getByRole('rowheader')).toHaveTextContent('Trećić')
    expect(table.queryByText(/Drugić/)).toBeNull()

    /* The total and then one cell per day, in the order the columns stand: an empty cell for the
       day somebody did not run, and the sum of the races counted for the day somebody did. */
    expect(within(first(rows)).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      formatPoints(21, 'sr'),
      '',
      formatPoints(11, 'sr'),
      formatPoints(10, 'sr'),
    ])
    expect(within(at(rows, 1)).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      formatPoints(8, 'sr'),
      '',
      '',
      formatPoints(8, 'sr'),
    ])
  }, SLOW)

  it('has a column for each day with a counted race, headed by the day and told by the event', async () => {
    const { events } = theArrangement()
    const named = ['Mrazijada', 'Šidski novogodišnji maraton', 'BTL trening trek'].map((name) =>
      must(
        events.find((one) => one.name === name),
        `događaj ${name}`,
      ),
    )

    servedCountingFour()

    renderAt(RUN)

    const heads = (
      await within(await screen.findByRole('table', { name: 'Poredak takmičenja' })).findAllByRole(
        'columnheader',
      )
    ).slice(2)

    /* The whole list and not „has these three": the file names eleven days and ten of them have
       races, so a column per day the record names is a standing seven columns wider. The head of a
       column is the day and nothing else (owner, 12.09.2026: „kolona i dalje nosi samo datum"), and
       what the pointer is told over it is its event. */
    expect(heads.map((head) => head.textContent)).toEqual(
      named.map((one) => formatDayMonth(one.date)),
    )
    expect(heads.map((head) => within(head).getByRole('link').getAttribute('title'))).toEqual(
      named.map((one) => one.name),
    )
  }, SLOW)
})

describe('the list of competitions, for a competition that counts some of the races of a day', () => {
  it('lists under a day only the races it counts, and counts days and people by them', async () => {
    const { races } = theArrangement()
    const raceOf = (id: number) => must(races.find((one) => one.id === id), `trka ${String(id)}`)

    servedCountingFour()

    const user = setupUser()

    renderAt(LIST)

    const box = must(
      (await screen.findByRole('heading', { level: 2, name: /Brdska liga 2019/ })).closest('li'),
      'the box of the competition',
    )

    await user.click(within(box).getByRole('button', { name: /Događaji i trke/ }))

    const days = await within(box).findAllByRole('heading', { level: 4 })

    /* Three days, in the order the season is run in, and none of the eight others the record names. */
    expect(days.map((day) => day.textContent)).toEqual([
      'Mrazijada',
      'Šidski novogodišnji maraton',
      'BTL trening trek',
    ])

    /* **Under each of them exactly the races the competition counts, named exactly.** One race
       under the day of three, both under the day of two, and the only one under the third: a list
       of all the races of each day is the box this replaced, and a list of one race per day is
       its opposite. */
    const underEach = (name: string) => {
      const item = must(
        within(box).getByRole('heading', { level: 4, name }).closest('li'),
        `the item of ${name}`,
      )

      return within(item)
        .getAllByRole('listitem')
        .map((one) => one.textContent)
    }
    const named = (ids: number[]) =>
      ids.map(raceOf).map((one, _index, among) => raceLabel(one, among, 'sr'))

    expect(underEach('BTL trening trek')).toEqual(named([THE_MIDDLE_OF_THREE]))
    expect(underEach('Šidski novogodišnji maraton')).toEqual(named(BOTH_OF_TWO))
    expect(underEach('Mrazijada')).toEqual(named([THE_ONLY_ONE]))

    /* **The two numbers on the row, from the same races.** Three days and not the eleven the record
       names, the ten of them with races, nor the four races; and two people and not three:
       `000002` is the one a reading by days would count and the one the table does not have.
       Waited on a shorter clock than the case, because the case's own clock is the same twenty
       seconds `waitFor` is given and a real difference would then report as a bare timeout
       (`pages/publicScreens.test.tsx` measured that). */
    expect(box.textContent).toContain('Događaja: 3')
    await waitFor(
      () => {
        expect(box.textContent).toContain('Učesnika: 2')
      },
      { timeout: SLOW / 4 },
    )
  }, SLOW)
})
