import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE ROW OF A MEMBER'S RESULT ON THE PAGE OF AN EVENT: ONE VERTICAL CENTRE FOR THE WORDS AND THE TWO
 * BUTTONS.
 *
 * Owner, 20.10.2026, with a screenshot of QA: „Red sa rezultatom člana nije centriran, ikonice su niže
 * nego vrednosti u redu". For whoever checks results the last cell of every row of „Rezultati članova"
 * holds the pencil and the x, two square buttons 2,4rem high, and every other cell holds one line of
 * text. `styles/table.css` puts every cell of every table at the TOP of its row on purpose („a table is
 * read across, and reading across needs a shared baseline"), which is right while nothing in a row is
 * taller than a line of words and wrong in this row, where the buttons are: the words stood at the top
 * and the buttons, being taller, stood lower.
 *
 * **Asked in Chrome and not in jsdom**, which lays nothing out: for each row, the vertical centre of the
 * text of every cell the width shows, and of each of the two buttons, and the distance between the
 * highest and the lowest of them. The same question the owner answered with his eyes.
 *
 * **Three widths, 360, 768 and 1280**, because the cells that are shown change with the width (the
 * phone keeps the name, the time and the points and the buttons; `table__hide-phone` takes the rest) and
 * because a cell that wraps to two lines on a phone is the case the shared „top" rule was written for.
 * No width may move the page sideways: the table scrolls inside its own `.table-scroll` or not at all.
 */

/** A day after the event was run, so the results are drawn. */
test.use({ theDay: '2026-10-20' })

/** The event with the most runs in the sample of the file, so there are many rows to read. */
const SLUG = 'zimski-nocni-polumaraton-2020'

/** One pixel, which is what „agree" means in the owner's report: the centres of a row's cells. */
const AGREE = 1

function sample(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'))
}

/** Somebody who checks results: a superadmin, who may do everything (`useMay`). */
const ANSWERS: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/events': sample('events'),
  '/api/races': sample('races'),
  '/api/results': sample('results'),
  '/api/competitors': sample('competitors'),
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

for (const at of WIDTHS) {
  test(`every cell of a result's row shares one vertical centre at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, `/sr/kalendar/${SLUG}`, 'tbody td.table__points', ANSWERS)

    const rows = await page.evaluate(() => {
      const results = document.querySelector('td.table__points')?.closest('table')

      if (results === null || results === undefined) {
        throw new Error('the table of results is not on the page')
      }

      return [...results.querySelectorAll('tbody tr')].map((row) => {
        const centres: { what: string; centre: number }[] = []

        for (const cell of row.querySelectorAll('td')) {
          if (getComputedStyle(cell).display === 'none') {
            continue
          }

          const controls = cell.querySelectorAll('a.button, button.button')

          if (controls.length > 0) {
            for (const control of controls) {
              const { top, height } = control.getBoundingClientRect()

              centres.push({ what: `button ${control.textContent ?? ''}`, centre: top + height / 2 })
            }

            continue
          }

          /* The words of the cell, as the browser set them: the line they stand on and not the box of
             the cell they stand in. */
          const range = document.createRange()

          range.selectNodeContents(cell)

          const { top, height } = range.getBoundingClientRect()

          centres.push({ what: `text ${(cell.textContent ?? '').trim()}`, centre: top + height / 2 })
        }

        return centres
      })
    })

    expect(probe.sideways).toBe(0)
    expect(rows.length).toBeGreaterThanOrEqual(10)

    for (const row of rows) {
      const buttons = row.filter((one) => one.what.startsWith('button'))
      const words = row.filter((one) => one.what.startsWith('text'))

      /* Measured is not assumed: a row with no buttons would pass the spread below for the wrong
         reason, and a width that showed only one cell of words would pass it for none. */
      expect(buttons, JSON.stringify(row)).toHaveLength(2)
      expect(words.length, JSON.stringify(row)).toBeGreaterThanOrEqual(3)

      const all = row.map((one) => one.centre)
      const spread = Math.max(...all) - Math.min(...all)

      expect(spread, JSON.stringify(row)).toBeLessThanOrEqual(AGREE)
    }
  })
}
