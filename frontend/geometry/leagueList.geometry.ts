import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, SLACK, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE LIST OF COMPETITIONS IS ONE BOX ACROSS THE WHOLE PAGE AT EVERY WIDTH, ONE BELOW THE OTHER
 * (owner, 07.09.2026: „Lige treba da imaju boksove koji su širine cele strane, a ne polovine, tako
 * da bi primera radi sada tri lige stale u 3 reda").
 *
 * **Asked of Chrome, because a stylesheet read as text cannot answer it.** `styles/leagueLayout.test.ts`
 * holds the sentence by the absence of the names of the properties that lay a track of columns, and
 * review measured that it knows three ways to put two boxes in a row and not the fourth: `display: flex;
 * flex-wrap: wrap` with `flex: 0 0 calc(50% - …)` on the box, or `max-width: 50%` on the box, brings back
 * two columns with that file green. A list of ways to break something is never finished, so the
 * question is asked as a closed one: **how wide is each box next to how wide its list is, and does any
 * box stand beside another.**
 *
 * Three widths, 360, 768 and 1280, and 1280 at 200% text, because the media queries of the sheet are
 * cut in `em` and the text size moves them.
 */

/** A day the sample's competitions are all drawn on. */
test.use({ theDay: '2027-03-01' })

const SAMPLE: Record<string, unknown>[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/test/mock/leagues.json', import.meta.url)), 'utf-8'),
)

/* The sample three times over, so the page is longer than the window at every width: a desktop is
   measured with its scrollbar (`playwright.config.ts`), and a page that fits has none. */
const LEAGUES = [0, 1, 2].flatMap((copy) =>
  SAMPLE.map((one) => ({ ...one, id: Number(one.id) + copy * 100, slug: `${String(one.slug)}-${String(copy)}` })),
)

const ANSWERS: Answers = { '/api/leagues': LEAGUES }

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
]

for (const at of WIDTHS) {
  test(`every competition is a box across its whole list and none stands beside another, ${label(at)}`, async ({
    open,
  }) => {
    const { page, probe } = await open(at, '/sr/lige', '.leagues__list', ANSWERS)

    const seen = await page.evaluate(() => {
      const list = document.querySelector('.leagues__list')

      if (list === null) {
        return null
      }

      const box = (one: Element) => {
        const found = one.getBoundingClientRect()

        return { left: found.left, right: found.right, top: found.top, bottom: found.bottom }
      }
      const inside = list.getBoundingClientRect()

      return {
        list: { left: inside.left, right: inside.right },
        items: [...list.querySelectorAll(':scope > .leagues__item')].map(box),
      }
    })

    if (seen === null) {
      throw notMeasured('the screen drew no list of competitions')
    }

    expect(seen.items.length, 'the sample has more than one competition, or "beside" asks nothing').toBeGreaterThanOrEqual(2)

    for (const [index, item] of seen.items.entries()) {
      expect(item.left, `box ${index + 1} starts where its list starts`).toBeCloseTo(seen.list.left, 0)
      expect(
        Math.abs(item.right - seen.list.right),
        `box ${index + 1} ends where its list ends`,
      ).toBeLessThanOrEqual(SLACK)
    }

    /* And none beside another: each box begins below the end of the one before it. */
    for (const [index, item] of seen.items.entries()) {
      const before = seen.items[index - 1]

      if (before !== undefined) {
        expect(item.top, `box ${index + 1} stands below box ${index}, not beside it`).toBeGreaterThanOrEqual(
          before.bottom - SLACK,
        )
      }
    }

    expect(probe.sideways).toBe(0)
  })
}
