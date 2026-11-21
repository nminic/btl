import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At, Geometry } from './support/harness.ts'

/**
 * THE BOX OF THE BEST RACING PAIRS TAKES THREE PAIRS AND ITS FOOT STAYS LEVEL WITH THE FOOT OF THE BEST
 * PROGRESS, ON A WIDE SCREEN.
 *
 * Owner, 21.11.2026 (PDL, under „Raspored strane Top liste: dve trećine naspram jedne"): „Na širokom ekranu
 * „Najbolji trkački parovi" prima tri para, a dno kutije ostaje u ravni sa dnom „Najboljeg napretka"."
 * Measured before the decision at 1280px: a row of a pair 106px, two pairs leave 85px under the heading row,
 * a third would have run 21px past the foot. The row is cut to at most 99px through the padding of its cells.
 *
 * **Asked in Chrome and not in jsdom**, which lays nothing out: the foot of the box of the pairs against the
 * foot of the box of the progress, the foot of the last row against the foot of its own box less the
 * padding, and the height of a row. **With three pairs in the answers**, which the sample has none of in
 * the season the page is read as: the three pairs of the sample with the most races in common are served
 * for the first season, and the pairs board of the warm-up draws exactly those.
 *
 * **Two widths, 1280 and 1440.** Under 900px the boxes stand one under another and there is no foot to keep
 * level, so the rule is written for the wide arrangement only and this guard does not read the others.
 */

test.use({ theDay: '2026-10-20' })

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

/** The sample's three best pairs by races run together before 2027, no member in two of them. */
const THREE: [string, string][] = [
  ['000001', '000020'],
  ['000014', '000030'],
  ['000010', '000026'],
]

/** How many pairs the sample is served with: the sample's own two for 2019 stay, and three for the first season. */
function answersWith(pairs: [string, string][]): Answers {
  return {
    ...everyAnswer(),
    '/api/pairs': pairs.map(([one, two], index) => ({
      id: index + 1,
      season: 2027,
      memberNumbers: [one, two],
      since: '2026-10-01',
    })),
  }
}

const THE_WIDTHS: At[] = [1280, 1440].map((width) => ({ width, text: 100 }))

/** One pixel, the figure the owner's „u ravni" is read as (the other guards of the boards use the same). */
const LEVEL = 1

/** The tallest a row of a pair may be (PDL 21.11.2026: „najviše 99 px"). */
const AT_MOST = 99

async function readBoards(
  open: Geometry['open'],
  at: At,
  pairs: [string, string][],
) {
  const { page, probe } = await open(at, '/sr/top-liste', '.boards__board--pairs tbody tr', answersWith(pairs))

  const seen = await page.evaluate(() => {
    const box = (selector: string) => {
      const found = document.querySelector(selector)

      if (found === null) {
        throw new Error(`no ${selector} on the page`)
      }

      return found
    }

    const pairsBox = box('.boards__board--pairs')
    const progressBox = box('.boards__board--progress')
    const rows = [...pairsBox.querySelectorAll('tbody tr')]
    const last = rows[rows.length - 1]
    const style = getComputedStyle(pairsBox)

    return {
      rows: rows.length,
      heights: rows.map((row) => row.getBoundingClientRect().height),
      pairsFoot: pairsBox.getBoundingClientRect().bottom,
      progressFoot: progressBox.getBoundingClientRect().bottom,
      lastRowFoot: last === undefined ? 0 : last.getBoundingClientRect().bottom,
      boxPadding: Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth),
      inTwoColumns: pairsBox.getBoundingClientRect().left > progressBox.getBoundingClientRect().right - 1,
    }
  })

  return { seen, probe }
}

for (const at of THE_WIDTHS) {
  test(`three pairs fit the box of the pairs and its foot is level with the progress, at ${label(at)}`, async ({
    open,
  }) => {
    const { seen, probe } = await readBoards(open, at, THREE)

    expect(probe.sideways).toBe(0)
    /* Measured is not assumed: three rows, and the two boxes in the two columns of the wide arrangement. */
    expect(seen.rows).toBe(3)
    expect(seen.inTwoColumns).toBe(true)

    for (const height of seen.heights) {
      expect(height).toBeLessThanOrEqual(AT_MOST)
    }

    expect(Math.abs(seen.pairsFoot - seen.progressFoot), `feet: ${JSON.stringify(seen)}`).toBeLessThanOrEqual(LEVEL)
    expect(
      seen.lastRowFoot,
      `the last row runs past the padding of its box: ${JSON.stringify(seen)}`,
    ).toBeLessThanOrEqual(seen.pairsFoot - seen.boxPadding + 0.5)
  })
}
