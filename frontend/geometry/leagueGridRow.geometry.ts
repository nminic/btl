import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * EVERY CELL OF A ROW OF THE STANDING OF A COMPETITION STANDS ON ONE VERTICAL CENTRE, AND THE TABLE STILL
 * DOES NOT MOVE THE PAGE SIDEWAYS (PDL P24).
 *
 * Owner, 16.11.2026, after the same repair on the top boards: „Da, ispravi". `styles/table.css` puts every
 * cell of every table at the TOP of its row, on purpose, which is right while no cell is taller than a
 * line of words. A row of this grid holds a circle with two lines of words beside it (`OverTwoLines`), so
 * the row is as tall as the name and the total and the points of every race stood at the top of it.
 * `pages/league/League.css` now centres the cells of the body of this table.
 *
 * **Asked in Chrome and not in jsdom**, which lays nothing out: for every row, the vertical centre of the
 * words of every cell, the name in the sticky first column among them, and the distance between the
 * highest and the lowest. **The names are the shortest the sample has and the cells hold one short figure,
 * so nothing breaks into a second line at 360px** (measured: at 360 the first column keeps the circle and
 * two lines, the figures keep one). Where a long text breaks into as many lines as the row is tall, a
 * cell at the top stands on the middle anyway and the width cannot see it (the review of the top boards
 * measured that for the race name there), so the case is built that the telephone sees it too.
 *
 * **Three widths, 360, 768 and 1280.**
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers (`/api/results/runners` from `results/runners.json`). */
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

const TABLES: { leagues: Record<string, unknown>[] } = JSON.parse(
  readFileSync(join(MOCK, 'frozen-tables.json'), 'utf-8'),
)
const COMPETITORS: Record<string, unknown>[] = JSON.parse(readFileSync(join(MOCK, 'competitors.json'), 'utf-8'))
const SOME_MEN = COMPETITORS.filter((one) => one.gender === 'M').slice(0, 8)
/* Twenty rows, so the page is longer than the window and a desktop is measured with its scrollbar
   (`playwright.config.ts`); the same members stand in it more than once, which the grid keys by place. */
const MEN = Array.from({ length: 20 }, (_, index) => SOME_MEN[index % SOME_MEN.length] ?? {})
const LEAGUE = TABLES.leagues[0] ?? {}

/**
 * The frozen league of the sample with twenty rows standing in it and three races as columns, so the grid
 * is wider than the box at 360px and scrolls inside it. Every cell holds a short figure.
 */
const ANSWERS: Answers = {
  ...everyAnswer(),
  '/api/frozen-tables/2027': {
    ...TABLES,
    leagues: [
      {
        ...LEAGUE,
        columns: [1, 2, 3].map((one) => ({
          eventSlug: null,
          date: `2027-0${String(one + 4)}-08`,
          name: `Trka ${String(one)}`,
        })),
        standings: MEN.map((one, index) => ({
          gender: 'M',
          position: index + 1,
          memberNumber: one.memberNumber,
          who: `${String(one.firstName)} ${String(one.lastName)}`,
          points: 90 - index,
          cells: [1, 2, 3].map((column) => ({ column, points: 30 - index })),
        })),
      },
    ],
  },
}

/**
 * The same members with the longest names a family has, as `resultsRow.geometry.ts` does: the name of this
 * grid breaks over as many lines as it needs, so the row is tall at 360px as well, where the names of the
 * sample leave it only seven pixels taller than a line of figures (measured 16.11.2026: a row of 50px with
 * a figure of 21px, and a cell at the top is then 2,5px from the middle, under what the guard can tell).
 * Without this case the telephone would pass a stylesheet that put every cell back at the top.
 */
const LONG: Answers = {
  ...ANSWERS,
  '/api/competitors': COMPETITORS.map((one) => ({
    ...one,
    firstName: 'Aleksandar Konstantin',
    lastName: 'Papadopulos-Karamanlis',
  })),
}

/**
 * Two pixels, as on the top boards (`topBoardsRow.geometry.ts`): the box the browser reports for a range
 * of two lines of two sizes is not the middle of the lines. Before the repair the same rows read about as
 * far apart as the name is taller than a line.
 */
const AGREE = 2

const WIDTHS: At[] = [360, 768, 1280].map((width): At => ({ width, text: 100 }))

for (const at of WIDTHS) {
  for (const [what, answers] of [
    ['the names of the sample', ANSWERS],
    ['long names', LONG],
  ] as const) {
    test(`every cell of a row of the standing of a competition shares one vertical centre, with ${what}, at ${label(at)}`, async ({
      open,
    }) => {
    const { page, probe } = await open(at, '/sr/liga/runtrace-2027', '.league__grid tbody tr', answers)

    const seen = await page.evaluate(() => {
      const table = document.querySelector('.league__grid')
      const box = table?.closest('.table-scroll')

      if (table === null || table === undefined || box === null || box === undefined) {
        throw new Error('the standing of the competition is not in its own box')
      }

      const rows = [...table.querySelectorAll('tbody tr')].map((row) =>
        [...row.querySelectorAll('th, td')].map((cell) => {
          /* The words of the cell as the browser set them: the lines they stand on and not the box of the
             cell they stand in; in the cell of the name that includes the circle beside them. */
          const range = document.createRange()

          range.selectNodeContents(cell)

          const { top, height } = range.getBoundingClientRect()

          return { what: (cell.textContent ?? '').trim(), centre: top + height / 2 }
        }),
      )

      return { rows, inside: box.scrollWidth, outside: box.clientWidth }
    })

    expect(probe.sideways).toBe(0)

    /* Measured is not assumed: twenty rows of the name, the total and three races, or the loop below would
       pass over nothing. */
    expect(seen.rows.length).toBe(20)

    for (const row of seen.rows) {
      expect(row.length, JSON.stringify(row)).toBe(5)

      const all = row.map((cell) => cell.centre)
      const spread = Math.max(...all) - Math.min(...all)

      expect(spread, JSON.stringify(row)).toBeLessThanOrEqual(AGREE)
    }

    /* PDL P24: no sideways scroll of the page; the box may scroll inside itself (three races are wider
       than a telephone), so what is asked of it is only that the page does not move, above. */
    expect(seen.inside).toBeGreaterThan(0)
    expect(seen.outside).toBeGreaterThan(0)
    })
  }
}
