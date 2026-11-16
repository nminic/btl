import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * EVERY CELL OF A ROW OF THE TOP BOARDS STANDS ON ONE VERTICAL CENTRE, THE RACE AND THE NAME AMONG THEM,
 * AND THE BOARD STILL DOES NOT SCROLL SIDEWAYS ON A TELEPHONE (PDL P24).
 *
 * Owner, 16.11.2026, with a screenshot of „Najbolji pojedinačni rezultati" (dark theme, desktop): „Zasto
 * se ovde raspada vertikalni alignment?" The place, the circle and the name stood on the middle of the
 * row, the figures a little lower, and the name of the race at the top of its cell.
 *
 * **The cause**: `styles/table.css` puts every cell of every table at the TOP of its row, on purpose
 * („a table is read across, and reading across needs a shared baseline"), which is right while no cell
 * is taller than a line of words. A row of the top boards holds a circle of about 35px beside the name
 * (`components/NamePlate.css`), so the row is as tall as the circle and every other cell stood at the
 * top of it. `pages/TopBoards.css` now centres the cells of this table the way `pages/Rankings.css`
 * does for the main standing and `pages/Profile.css` for the results of a member.
 *
 * **Asked in Chrome and not in jsdom**, which lays nothing out: for every row of every table the page
 * draws, the vertical centre of the words (or of the lines of words) of every cell the width shows, and
 * the distance between the highest and the lowest of them. The page of a frozen season is read, whose
 * best races are ten rows with two lengths of race name, so the race stands on one line in some rows and
 * on two at 360px in others.
 *
 * **Three widths, 360, 768 and 1280, in both themes.**
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

const TABLES: { boards: Record<string, unknown>[] } = JSON.parse(
  readFileSync(join(MOCK, 'frozen-tables.json'), 'utf-8'),
)
const COMPETITORS: Record<string, unknown>[] = JSON.parse(readFileSync(join(MOCK, 'competitors.json'), 'utf-8'))
const TEN = COMPETITORS.slice(0, 10)
const BEST_RACE = TABLES.boards.find((one) => one.board === 'bestRace') ?? {}

/**
 * The frozen season of the sample, with the ten best races it has one of: ten members of the sample, the
 * short name of a race on the even places and a long one on the odd (`Zimski noćni polumaraton Fruška
 * gora`), which wraps at 360px and not at 1280px.
 */
const ANSWERS: Answers = {
  ...everyAnswer(),
  '/api/frozen-tables/2027': {
    ...TABLES,
    boards: [
      ...TABLES.boards.filter((one) => one.board !== 'bestRace'),
      ...TEN.map((one, index) => ({
        ...BEST_RACE,
        position: index + 1,
        memberNumber: one.memberNumber,
        who: `${String(one.firstName)} ${String(one.lastName)}`,
        raceName: index % 2 === 0 ? 'Beogradski maraton' : 'Zimski noćni polumaraton Fruška gora',
      })),
    ],
  },
}

/**
 * Two pixels, which is what „agree" means for the words of a row. Not one, as on the row of a result
 * (`resultsRow.geometry.ts`), and the number is measured: the pairs board draws a second line of smaller
 * words (`.boards__under`) under the figure, and the box the browser reports for a range of two lines of
 * two sizes is not the middle of the lines, so a row that is exactly centred reads 1,4px apart there
 * (measured 16.11.2026, at all three widths). Before the repair the same rows read 5 to 8px apart.
 */
const AGREE = 2

const WIDTHS: At[] = [360, 768, 1280].flatMap((width): At[] => [
  { width, text: 100, theme: 'light' },
  { width, text: 100, theme: 'dark' },
])

for (const at of WIDTHS) {
  test(`every cell of a row of the top boards shares one vertical centre, at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(
      at,
      '/sr/top-liste?sezona=2027',
      '.boards__board--best-races tbody tr',
      ANSWERS,
    )

    const seen = await page.evaluate(() => {
      const tables = [...document.querySelectorAll('.boards table')].map((table) => {
        const box = table.closest('.table-scroll')

        if (box === null) {
          throw new Error('a table of the top boards is not in its own box')
        }

        const rows = [...table.querySelectorAll('tbody tr')].map((row) => {
          const centres: { what: string; centre: number }[] = []

          for (const cell of row.querySelectorAll('td')) {
            if (getComputedStyle(cell).display === 'none') {
              continue
            }

            /* The words of the cell as the browser set them, the lines they stand on and not the box of
               the cell they stand in; in the cell of the name that includes the circle beside them. */
            const range = document.createRange()

            range.selectNodeContents(cell)

            const { top, height } = range.getBoundingClientRect()

            centres.push({ what: (cell.textContent ?? '').trim(), centre: top + height / 2 })
          }

          return centres
        })

        return {
          board: table.closest('.boards__board')?.className ?? '',
          rows,
          inside: box.scrollWidth,
          outside: box.clientWidth,
        }
      })

      return tables
    })

    expect(probe.sideways).toBe(0)

    const races = seen.find((one) => one.board.includes('boards__board--best-races'))

    /* Measured is not assumed: ten rows of the best races, and the standing of other boards besides, or
       the loops below would pass over nothing. */
    expect(races?.rows.length).toBe(10)
    expect(seen.length).toBeGreaterThanOrEqual(2)

    for (const one of seen) {
      for (const row of one.rows) {
        /* The place, the name and the points at the least, which is what a telephone keeps. */
        expect(row.length, JSON.stringify(row)).toBeGreaterThanOrEqual(3)

        const all = row.map((cell) => cell.centre)
        const spread = Math.max(...all) - Math.min(...all)

        expect(spread, `${one.board}: ${JSON.stringify(row)}`).toBeLessThanOrEqual(AGREE)
      }

      /* PDL P24: no sideways scroll of a table on a telephone. */
      expect(
        one.inside,
        `${one.board}: the table's box scrolls: ${String(one.inside)} inside ${String(one.outside)}`,
      ).toBeLessThanOrEqual(one.outside)
    }
  })
}
