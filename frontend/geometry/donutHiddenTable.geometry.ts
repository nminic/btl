import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE TABLE THE RING WRITES FOR THE READER, ASKED OF CHROME ON THE PROFILE OF A MEMBER WHO HAS UNSCORED
 * RACES (review of PR 728, 14.11.2026; PDL „Ostale discipline kao lična evidencija").
 *
 * <p>The ring draws itself for the eye and writes the same numbers out as a `visually-hidden` table for a
 * screen reader. A table ignores the one pixel that recipe gives it and is as wide as its longest row, so
 * the new row „Nebodovane trke" took the page 13px past its right edge at 360px and 200% text: `scrollWidth`
 * 373 against `clientWidth` 360, the element over the edge `TABLE.visually-hidden`. The same build with no
 * unscored races gave no scroll at all, which is why the profile geometry of a member who has none
 * (`profileHead.geometry.ts`, 000030) could not see it.
 *
 * <p>So this asks it of a member who HAS them: 000002 holds three in the sample, and the row is asserted to
 * be there before the page is read, so a sample that lost them fails as not measured and not as a pass. The
 * page must not be wider than the screen and must not scroll sideways, at 360px at the browser's own text
 * and at 200%, at 768 and at 1280.
 *
 * <p><b>Relations, never pixels</b>, as in `settings.geometry.ts`.
 */

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

/** No season is frozen on the day the file is read as, as `profileHead.geometry.ts` and the suite answer. */
const ANSWERS: Answers = { ...everyAnswer(), '/api/frozen-seasons': [] }

const PAGE = '/sr/takmicar/000002-relja-momcilovic?sezona=sve'

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 360, text: 200 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
]

for (const at of WIDTHS) {
  test(`the ring of a member with unscored races does not widen the page, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, PAGE, '#profile-results', ANSWERS)

    /* The row that did it, found by what a screen reader finds. The member of the sample has three, so a
       page that does not draw it has measured nothing. */
    await expect(page.getByRole('rowheader', { name: 'Nebodovane trke' })).toHaveCount(1)

    expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
    expect(probe.sideways, 'the page scrolls sideways').toBe(0)

    /* And asked again after the page has settled, because the table is as wide as its words only once the
       ring is drawn, and a read taken at the moment `#profile-results` appears is a read of the page
       without them. */
    const later = await page.evaluate(() => {
      const root = document.documentElement

      return Math.max(0, root.scrollWidth - root.clientWidth)
    })

    expect(later, 'the page scrolls sideways once the ring is drawn').toBe(0)
  })
}
