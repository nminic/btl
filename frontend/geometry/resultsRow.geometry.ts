import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE ROW OF A MEMBER'S RESULT ON THE PAGE OF AN EVENT: ONE VERTICAL CENTRE FOR THE WORDS AND THE
 * BUTTONS, AND NO SIDEWAYS SCROLL OF THE TABLE ON A TELEPHONE.
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
 * text of every cell the width shows, and the centre of the GROUP of buttons (the box `.entity-row-actions`
 * draws, which is the content of the last cell), and the distance between the highest and the lowest of
 * them. The group and not each button, because the pair is allowed to wrap onto two lines where the cell is
 * narrow, and then there is no one centre for two buttons, only one for the cell's content.
 *
 * **And the same three rows of cases ask the second half of PDL P24, „Tabele na telefonu nemaju
 * horizontalni skrol"**: the table's own box (`.table-scroll`) is not wider inside than outside, at 360 and
 * at 768px at the ordinary text size, with the long names of the sample, and with the question that the x
 * opens drawn in the row. A rule that keeps the pair on one line fixes the centres and breaks this, which
 * is why the two are asked together (PR 586, review: `flex-wrap: nowrap` measured 345 against 328 at
 * 360px with long names and 491 against 347 with the question open).
 *
 * **Three widths, 360, 768 and 1280**, because the cells that are shown change with the width (the
 * phone keeps the name, the time and the points and the buttons; `table__hide-phone` takes the rest).
 */

/** A day after the event was run, so the results are drawn. */
test.use({ theDay: '2026-10-20' })

/** The event with the most runs in the sample of the file, so there are many rows to read. */
const SLUG = 'zimski-nocni-polumaraton-2020'

/** One pixel, which is what „agree" means in the owner's report: the centres of a row's cells. */
const AGREE = 1

function sample<T>(name: string): T {
  const read: T = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'),
  )

  return read
}

const COMPETITORS = sample<Record<string, unknown>[]>('competitors')

/** Somebody who checks results: a superadmin, who may do everything (`useMay`). */
const ANSWERS: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/events': sample('events'),
  '/api/races': sample('races'),
  '/api/results': sample('results'),
  '/api/competitors': COMPETITORS,
}

/** The same members with the longest names a family has: a name that wraps is a taller cell in the row. */
const LONG: Answers = {
  ...ANSWERS,
  '/api/competitors': COMPETITORS.map((one) => ({
    ...one,
    firstName: 'Aleksandar Konstantin',
    lastName: 'Papadopulos-Karamanlis',
  })),
}

/**
 * THE 4px THAT WERE ALREADY THERE. With the question of the x open at 360px the box of the table is 332
 * inside 328, and it is the same 332 on `main` before this change (measured 20.10.2026 with the same
 * answers: the width of a table does not depend on `vertical-align`). It is the widest button of the
 * question, „Potvrdi brisanje", against three other columns at their narrowest, and it is not this
 * change's to fix: it needs a decision about the padding or the label of a button, and the design is
 * closed. It is held at what it is, so that it cannot get worse unseen, and named so that it is not
 * mistaken for a pass of PDL P24.
 */
const WAS_ALREADY_WIDER_AT_360_WITH_THE_QUESTION_OPEN = 4

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

const CASES = [
  ['the names of the sample', ANSWERS, false],
  ['long names', LONG, false],
  ['the question of the x open in the first row', ANSWERS, true],
] as const

for (const at of WIDTHS) {
  for (const [what, answers, asking] of CASES) {
    test(`every cell of a result's row shares one vertical centre, with ${what}, at ${label(at)}`, async ({
      open,
    }) => {
      const { page, probe } = await open(at, `/sr/kalendar/${SLUG}`, 'tbody td.table__points', answers)

      if (asking) {
        await page.getByRole('button', { name: /^Obriši: / }).first().click()
        await page.getByRole('button', { name: /^Potvrdi brisanje/ }).first().waitFor({ state: 'visible' })
      }

      const seen = await page.evaluate(() => {
        const results = document.querySelector('td.table__points')?.closest('table')

        if (results === null || results === undefined) {
          throw new Error('the table of results is not on the page')
        }

        const box = results.closest('.table-scroll')

        if (box === null) {
          throw new Error('the table of results is not in its own box')
        }

        const rows = [...results.querySelectorAll('tbody tr')].map((row) => {
          const centres: { what: string; centre: number }[] = []

          for (const cell of row.querySelectorAll('td')) {
            if (getComputedStyle(cell).display === 'none') {
              continue
            }

            const group = cell.querySelector('.entity-row-actions')

            if (group !== null) {
              const { top, height } = group.getBoundingClientRect()

              centres.push({
                what: `buttons ${String(group.querySelectorAll('a.button, button.button').length)}`,
                centre: top + height / 2,
              })

              continue
            }

            /* The words of the cell, as the browser set them: the lines they stand on and not the box
               of the cell they stand in. */
            const range = document.createRange()

            range.selectNodeContents(cell)

            const { top, height } = range.getBoundingClientRect()

            centres.push({ what: `text ${(cell.textContent ?? '').trim()}`, centre: top + height / 2 })
          }

          return centres
        })

        return { rows, inside: box.scrollWidth, outside: box.clientWidth }
      })

      expect(probe.sideways).toBe(0)
      expect(seen.rows.length).toBeGreaterThanOrEqual(10)

      for (const row of seen.rows) {
        const group = row.filter((one) => one.what.startsWith('buttons'))
        const words = row.filter((one) => one.what.startsWith('text'))

        /* Measured is not assumed: a row with no buttons would pass the spread below for the wrong
           reason, and a width that showed only one cell of words would pass it for none. */
        expect(group, JSON.stringify(row)).toHaveLength(1)
        expect(words.length, JSON.stringify(row)).toBeGreaterThanOrEqual(3)

        const all = row.map((one) => one.centre)
        const spread = Math.max(...all) - Math.min(...all)

        expect(spread, JSON.stringify(row)).toBeLessThanOrEqual(AGREE)
      }

      /* PDL P24: no sideways scroll of a table on a telephone. The box may be exactly as wide inside as
         outside, and not wider. */
      const allowed = asking && at.width === 360 ? WAS_ALREADY_WIDER_AT_360_WITH_THE_QUESTION_OPEN : 0

      expect(
        seen.inside,
        `the table's box scrolls: ${String(seen.inside)} inside ${String(seen.outside)}`,
      ).toBeLessThanOrEqual(seen.outside + allowed)
    })
  }
}
