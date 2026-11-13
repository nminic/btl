import { configure, getConfig, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import resultsFile from '../test/mock/results.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'

/* Two decisions of the owner of 13.11.2026 about the Top lists in the league's first season, and only in it:

   - the board of best progress, empty all through 2027, says „Napredak takmičara se meri tek od sezone 2028."
     (chosen: „Samo 2027, posle stara"), and from 2028 the sentence it had before;
   - „I samo prve sezone, dok se ne proširi visina boksa za najbolji napredak, koristi u obračunu ukupno 3 para
     umesto 5": three pairs on the board in 2027, five from 2028, and five in the warm-up, which is no season.

   **The postavka keeps the two seasons and the warm-up apart.** Five pairs are made for 2027 and five for 2028
   out of the same ten members, and every pair ran one race together in each of 2027, 2028 and 2020, so every
   view has five pairs to draw and only the number the board keeps tells them apart. */

const IN_2027 = '2027-03-01'
const IN_2028 = '2028-03-01'
const BEFORE = '2026-12-31'

const FIRST_SEASON_SENTENCE = 'Napredak takmičara se meri tek od sezone 2028.'
const LATER_SENTENCE = 'U ovoj sezoni još niko nije popravio zbir bodova iz prethodne sezone.'
const WARM_UP_SENTENCE = 'U zagrevanju se napredak ne meri.'

const HALVES: [string, string][] = [
  ['000001', '000002'],
  ['000003', '000004'],
  ['000005', '000006'],
  ['000007', '000008'],
  ['000009', '000010'],
]

const PAIRS = [2027, 2028].flatMap((season) =>
  HALVES.map((memberNumbers, index) => ({ id: season * 10 + index, season, memberNumbers })),
)

const TEMPLATE = resultsFile[0]

/** One race the two halves of a pair ran together in a year, counted by a season from 2027 on. */
function together(year: number, index: number): unknown[] {
  const counted = year >= 2027

  return must(HALVES[index], 'a pair').map((memberNumber, half) => ({
    ...TEMPLATE,
    id: 800_000 + year * 100 + index * 10 + half,
    memberNumber,
    raceId: 700_000 + year * 10 + index,
    raceName: `Zajednička ${String(year)} ${String(index)}`,
    date: `${String(year)}-05-0${String(index + 1)}`,
    points: 50 - index * 5 - half,
    inItsSeason: counted,
    inItsStanding: counted,
  }))
}

const SHARED = [2020, 2027, 2028].flatMap((year) => HALVES.flatMap((_, index) => together(year, index)))

const served = globalThis.fetch
let waits = getConfig().asyncUtilTimeout

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}

/** The history and the pairs above, and the season of 2027 frozen with five pairs written down, if asked. */
function servePairs(frozen2027 = false): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const asked = String(input)

    if (asked === '/api/pairs') {
      return json(PAIRS)
    }

    if (asked === '/api/results') {
      return json([...resultsFile, ...SHARED])
    }

    if (frozen2027 && asked === '/api/frozen-seasons') {
      return json([{ season: 2027 }])
    }

    if (frozen2027 && asked === '/api/frozen-tables/2027') {
      const file: unknown = JSON.parse(
        readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'frozen-tables.json'), 'utf-8'),
      )
      const pairs = HALVES.map((halves, index) => ({
        position: index + 1,
        points: 100 - index,
        races: 1,
        kilometers: 10,
        ascent: 0,
        descent: 0,
        seconds: 3000,
        halves: halves.map((memberNumber) => ({ memberNumber, who: memberNumber, gender: 'M' })),
      }))

      return json({ ...Object(file), pairs })
    }

    return served(input, init)
  })
}

beforeEach(() => {
  waits = getConfig().asyncUtilTimeout
  configure({ asyncUtilTimeout: SLOW / 2 })
})

afterEach(() => {
  configure({ asyncUtilTimeout: waits })
  vi.stubGlobal('fetch', served)
})

function board(name: string) {
  return within(screen.getByRole('region', { name }))
}

async function pairsOn(path: string, today: string): Promise<number> {
  renderAt(path, 'visitor', null, undefined, today)
  await screen.findByLabelText('Sezona')

  return board('Najbolji trkački parovi').getAllByRole('row').length - 1
}

describe('the board of best progress in the first season', () => {
  it('says from which season progress is measured, in 2027', async () => {
    renderAt('/sr/top-liste', 'visitor', null, undefined, IN_2027)

    await screen.findByLabelText('Sezona')
    expect(board('Najbolji napredak').getByText(FIRST_SEASON_SENTENCE)).toBeVisible()
    expect(board('Najbolji napredak').queryByText(LATER_SENTENCE)).not.toBeInTheDocument()
    expect(board('Najbolji napredak').queryByText(WARM_UP_SENTENCE)).not.toBeInTheDocument()
  }, SLOW)

  it('says what it said before, from 2028', async () => {
    renderAt('/sr/top-liste', 'visitor', null, undefined, IN_2028)

    await screen.findByLabelText('Sezona')
    expect(board('Najbolji napredak').getByText(LATER_SENTENCE)).toBeVisible()
    expect(board('Najbolji napredak').queryByText(FIRST_SEASON_SENTENCE)).not.toBeInTheDocument()
  }, SLOW)

  it('keeps its own sentence in the warm-up', async () => {
    renderAt('/sr/top-liste', 'visitor', null, undefined, BEFORE)

    await screen.findByLabelText('Sezona')
    expect(board('Najbolji napredak').getByText(WARM_UP_SENTENCE)).toBeVisible()
    expect(board('Najbolji napredak').queryByText(FIRST_SEASON_SENTENCE)).not.toBeInTheDocument()
  }, SLOW)
})

describe('the board of pairs in the first season', () => {
  it('keeps three pairs in 2027', async () => {
    servePairs()

    expect(await pairsOn('/sr/top-liste', IN_2027)).toBe(3)
  }, SLOW)

  it('keeps five from 2028', async () => {
    servePairs()

    expect(await pairsOn('/sr/top-liste', IN_2028)).toBe(5)
  }, SLOW)

  it('keeps five in the warm-up, which is no season', async () => {
    servePairs()

    expect(await pairsOn('/sr/top-liste', BEFORE)).toBe(5)
  }, SLOW)

  it('keeps three in 2027 once it is frozen, out of the five the freeze wrote down', async () => {
    servePairs(true)

    expect(await pairsOn('/sr/top-liste?sezona=2027', IN_2028)).toBe(3)
  }, SLOW)
})
