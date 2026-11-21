import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'
import { THE_DAY_THE_SUITE_IS_READ_AS } from '../src/test/theDay.ts'

/**
 * THE GOLD STRIP UNDER THE HEADER, ASKED OF CHROME (owner, 21.11.2026, PDL „Zlatna traka obaveštenja ispod
 * zaglavlja, do početka prve sezone"): it widens no page, stands under the header and above the content
 * without covering either, keeps its sentence inside its box, offers a cross of 44px that takes the click,
 * and lets the panels that hang from the header go over it.
 *
 * <p>The widths are the three the owner names (360, 768, 1280) and both themes. On the other day the suite is
 * read as (`src/test/theDay.ts`, 2027) the strip is gone from the same address, and that is asked here too,
 * so the project that reads the later day measures the strip's end and not its absence by accident.
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers, so the front page is as long as a reader's. */
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

/** A visitor: `/api/me` is not among the answers, so it is a 401. */
const NO_ANSWERS: Answers = everyAnswer()

const WIDTHS: At[] = [360, 768, 1280].flatMap((width) =>
  (['light', 'dark'] as const).map((theme): At => ({ width, text: 100, theme })),
)

for (const at of WIDTHS) {
  test(`the strip widens nothing and covers nothing at ${label(at)}`, async ({ open, theDay }) => {
    const { page, probe } = await open(at, '/sr', 'header .brand', NO_ANSWERS)
    const strip = page.getByRole('note', { name: 'Obaveštenje' })

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)

    if (theDay !== THE_DAY_THE_SUITE_IS_READ_AS) {
      await expect(strip, 'the strip is gone on the day after the first season begins').toHaveCount(0)

      return
    }

    await expect(strip).toBeVisible()

    const seen = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
      const note = box('.notice')
      const header = box('header')
      const main = box('main')
      const text = document.querySelector<HTMLElement>('.notice__text')
      const close = box('.notice__close')

      return {
        width: document.documentElement.clientWidth,
        note: note === undefined ? null : { top: note.top, bottom: note.bottom, left: note.left, right: note.right },
        headerBottom: header?.bottom ?? Number.NaN,
        mainTop: main?.top ?? Number.NaN,
        textFits: text === null ? false : text.scrollWidth <= text.clientWidth + 0.5,
        textHeight: text?.getBoundingClientRect().height ?? Number.NaN,
        close: close === undefined ? null : { w: close.width, h: close.height, left: close.left, right: close.right },
      }
    })

    expect(seen.note, 'the strip has a box').not.toBeNull()

    const note = seen.note ?? { top: 0, bottom: 0, left: 0, right: 0 }

    /* Under the header and not over it, and over the content and not under it. */
    expect(note.top, 'the strip starts where the header ends').toBeGreaterThanOrEqual(seen.headerBottom - 0.5)
    expect(seen.mainTop, 'the content starts where the strip ends').toBeGreaterThanOrEqual(note.bottom - 0.5)
    /* The whole width of the window, and not a pixel past it. */
    expect(note.left).toBeGreaterThanOrEqual(0)
    expect(note.right).toBeLessThanOrEqual(seen.width + 0.5)
    expect(seen.textFits, 'the sentence stays inside its box').toBe(true)
    expect(seen.textHeight, 'the sentence was read').toBeGreaterThan(10)

    /* The cross: 44px square, wholly inside the window, and it takes the press. */
    const close = seen.close ?? { w: 0, h: 0, left: 0, right: 0 }

    expect(close.w).toBeGreaterThanOrEqual(44 - 0.5)
    expect(close.h).toBeGreaterThanOrEqual(44 - 0.5)
    expect(close.left).toBeGreaterThanOrEqual(0)
    expect(close.right).toBeLessThanOrEqual(seen.width + 0.5)

    const takes = await page.getByRole('button', { name: 'Zatvori obaveštenje' }).evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)

      return hit !== null && element.contains(hit)
    })

    expect(takes, 'the pointer at the middle of the cross lands on it').toBe(true)
  })

  test(`the panel of the language goes over the strip, not under it, at ${label(at)}`, async ({ open, theDay }) => {
    test.skip(theDay !== THE_DAY_THE_SUITE_IS_READ_AS, 'there is no strip on the other day')

    const { page } = await open(at, '/sr', 'header .brand', NO_ANSWERS)

    await page.getByRole('button', { name: 'Jezik, SR' }).click()
    /* Read when the panel has finished opening: a panel on its way is not yet where it stops. */
    await expect(page.locator('.lang__menu')).toBeVisible()
    await page.waitForFunction(() => document.getAnimations().length === 0)

    const verdict = await page.evaluate(() => {
      const note = document.querySelector('.notice')?.getBoundingClientRect()
      const panelElement = document.querySelector('.lang__menu')
      const panel = panelElement?.getBoundingClientRect()

      if (note === undefined || panel === undefined) {
        return { overlap: 0, covered: 'no strip or no panel' }
      }

      const top = Math.max(note.top, panel.top)
      const bottom = Math.min(note.bottom, panel.bottom)
      const x = Math.min(Math.max(panel.left + panel.width / 2, 1), innerWidth - 1)
      const hit = document.elementFromPoint(x, (top + bottom) / 2)

      return {
        overlap: bottom - top,
        covered: hit !== null && panelElement?.contains(hit) ? 'the panel' : `${hit?.className.toString() ?? 'nothing'}`,
      }
    })

    expect(verdict.overlap, `the panel and the strip overlap, or this measures nothing: ${JSON.stringify(verdict)}`).toBeGreaterThan(8)
    expect(verdict.covered).toBe('the panel')
  })
}
