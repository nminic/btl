import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { label, notMeasured, SLACK, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE ENGLISH NAME OF THE ROOKIE CATEGORY, `M Rookies` AND `F Rookies`, FITS WHERE IT IS DRAWN AT EVERY WIDTH
 * (owner, 13.11.2026, PDL „Početnička kategorija": „duže od „M R” u uskim kolonama na telefonu, pa se meri na 360 px").
 *
 * **What it can break, and what is asked.** The category cell of a table is held on one line
 * (`styles/table.css`, `.table__category`), which costs the column its width and nothing else, and a name
 * that is six characters longer than `M R` takes six characters of width from the cells beside it. So the
 * question is the closed one: **does the page grow sideways, does the name leave the box of its own cell,
 * and does the name break across two lines.** The first is what a reader sees as a sideways scroll, the
 * other two are what he sees as a name cut off or torn in two.
 *
 * Three widths, 360, 768 and 1280, and the sheet is asked in English because that is the only language the
 * name is longer in (`category.rookieMale` and `category.rookieFemale` of `i18n/en.json`).
 */

test.use({ theDay: '2027-03-01' })

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers (`goldBand.geometry.ts` reads it the same way). */
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

const MODEL = sample<Record<string, unknown>>('/api/competitors')[0]
const RESULT = sample<Record<string, unknown>>('/api/results')[0]

if (MODEL === undefined || RESULT === undefined) {
  throw notMeasured('the sample has no competitor or no result to build a table from')
}

/* Ten women and ten men, every one of them in the rookie category of the season the table is read in. */
const ROOKIES = ['M', 'F'].flatMap((gender, which) =>
  Array.from({ length: 10 }, (_ignored, index) => ({
    ...MODEL,
    memberNumber: String(which * 10 + index + 1).padStart(6, '0'),
    firstName: 'Takmičar',
    lastName: `Broj ${String(which * 10 + index + 1)}`,
    gender,
    active: true,
    category: { season: 2027, ageBand: '25-39', beginner: true },
    categories: [{ season: 2027, ageBand: '25-39', beginner: true }],
  })),
)

const ANSWERS: Answers = {
  ...SAMPLE,
  '/api/frozen-seasons': [],
  '/api/competitors': ROOKIES,
  '/api/results': ROOKIES.map((one, index) => ({
    ...RESULT,
    id: `res-${String(index + 1)}`,
    memberNumber: one.memberNumber,
    points: ROOKIES.length - index,
    inItsSeason: true,
    inItsStanding: true,
  })),
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

/** What one gender's table draws: the category cells and the buttons that filter by category, and how wide the page is. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const box = (one: Element) => {
      const found = one.getBoundingClientRect()
      /* The lines of the TEXT, not the height of the box: a cell is as tall as its row, and a row is
         as tall as the name beside it. One rectangle per line the words are drawn on. */
      const words = document.createRange()

      words.selectNodeContents(one)

      const lines = new Set([...words.getClientRects()].map((rect) => Math.round(rect.top))).size

      return { text: (one.textContent ?? '').trim(), left: found.left, right: found.right, lines }
    }

    return {
      cells: [...document.querySelectorAll('.table__category')].map(box),
      buttons: [...document.querySelectorAll('.rankings__category')].map(box),
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }
  })
}

for (const at of WIDTHS) {
  test(`the English name of the rookie category fits where it is drawn, on one line, without a sideways scroll, ${label(at)}`, async ({
    open,
  }) => {
    const { page } = await open(at, '/en/tabela', '.table__category', ANSWERS)

    for (const [gender, name, tab] of [
      ['men', /^M Rookies$/, 'Men'],
      ['women', /^F Rookies$/, 'Women'],
    ] as const) {
      if (gender === 'women') {
        await page.getByRole('button', { name: tab, exact: true }).click()
        await page.waitForFunction(
          () => [...document.querySelectorAll('.table__category')].some((one) => /^F Rookies$/.test(one.textContent ?? '')),
          undefined,
          { timeout: 15_000 },
        )
      }

      const seen = await measure(page)
      const cells = seen.cells.filter((one) => name.test(one.text))
      const buttons = seen.buttons.filter((one) => name.test(one.text))

      if (cells.length < 5) {
        throw notMeasured(`the ${gender}'s table drew ${String(cells.length)} cells with the name of their rookie category`)
      }

      if (buttons.length !== 1) {
        throw notMeasured(`the ${gender}'s table drew ${String(buttons.length)} filter buttons with the name of their rookie category`)
      }

      expect(seen.scroll, `the page of the ${gender} grows sideways`).toBeLessThanOrEqual(seen.viewport + SLACK)

      for (const one of [...cells, ...buttons]) {
        expect(one.left, `${one.text} starts inside the window`).toBeGreaterThanOrEqual(-SLACK)
        expect(one.right, `${one.text} stays inside the window`).toBeLessThanOrEqual(seen.viewport + SLACK)
        expect(one.lines, `${one.text} is drawn on one line`).toBe(1)
      }
    }
  })
}
