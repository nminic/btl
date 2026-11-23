import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE THREE SCREENS THAT SCROLLED SIDEWAYS WITH THE LETTERS AT 200% DO NOT (owner's PENDING, 22.11.2026, „Zatečeno
 * uz PR 797"; WCAG 2.2 SC 1.4.10 Reflow and SC 1.4.4 Resize text, ADL A7; CLAUDE.md „bez horizontalnog skrola").
 *
 * PENDING named a cause for each; the measurement here named others for two of the three, and the guard is held
 * to what was measured (23.11.2026, both days of the suite, before the change):
 *
 * - **The front page, 320px, 10px.** Not the podium (`.stand`): hiding it left all ten pixels. It is the address
 *   of the president (`.home .address`), whose paragraph holds „poluprofesionalnih", 235px at the letters at 200%,
 *   in a column of 190px.
 * - **The sheet of the leagues, 320px 74px, 360px 34px.** The day of an event (`.leagues__event-when`, kept on one
 *   line beside the state), and under it, hidden by it, two more that the day was covering: the word of the state
 *   of a tile (`PREDSTOJI`, wider than the tile) and the head of the sheet, where the mark of 104px left 58px for a
 *   name whose first line is 150px.
 * - **The results of an event, 360px 70px, 320px 110px, and only for the administration.** The table is in
 *   `.table-scroll` and is not the cause: it is clipped by its own frame. The cause is above and under it, the mark
 *   of the event (`.comments__mark`, stars, figure and count on one line) and the overall mark of every comment
 *   (`.comments__overall`), both nowrap flex rows wider than their card.
 *
 * **Each screen is read by one case per width and the cases cover every cause alone**, so a cause put back is a case
 * that fails by name; the results page is asked as the administration, because a visitor does not see the part that
 * was wide.
 */

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

const VISITOR: Answers = everyAnswer()
const ADMINISTRATION: Answers = { ...VISITOR, '/api/me': { role: 'superadmin', account: 41, membershipBasis: null } }

const SCREENS = [
  { name: 'the front page', path: '/sr', ready: 'main .scoreboard', answers: VISITOR },
  { name: 'the sheet of the leagues', path: '/sr/lige?sezona=2027', ready: '.leagues__event-tile', answers: VISITOR },
  { name: 'the sheet of the leagues, as the administration', path: '/sr/lige?sezona=2027', ready: '.leagues__event-tile', answers: ADMINISTRATION },
  { name: 'the results of an event, as the administration', path: '/sr/kalendar/fruskogorski-maraton-2010', ready: 'tbody td.table__points', answers: ADMINISTRATION },
] as const

const LARGE: At[] = [
  { width: 320, text: 200 },
  { width: 360, text: 200 },
  { width: 390, text: 200 },
]

for (const screen of SCREENS) {
  for (const at of LARGE) {
    test(`${screen.name} scrolls no sideways, ${label(at)}`, async ({ open }) => {
      const { page, probe } = await open(at, screen.path, screen.ready, screen.answers)

      /* What is wider than the window, to say where it is: the drawing behind the page and the table in its frame
         are left out, the first is the window's own and the second is clipped by the frame it stands in. */
      const wide = await page.evaluate(() => {
        const window = document.documentElement.clientWidth

        return [...document.querySelectorAll('body *')]
          .filter(
            (one) =>
              !(one instanceof SVGElement) &&
              one.closest('.table-scroll') === null &&
              one.getBoundingClientRect().right > window + 0.5,
          )
          .slice(0, 6)
          .map((one) => `${one.tagName.toLowerCase()}.${one.className.toString()}`)
      })

      expect(probe.sideways, `scrolls sideways; wider than the window: ${wide.join(' | ')}`).toBe(0)
      expect(probe.widened, 'made the window wider than it was asked').toBe(0)
    })
  }
}
