import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE LIST OF MEMBERS OF A TEAM'S PANEL OPENS WHOLE, AND NEITHER THE TABLE NOR THE PAGE GAINS A SCROLL BAR FOR IT (owner,
 * 23.11.2026, PDL „Izbor člana u panelu „Članovi" tima": „Em se ne vidi lista clanova u dropdown, em se pojavljuje
 * scroll bar. Nema potrebe uopšte da dropdown bude ovoliko širok, može da bude mnogo uži. Na telefonu može jedan
 * red dropdown, a drugi dugme, ali na kompu sve ovo može mnogo uže i bez scrollbara."; ADL A63).
 *
 * <p>The panel of a team stands in a row of a table inside `.table-scroll`, which clips (`overflow-x: auto` makes the
 * vertical overflow clip too). A list that is `absolute` inside its box was cut to the height of the row, and the
 * table grew a scroll bar beside it. Asked of Chrome, **with the list open**, on a telephone, a tablet and a desktop, in
 * both themes, and **in the two places the list was cut**: a table with ONE team, and the LAST row of a table with
 * several. What is held:
 *
 * - the list is whole in the window (`top >= 0`, `bottom <= the window`, inside it sideways);
 * - **nothing clips it**: the element at the middle of each row it shows is that row
 *   (`elementFromPoint`), which no clipping ancestor lets pass, whatever its overflow says;
 * - neither the table's frame nor the page has a scroll bar the open list caused (`scrollHeight`, `scrollWidth`);
 * - **on a desktop and a tablet the box is narrow and the button stands at its side**: the box is not wider than the
 *   longest name it offers needs (no row of the list is cut with an ellipsis), the button starts where the box ends
 *   (a gap of the portal's, not a column), on the same line; **on a telephone the box is one line and the button is
 *   under it**.
 *
 * <p><b>The mutations that fell it:</b> the list `position: absolute` again (what `MemberChoice.css` had: the rows
 * are no longer the element at their point, in the table of one team), and the box without `fitted`
 * (`.member-choice--fitted`: the box takes the whole row and the button stands at the far end of it).
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers (the shape `memberChoice.geometry.ts` reads it in). */
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
const ADMINISTRATION: Answers = { ...SAMPLE, '/api/me': { role: 'superadmin', account: 41, membershipBasis: null } }

const teams = SAMPLE['/api/teams']

if (!Array.isArray(teams) || teams.length < 2) {
  throw notMeasured('the sample carries fewer than two teams, so there is no last row')
}

/** A table with one team only: the row the panel opens in is the whole table. */
const ONE_TEAM: Answers = { ...ADMINISTRATION, '/api/teams': [teams[0]] }

const SIZES: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100, height: 600 },
]

const AT: At[] = SIZES.flatMap((one) => (['light', 'dark'] as const).map((theme): At => ({ ...one, theme })))

for (const [which, answers, pick] of [
  ['the table of one team', ONE_TEAM, 'first'],
  ['the last row of a table', ADMINISTRATION, 'last'],
] as const) {
  for (const at of AT) {
    test(`the list of members of a team opens whole and no scroll bar comes of it, ${which}, ${label(at)}`, async ({
      open,
    }) => {
      const { page } = await open(at, '/sr/administracija/timovi', '.entity-open', answers)

      const openers = page.locator('.entity-open[aria-controls$="-members"]')
      const opener = pick === 'first' ? openers.first() : openers.last()
      const rowId = await opener.getAttribute('aria-controls')
      const team = /^team-(\d+)-members$/.exec(rowId ?? '')?.[1]

      if (team === undefined) {
        throw notMeasured('the button that opens the panel names no team')
      }

      await opener.click()

      const box = page.locator(`#team-${team}-member`)
      /* What the table scrolls sideways by itself, with the panel open and the list shut: a wide table scrolls inside
         its own frame on a telephone, by design (`styles/table.css`), and what is asked is what the LIST adds. */
      const frameWideBefore = await box.evaluate((one) => {
        const frame = one.closest('.table-scroll')

        return frame === null ? Number.NaN : frame.scrollWidth - frame.clientWidth
      })

      /* From the first character the box offers every member whose label holds it, and every label holds a nought. */
      await box.fill('0')
      await page.locator(`#team-${team}-member-list`).waitFor({ state: 'visible' })
      /* What a reader does where the box is near the foot of the window: scrolls to the list. The page has to be
         long enough to let him, which is what a list that is part of the document gives (`MemberChoice.tsx`). */
      await page.locator(`#team-${team}-member-list`).evaluate((list) => list.scrollIntoView({ block: 'nearest' }))

      const seen = await page.evaluate((id) => {
        const list = document.getElementById(`${id}-list`)
        const input = document.getElementById(id)
        const button = input?.closest('.leagues__adding')?.querySelector('button.button')
        const frame = input?.closest('.table-scroll')

        if (list === null || input === null || button === null || button === undefined || frame === null || frame === undefined) {
          return null
        }

        const rows = [...list.children]
        const middle = (row: Element) => {
          const found = row.getBoundingClientRect()
          const point = document.elementFromPoint(found.left + found.width / 2, found.top + found.height / 2)

          return point !== null && row.contains(point)
        }
        const inside = list.getBoundingClientRect()
        const field = input.getBoundingClientRect()
        const next = button.getBoundingClientRect()
        /* The rows the list shows without being scrolled inside itself: it scrolls inside itself past twenty rem, on
           purpose, and a row it keeps out of sight is not one that something covers. */
        const shown = rows.filter((row) => row.getBoundingClientRect().bottom <= inside.bottom + 0.5)

        return {
          rows: rows.length,
          top: inside.top,
          bottom: inside.bottom,
          left: inside.left,
          right: inside.right,
          window: window.innerHeight,
          across: document.documentElement.clientWidth,
          shown: shown.length,
          unreached: shown.filter((row) => !middle(row)).length,
          frameTall: frame.scrollHeight - frame.clientHeight,
          frameWide: frame.scrollWidth - frame.clientWidth,
          pageWide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          cut: rows.filter((one) => one.scrollWidth - one.clientWidth > 0.5).length,
          cutBy: Math.max(0, ...rows.map((one) => one.scrollWidth - one.clientWidth)),
          field: { left: field.left, right: field.right, top: field.top, bottom: field.bottom },
          button: { left: next.left, top: next.top, bottom: next.bottom },
          cell: input.closest('td')?.getBoundingClientRect().width ?? Number.NaN,
        }
      }, `team-${team}-member`)

      if (seen === null) {
        throw notMeasured('the panel, its list or its button was not drawn')
      }

      expect(seen.rows, 'the list offers the members of no team').toBeGreaterThan(1)
      expect(seen.top, 'the list starts inside the window').toBeGreaterThanOrEqual(-SLACK)
      expect(seen.bottom, 'the list ends inside the window').toBeLessThanOrEqual(seen.window + SLACK)
      expect(seen.left, 'the list starts inside the page').toBeGreaterThanOrEqual(-SLACK)
      expect(seen.right, 'the list ends inside the page').toBeLessThanOrEqual(seen.across + SLACK)
      expect(seen.shown, 'the list shows no more than a row or two').toBeGreaterThan(2)
      expect(seen.unreached, 'rows of the list that something covers or cuts').toBe(0)
      expect(seen.frameTall, 'the table gained a vertical scroll bar').toBeLessThanOrEqual(1)
      expect(seen.frameWide, 'the list made the table scroll sideways further').toBeLessThanOrEqual(frameWideBefore + 1)
      expect(seen.pageWide, 'the page scrolls sideways').toBeLessThanOrEqual(0)

      if (at.width >= 768) {
        /* A desktop and a tablet: the box is as wide as its longest name and no wider, and the button is at its side. */
        expect(seen.cut, `a name is cut with an ellipsis (by ${String(seen.cutBy)}px), the box is narrower than the longest`).toBe(0)
        expect(seen.field.right - seen.field.left, 'the box takes the whole row').toBeLessThan(seen.cell * 0.6)
        expect(seen.button.left, 'the button starts before the box ends').toBeGreaterThanOrEqual(seen.field.right - SLACK)
        expect(seen.button.left - seen.field.right, 'the button is not at the side of the box').toBeLessThanOrEqual(40)
        expect(seen.button.top, 'the button is under the box, not beside it').toBeLessThan(seen.field.bottom)
      } else {
        /* A telephone: the box in one row and the button in the next. */
        expect(seen.button.top, 'the button is not under the box').toBeGreaterThanOrEqual(seen.field.bottom - SLACK)
      }
    })
  }
}
