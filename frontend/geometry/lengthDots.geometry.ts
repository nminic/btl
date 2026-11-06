import { expect } from '@playwright/test'
import { DOTS } from '../src/data/types.ts'
import type { BtlEvent, Race } from '../src/data/types.ts'
import { SLACK, label, test } from './support/harness.ts'
import type { At } from './support/harness.ts'

/**
 * THE ROW OF LENGTH DOTS IN A TILE OF THE CALENDAR: FIVE STAY ON ONE LINE, A SIXTH WRAPS, AND THE ROW
 * NEVER STANDS WIDER THAN THE FIVE (ADL A26, 30.08.2026; ADL A33: a width is asked of the browser).
 *
 * **Why this file exists.** The ceiling of the row (`max-inline-size: var(--length-dots-row)`,
 * `pages/Calendar.css`) has no textual guard on purpose: five drafts of one were measured, each
 * passing on the fault it was written for or failing on a change with no effect (`styles/lengthDots.test.ts`).
 * ADL A33 asks for two things in its place and only the first was ever done, the number written where the
 * rule is. The second is a control in a browser. Review of that work measured that `flex-wrap: nowrap`,
 * `calc(6 * ...)` as the ceiling, and the dot rewritten to `0.7rem` **all three together** kept the whole
 * gate green.
 *
 * **A closed question, not a list of ways to break it.** A day that carries all six dots and a day that
 * carries five, read in the browser at 360, 780, 1440 and 1560px and at 100% and 200% text:
 *
 * - five dots stand on one line and fill the ceiling to the pixel (so a dot drawn smaller than the token it
 *   is counted from fails as much as a dot drawn larger);
 * - six dots stand on two lines, five and one;
 * - no row is wider than the ceiling, and none runs out of its day;
 * - the page does not move sideways at the browser's own text.
 *
 * Relations between boxes the same page drew, never pixels: the ceiling is read by asking the page how
 * wide `var(--length-dots-row)` is, so a change of the token moves both sides of every comparison.
 */

const MONTH = '2026-10'
const CALENDAR = `/sr/kalendar?mesec=${MONTH}`

const anEvent = (id: number, slug: string, name: string): BtlEvent => ({
  id,
  slug,
  name,
  date: `${MONTH}-01`,
  city: 'Novi Sad',
  country: 'RS',
  kind: 'race',
  featured: false,
  description: '',
  link: '',
  copiedFrom: null,
})

const aRace = (id: number, eventId: number, day: number, dots: Race['dots']): Race => ({
  id,
  eventId,
  name: 'Trka',
  renamed: false,
  kind: 'length',
  limitSeconds: 0,
  date: `${MONTH}-${String(day).padStart(2, '0')}`,
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  category: 'short',
  dots,
})

const SIX = anEvent(1, 'sest-tackica', 'Sest tackica')
const FIVE = anEvent(2, 'pet-tackica', 'Pet tackica')
/** Somebody to wait on: the screen is drawn when this tile is. */
const READY = `.calendar__grid a[href="/sr/kalendar/${FIVE.slug}"]`

const ANSWERS = {
  '/api/events': [SIX, FIVE],
  '/api/races': [aRace(11, 1, 7, [...DOTS]), aRace(21, 2, 8, DOTS.slice(0, 5))],
}

const AT: At[] = [
  { width: 360, text: 100 },
  { width: 780, text: 100 },
  { width: 1440, text: 100 },
  { width: 360, text: 200 },
  { width: 780, text: 200 },
  { width: 1560, text: 200 },
]

for (const at of AT) {
  test(`five dots stand on one line, a sixth wraps, and no row is wider than the five, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, CALENDAR, READY, ANSWERS)

    const seen = await page.evaluate(
      ({ six, five }) => {
        const ceiling = document.createElement('div')

        ceiling.style.cssText = 'position:absolute;visibility:hidden;height:0;width:var(--length-dots-row)'
        document.body.append(ceiling)

        const wide = ceiling.getBoundingClientRect().width

        ceiling.remove()

        const rowOf = (slug: string) => {
          const tile = document.querySelector(`.calendar__grid a[href="/sr/kalendar/${slug}"]`)
          const row = tile?.querySelector('.chip__lengths')

          if (tile === null || tile === undefined || row === null || row === undefined) {
            return null
          }

          const box = row.getBoundingClientRect()
          const day = tile.closest('.day')?.getBoundingClientRect()
          const dots = [...row.querySelectorAll('.length-dot')].map((one) => one.getBoundingClientRect())
          const lines = new Map<number, number>()

          for (const dot of dots) {
            const top = Math.round(dot.top)

            lines.set(top, (lines.get(top) ?? 0) + 1)
          }

          return {
            width: box.width,
            right: box.right,
            dayRight: day === undefined ? null : day.right,
            dots: dots.length,
            lines: [...lines.entries()].sort((left, right) => left[0] - right[0]).map(([, count]) => count),
          }
        }

        return { ceiling: wide, six: rowOf(six), five: rowOf(five) }
      },
      { six: SIX.slug, five: FIVE.slug },
    )

    expect(seen.ceiling, 'the ceiling is a width').toBeGreaterThan(0)
    expect(seen.six, 'the tile with six dots is drawn').not.toBeNull()
    expect(seen.five, 'the tile with five dots is drawn').not.toBeNull()

    const six = seen.six
    const five = seen.five

    if (six === null || five === null) {
      return
    }

    expect(six.dots, 'the tile of six draws six dots').toBe(6)
    expect(five.dots, 'the tile of five draws five dots').toBe(5)

    expect(five.lines, 'five dots stand on one line').toEqual([5])
    expect(Math.abs(five.width - seen.ceiling), 'and fill the ceiling, to the pixel').toBeLessThanOrEqual(SLACK)
    expect(six.lines, 'six dots stand on two lines, five and one').toEqual([5, 1])

    for (const row of [five, six]) {
      expect(row.width, 'no row is wider than the five dots it is allowed').toBeLessThanOrEqual(seen.ceiling + SLACK)
      expect(row.right, 'no row runs out of its day').toBeLessThanOrEqual((row.dayRight ?? Number.POSITIVE_INFINITY) + SLACK)
    }

    if (at.text === 100) {
      expect(probe.sideways, 'the page scrolls sideways').toBe(0)
    }
  })
}
