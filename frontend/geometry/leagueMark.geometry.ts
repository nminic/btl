import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, SLACK, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE MARK OF A LEAGUE IN ITS THREE PLACES, AS CHROME DRAWS IT (owner, PDL 23.11.2026, „Pravi logo lige”:
 * „gde se vidi: kartica lige na strani „Lige”, glava lista izabrane lige i strana pojedinačne lige”, and
 * „oblik: krug ... prikazuje se u krugu; bez loga ostaje krug sa inicijalima”).
 *
 * **Asked of Chrome, because a stylesheet read as text cannot answer it**: whether the picture fills its
 * circle and stays inside it is the box's answer, and whether the circle stands in the row of the name on the
 * page of a league is the heading's. The sample gives RunTrace a mark and Planinska none, so both states are
 * measured side by side on the cards, where they must be the same circle.
 *
 * The pictures of the sample are not served by the built portal (`data/mockNotServed.test.ts`), so what is
 * measured is the box a picture is drawn into, which is what the shape is; a broken picture keeps its box.
 */
test.use({ theDay: '2027-03-01' })

function sample(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'))
}

const SERVED: Answers = {
  '/api/leagues': sample('leagues'),
  '/api/events': sample('events'),
  '/api/races': sample('races'),
  '/api/results': sample('results'),
  '/api/competitors': sample('competitors'),
}

type Seen = {
  mark: { left: number; right: number; top: number; bottom: number }
  radius: string
  picture: { left: number; right: number; top: number; bottom: number } | null
  inner: { width: number; height: number }
  letters: { scroll: number; client: number }
}

/** Every mark the selector finds, each with its picture's box where it carries one. */
async function marks(page: import('@playwright/test').Page, selector: string): Promise<Seen[]> {
  return page.evaluate((within) => {
    const box = (one: Element) => {
      const found = one.getBoundingClientRect()

      return { left: found.left, right: found.right, top: found.top, bottom: found.bottom }
    }

    return [...document.querySelectorAll(`${within} .leagues__mark`)].map((mark) => {
      const picture = mark.querySelector('img')
      const style = getComputedStyle(mark)

      return {
        mark: box(mark),
        radius: style.borderTopLeftRadius,
        picture: picture === null ? null : box(picture),
        inner: { width: mark.clientWidth, height: mark.clientHeight },
        letters: { scroll: mark.scrollWidth, client: mark.clientWidth },
      }
    })
  }, selector)
}

/** A circle: as wide as it is high, rounded to half of that, the picture filling its inside and staying in it. */
function isACircle(one: Seen, what: string): void {
  const width = one.mark.right - one.mark.left
  const height = one.mark.bottom - one.mark.top

  expect(Math.abs(width - height), `${what} is not as wide as it is high`).toBeLessThanOrEqual(SLACK)
  expect(width, `${what} has no size`).toBeGreaterThan(16)
  expect(one.radius === '50%' || Number.parseFloat(one.radius) >= width / 2 - SLACK, `${what} is not round`).toBe(true)

  if (one.picture === null) {
    expect(one.letters.scroll, `the initials of ${what} run out of their circle`).toBeLessThanOrEqual(one.letters.client)

    return
  }

  expect(one.picture.left, `the picture of ${what} starts outside it`).toBeGreaterThanOrEqual(one.mark.left - SLACK)
  expect(one.picture.right, `the picture of ${what} ends outside it`).toBeLessThanOrEqual(one.mark.right + SLACK)
  expect(one.picture.top).toBeGreaterThanOrEqual(one.mark.top - SLACK)
  expect(one.picture.bottom).toBeLessThanOrEqual(one.mark.bottom + SLACK)
  expect(one.picture.right - one.picture.left, `the picture of ${what} does not fill its circle`).toBeGreaterThanOrEqual(
    one.inner.width - SLACK,
  )
  expect(one.picture.bottom - one.picture.top).toBeGreaterThanOrEqual(one.inner.height - SLACK)
}

const WIDTHS = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
] satisfies At[]

for (const at of WIDTHS) {
  test(`the cards and the head of the sheet carry their circles, a mark and the initials alike, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr/lige?sezona=2027', '.leagues__tile .leagues__mark', SERVED)
    const cards = await marks(page, '.leagues__tile')
    const head = await marks(page, '.leagues__score')

    if (cards.length !== 2 || head.length !== 1) {
      throw notMeasured(`the page drew ${cards.length} marks on the cards and ${head.length} in the head, not two and one`)
    }

    const [withAMark, withNone] = cards

    if (withAMark === undefined || withNone === undefined || withAMark.picture === null || withNone.picture !== null) {
      throw notMeasured('the first card does not carry the mark of the sample, or the second carries one')
    }

    isACircle(withAMark, 'the mark on the first card')
    isACircle(withNone, 'the initials on the second card')
    isACircle(head[0] ?? withNone, 'the mark in the head of the sheet')

    /* One circle for the two states, so a card with a mark does not stand taller than a card without. */
    expect(withAMark.mark.right - withAMark.mark.left).toBeCloseTo(withNone.mark.right - withNone.mark.left, 1)
    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)
  })

  for (const [slug, carries] of [
    ['runtrace-2027', true],
    ['brdska-2019', false],
  ] as const) {
    test(`the heading of the page of ${slug} stands on its circle, in the row of the name, ${label(at)}`, async ({ open }) => {
      const { page, probe } = await open({ ...at, height: 400 }, `/sr/liga/${slug}`, 'h1 .leagues__mark', SERVED)
      const [mark] = await marks(page, 'h1')
      const name = await page.evaluate(() => {
        const heading = document.querySelector('h1')
        const text = heading === null ? null : [...heading.childNodes].find((one) => one.nodeType === Node.TEXT_NODE)

        if (text === undefined || text === null) {
          return null
        }

        const range = document.createRange()

        range.selectNodeContents(text)

        const found = range.getClientRects()[0]

        return found === undefined ? null : { left: found.left, top: found.top, bottom: found.bottom }
      })

      if (mark === undefined || name === null || (mark.picture !== null) !== carries) {
        throw notMeasured('the heading drew no mark, no name, or a mark of the other state')
      }

      isACircle(mark, `the mark in the heading of ${slug}`)

      /* Before the name, and centred on its first line: the circle and the line share their middle. */
      expect(mark.mark.right, 'the mark does not stand before the name').toBeLessThanOrEqual(name.left + SLACK)
      expect(mark.mark.top, 'the mark and the first line of the name are not one row').toBeLessThan(name.bottom)
      expect(mark.mark.bottom).toBeGreaterThan(name.top)
      expect(probe.sideways).toBe(0)
      expect(probe.widened).toBe(0)
    })
  }
}
