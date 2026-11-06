import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, SLACK, test } from './support/harness.ts'
import type { At } from './support/harness.ts'

/**
 * THE LINE UNDER THE NAME IN THE STANDING OF A COMPETITION IS THE LINE UNDER THE CELLS BESIDE IT
 * (owner on QA, 07.09.2026: „duplirana crta ispod imena, deluje polomljeno").
 *
 * The name is a `th` with `scope="row"`, and `.table th` is written for a column heading and draws a
 * line of two pixels. `.table tbody th` (`styles/table.css`) takes it back to one. **That is a fight
 * between two rules of the cascade, and `styles/goldBand.test.ts` reads each rule's own text and never
 * asks which one wins**: review undid it twice with the gate green, once with `!important` on
 * `.table th`, once with three lines in `pages/league/League.css` that give this very cell two pixels
 * again, and in Chrome the name was 2px with the points beside it 1px both times. jsdom cannot be
 * made to answer (it computes the cascade for some properties, and for this cell returns `1px`, but
 * it does not take a shorthand written with `var()` apart into longhands, so the mutation with
 * `!important` also reads `1px` there; ADL A33 sends that question to the browser).
 *
 * **Asked of Chrome, as the cascade computes it:** for every row of the standing, the width of the line
 * under the name and under each cell beside it, and where each of those lines ends. Closed, not a list of
 * ways to undo it: the name's line is not thicker than the line under any cell beside it, and it ends
 * on the same pixel.
 */

/** The day the standing is drawn on, one on which the season of the sample is under way. */
test.use({ theDay: '2027-03-01' })

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers. */
function everyAnswer(dir = MOCK, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(
    readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, unknown][] => {
      const at = join(dir, entry.name)

      if (entry.isDirectory()) {
        return Object.entries(everyAnswer(at, `${prefix}${entry.name}/`))
      }

      return entry.name.endsWith('.json')
        ? [[`/api/${prefix}${entry.name.slice(0, -'.json'.length)}`, JSON.parse(readFileSync(at, 'utf-8'))]]
        : []
    }),
  )
}

const SAMPLE = everyAnswer()

const sample = <T>(address: string): T[] => {
  const found = SAMPLE[address]

  if (!Array.isArray(found)) {
    throw notMeasured(`the sample has no ${address}`)
  }

  return found
}

/* The standing of a competition, the way `pages/league/leagueResults.test.tsx` makes it: twelve men, each
   with the one result of a race the competition counts, so every one of them is placed and the grid has a
   row for each. The sample's own members are not all men and not all in the competition. */
const LEAGUE = sample<{ slug: string; raceIds: number[] }>('/api/leagues').find((one) => one.slug === 'brdska-2019')
const RESULT = sample<{ raceId: number; [key: string]: unknown }>('/api/results').find((one) => LEAGUE?.raceIds.includes(one.raceId))
const MODEL = sample<Record<string, unknown>>('/api/competitors')[0]

if (LEAGUE === undefined || RESULT === undefined || MODEL === undefined) {
  throw notMeasured('the sample has no competition with a result in it')
}

const MEN = Array.from({ length: 12 }, (_ignored, index) => ({
  ...MODEL,
  memberNumber: String(index + 1).padStart(6, '0'),
  firstName: 'Takmičar',
  lastName: `Broj ${String(index + 1)}`,
  active: true,
  gender: 'M',
}))

const ANSWERS = {
  ...SAMPLE,
  '/api/frozen-seasons': [],
  '/api/competitors': MEN,
  '/api/results': MEN.map((one, index) => ({
    ...RESULT,
    id: `res-${String(index + 1)}`,
    memberNumber: one.memberNumber,
    points: MEN.length - index,
    /* What the server works out of the member's right to rank (`Result.inItsStanding`): the sample's
       first result is of a member without it, and a result outside the standing makes no row. */
    inItsSeason: true,
    inItsStanding: true,
  })),
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

for (const at of WIDTHS) {
  test(`the line under a name in the standing is the line under the cells beside it, ${label(at)}`, async ({
    open,
  }) => {
    const { page } = await open(at, '/sr/liga/brdska-2019', 'th.league__who', ANSWERS)

    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('th.league__who')].map((name) => {
        const cells = [...(name.parentElement?.children ?? [])].filter((one) => one !== name)
        const line = (one: Element) => ({
          width: Number.parseFloat(getComputedStyle(one).borderBottomWidth),
          ends: one.getBoundingClientRect().bottom,
        })

        return { name: line(name), beside: cells.map(line) }
      }),
    )

    if (rows.length < 3) {
      throw notMeasured(`the standing drew ${String(rows.length)} rows with a name in them`)
    }

    for (const [index, row] of rows.entries()) {
      expect(row.beside.length, `row ${index + 1} has cells beside its name`).toBeGreaterThan(0)

      for (const one of row.beside) {
        expect(row.name.width, `the line under the name of row ${index + 1} is not thicker than the one beside it`).toBeLessThanOrEqual(
          one.width,
        )
        expect(
          Math.abs(row.name.ends - one.ends),
          `the line under the name of row ${index + 1} ends on the same pixel as the one beside it`,
        ).toBeLessThanOrEqual(SLACK)
      }
    }
  })
}
