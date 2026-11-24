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
 * <p>The widths are the three the owner names (360, 768, 1280). On the other day the suite is
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

const WIDTHS: At[] = [360, 768, 1280].map((width): At => ({ width, text: 100 }))

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
      /* What the header measured before the strip: the strip is the last thing inside it, so its own part is
         everything up to the element before the strip (the bar and the navigation). */
      const header = document.querySelector('.notice')?.previousElementSibling?.getBoundingClientRect()
      const whole = box('header')
      const main = box('main')
      const text = document.querySelector<HTMLElement>('.notice__text')
      const close = box('.notice__close')

      return {
        width: document.documentElement.clientWidth,
        note: note === undefined ? null : { top: note.top, bottom: note.bottom, left: note.left, right: note.right },
        headerBottom: header?.bottom ?? Number.NaN,
        wholeBottom: whole?.bottom ?? Number.NaN,
        mainTop: main?.top ?? Number.NaN,
        textFits: text === null ? false : text.scrollWidth <= text.clientWidth + 0.5,
        textHeight: text?.getBoundingClientRect().height ?? Number.NaN,
        close: close === undefined ? null : { w: close.width, h: close.height, left: close.left, right: close.right, top: close.top, bottom: close.bottom },
        /* The column the content of the page stands in, read off `main` and not off the strip's own classes, so
           a strip that loses its column (a class renamed, a wrapper gone) is measured against the page's. */
        column: (() => {
          const element = document.querySelector('main')

          if (element === null) {
            return null
          }

          const style = getComputedStyle(element)
          const edge = element.getBoundingClientRect()

          return { left: edge.left + Number.parseFloat(style.paddingLeft), right: edge.right - Number.parseFloat(style.paddingRight) }
        })(),
        textBox: (() => {
          const box = text?.getBoundingClientRect()

          return box === undefined ? null : { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
        })(),
      }
    })

    expect(seen.note, 'the strip has a box').not.toBeNull()

    const note = seen.note ?? { top: 0, bottom: 0, left: 0, right: 0 }

    /* Under the header and not over it, and over the content and not under it. */
    expect(note.top, 'the strip starts where the bar and the navigation of the header end').toBeGreaterThanOrEqual(seen.headerBottom - 0.5)
    expect(Math.abs(seen.wholeBottom - note.bottom), 'the header ends where the strip ends').toBeLessThanOrEqual(0.5)
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

    /* THE CROSS IS ON THE RIGHT (owner: „krstić desno") and the sentence is in the column of the page: the
       column's right edge, give or take the 12px the cross hangs out of it so its drawing lines up with the edge;
       the sentence begins where the content does; and the cross is in the row of the sentence or to the right of
       it, never under it. A strip that loses its column puts the cross under the text at 360 and stretches the
       sentence across the whole window at 1280. */
    const column = seen.column ?? { left: Number.NaN, right: Number.NaN }
    const textBox = seen.textBox ?? { left: Number.NaN, right: Number.NaN, top: Number.NaN, bottom: Number.NaN }

    expect(Math.abs(close.right - (column.right + 12)), `the cross stands at the right of the column ${JSON.stringify({ close, column })}`).toBeLessThanOrEqual(1)
    expect(Math.abs(textBox.left - column.left), `the sentence begins where the content begins ${JSON.stringify({ textBox, column })}`).toBeLessThanOrEqual(1)
    expect(close.left, 'the cross is to the right of the sentence').toBeGreaterThanOrEqual(textBox.right - 0.5)
    expect(seen.close?.top ?? Number.NaN, 'the cross is in the row of the sentence, not under it').toBeLessThan(textBox.bottom)

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

/* THE PERSON THAT STANDS FOR „PRIJAVI SE" ON A DESKTOP IS SEEN (owner, 21.11.2026, PDL „Zaglavlje za posetioca").
   Asked of Chrome because jsdom lays nothing out: the drawing takes its size from `.shell__person`, and an
   `<svg>` with that class gone is 0 by 0, which leaves a visitor with a link that has a name and nothing to
   look at. A telephone draws the arrow of its own row, which `phoneHeader.geometry.ts` holds. */
for (const at of WIDTHS.filter((one) => one.width >= 700)) {
  test(`the person for „Prijavi se" has a size you can see at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr', 'header .brand', NO_ANSWERS)
    const link = page.getByRole('link', { name: 'Prijavi se' })
    const box = await link.locator('svg').boundingBox()

    expect(box, 'the link draws a person').not.toBeNull()
    expect(box?.width ?? 0, 'the person is wide enough to see').toBeGreaterThanOrEqual(16)
    expect(box?.height ?? 0, 'the person is tall enough to see').toBeGreaterThanOrEqual(16)

    const link_ = await link.boundingBox()

    expect(link_?.width ?? 0, 'the link is a target of at least 24px (WCAG 2.2 SC 2.5.8)').toBeGreaterThanOrEqual(24)
    expect(link_?.height ?? 0).toBeGreaterThanOrEqual(24)
  })
}
