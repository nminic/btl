import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE FILTER OF THE RACES ON A PROFILE IS THE ONE ON THE FRONT PAGE, AND STANDS IN ONE ROW (owner,
 * 21.11.2026, PDL: „Filter trka na profilu je isti kao na naslovnoj, na svim širinama").
 *
 * Asked of Chrome at 360, 768 and 1280, at the browser's own text and at 200%:
 *
 * <ol>
 * <li><b>Six buttons in one row</b> (`.seg`), every one at the same height, at the browser's own text. At
 * 200% the row may break, but then no two buttons overlap.
 * <li><b>Nothing runs off the row or the page</b>, and the page does not move sideways (PDL P24, WCAG 2.2 SC
 * 1.4.10).
 * <li><b>The long name takes no room</b>: it is in the reading only (`visually-hidden`).
 * </ol>
 *
 * <p><b>Relations, never pixels.</b>
 */

const MOCK = new URL('../src/test/mock/', import.meta.url)
const file = (name: string): unknown => JSON.parse(readFileSync(new URL(name, MOCK), 'utf-8'))

/** A man with a long list of results, scored and unscored. */
const PAGE = '/sr/takmicar/000002'

const ANSWERS: Answers = {
  '/api/competitors': file('competitors.json'),
  '/api/teams': file('teams.json'),
  '/api/pairs': [],
  '/api/results': file('results.json'),
  '/api/unscored-results': file('unscored-results.json'),
  '/api/ducats': file('ducats.json'),
  '/api/frozen-seasons': [{ season: 2027 }],
  '/api/me/applications': {
    teamApplications: [],
    teamInvitations: [],
    teamProposals: [],
    pairInvites: [],
    alreadyInATeam: false,
    seasonToPayFor: null,
  },
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 360, text: 200 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
]

for (const at of WIDTHS) {
  test(`the races filter of a profile stands in one row of six and inside the page, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, `${PAGE}?sezona=sve`, '#profile-results', ANSWERS)

    const seen = await page.evaluate(() => {
      const group = document.querySelector('.profile__results .seg')

      if (group === null) {
        return null
      }

      const box = (one: Element) => {
        const rect = one.getBoundingClientRect()

        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height }
      }

      return {
        viewport: document.documentElement.clientWidth,
        group: box(group),
        buttons: [...group.querySelectorAll('.seg__b')].map((one) => ({
          ...box(one),
          text: (one.textContent ?? '').trim(),
          hidden: (() => {
            const rest = one.querySelector('.visually-hidden')

            return rest === null ? 0 : Math.round(rest.getBoundingClientRect().width)
          })(),
        })),
      }
    })

    if (seen === null) {
      throw notMeasured('the profile drew no `.seg` filter in its races')
    }

    expect(seen.buttons, 'six buttons').toHaveLength(6)

    for (const one of seen.buttons) {
      expect(one.left, `„${one.text}" starts left of the row`).toBeGreaterThanOrEqual(seen.group.left - SLACK)
      expect(one.right, `„${one.text}" runs off the row`).toBeLessThanOrEqual(seen.group.right + SLACK)
      expect(one.right, `„${one.text}" runs off the page`).toBeLessThanOrEqual(seen.viewport + SLACK)
      expect(one.hidden, `the long name of „${one.text}" must not take room`).toBeLessThanOrEqual(1)
    }

    if (at.text === 100) {
      const tops = seen.buttons.map((one) => one.top)
      const heights = seen.buttons.map((one) => one.height)

      expect(Math.max(...tops) - Math.min(...tops), 'one row at the ordinary text size').toBeLessThanOrEqual(SLACK)
      expect(Math.max(...heights) - Math.min(...heights), 'one height for all six').toBeLessThanOrEqual(SLACK)
    } else {
      for (const [index, one] of seen.buttons.entries()) {
        for (const other of seen.buttons.slice(index + 1)) {
          const overlaps =
            one.left < other.right - SLACK &&
            other.left < one.right - SLACK &&
            one.top < other.bottom - SLACK &&
            other.top < one.bottom - SLACK

          expect(overlaps, `„${one.text}" and „${other.text}" overlap`).toBe(false)
        }
      }
    }

    expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
    expect(probe.sideways, 'the page scrolls sideways').toBe(0)
  })
}
