import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * „RACE IN MOTION", ASKED OF CHROME (owner, 14.11.2026, PDL „Vizuelno osveženje „Race in Motion""):
 * the two decorative layers of the shell widen no page, take no click from anything under them, and
 * draw at each width what the sheet says that width draws.
 *
 * <p>The widths are the owner's own list (320, 375, 390, 428, 768, 1024, 1440) and 1280 with the text
 * at 200%, where the navigation wraps under the runner. A sideways scroll and a layer over a control
 * are seen nowhere else: jsdom lays nothing out.
 *
 * <p>The click is asked the way the pointer asks it, `elementFromPoint` at the middle of each control,
 * and the answer has to be the control or something inside it. A layer without `pointer-events: none`
 * answers instead, and so does one drawn over the bar rather than under it.
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

/** Signed in as the administration, so the header holds every control it can hold. */
const ANSWERS: Answers = { ...everyAnswer(), '/api/me': { role: 'superadmin', account: 41, membershipBasis: null } }

const WIDTHS: At[] = [
  { width: 320, text: 100 },
  { width: 375, text: 100 },
  { width: 390, text: 100 },
  { width: 428, text: 100 },
  { width: 768, text: 100 },
  { width: 1024, text: 100 },
  { width: 1440, text: 100 },
  { width: 1280, text: 200 },
]

/** Whether the pointer at the middle of this control lands on it and not on something laid over it. */
async function takesTheClick(control: Locator): Promise<string> {
  await control.scrollIntoViewIfNeeded()

  return control.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)

    return hit !== null && element.contains(hit) ? 'the control' : `${hit?.className.toString() ?? 'nothing'}`
  })
}

/** The lanes and the runner Chrome actually draws, which is what the sheet's queries decide. */
async function drawn(page: Page): Promise<{ lanes: number; gold: boolean; runner: boolean }> {
  return page.evaluate(() => {
    const shown = (element: Element) => getComputedStyle(element).display !== 'none'
    const lanes = [...document.querySelectorAll('.race-header__lane')].filter(shown).length
    const gold = [...document.querySelectorAll('.race-header__gold')].some(shown)
    const runner = [...document.querySelectorAll('.race-header__runner')].some(
      (one) => shown(one) && one.getBoundingClientRect().width > 0,
    )

    return { lanes, gold, runner }
  })
}

for (const at of WIDTHS) {
  test(`the decoration widens nothing and covers no control at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr', 'header .brand', ANSWERS)

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)

    /* Neither layer reaches past the window, whatever it draws inside itself. */
    const reach = await page.evaluate(() =>
      ['.race-header', '.race-page'].map((selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect()

        return { selector, right: box?.right ?? Number.NaN, left: box?.left ?? Number.NaN }
      }),
    )
    const width = await page.evaluate(() => document.documentElement.clientWidth)

    for (const layer of reach) {
      expect(layer.left, `${layer.selector} left`).toBeGreaterThanOrEqual(0)
      expect(layer.right, `${layer.selector} right`).toBeLessThanOrEqual(width + 0.5)
    }

    const controls = [
      page.getByRole('link', { name: 'Naslovna strana' }),
      page.getByRole('button', { name: 'Jezik' }),
      page.getByRole('button', { name: /^Otvori poruke/ }),
      page.getByRole('button', { name: 'Otvori nalog' }),
    ]
    const navigation = page.getByRole('navigation', { name: 'Glavna navigacija' })

    if (await navigation.isVisible()) {
      controls.push(...(await navigation.getByRole('link').all()))
    } else {
      controls.push(page.getByRole('button', { name: 'Otvori meni' }))
    }

    expect(controls.length).toBeGreaterThan(4)

    for (const control of controls) {
      expect(await takesTheClick(control), `${await control.textContent()} at ${label(at)}`).toBe('the control')
    }
  })

  test(`each width draws what the sheet gives it at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr', 'header .brand', ANSWERS)
    const seen = await drawn(page)
    /* The width the queries read, which at 200% text is half the window. */
    const reads = at.width / (at.text / 100)

    expect(seen.gold).toBe(true)
    expect(seen.lanes).toBe(reads >= 820 ? 4 : reads >= 560 ? 3 : 2)
    expect(seen.runner).toBe(reads >= 1000)
  })
}

test('an open menu of the header still lies over the page under it', async ({ open }) => {
  const { page } = await open({ width: 1440, text: 100 }, '/sr', 'header .brand', ANSWERS)

  await page.getByRole('button', { name: 'Otvori nalog' }).click()

  const panel = page.locator('#account-menu')

  await expect(panel).toBeVisible()

  /* The lowest point of the panel, which hangs below the header over the first card. */
  const answer = await panel.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY
    const hit = document.elementFromPoint(box.left + box.width / 2, box.bottom - 4)

    return { below: box.bottom - 4 > header, inside: hit !== null && element.contains(hit) }
  })

  expect(answer.below, 'the panel reaches below the header, so this asks something').toBe(true)
  expect(answer.inside).toBe(true)
})

test('the page layer stays the size of the window at the foot of a long page', async ({ open }) => {
  const { page, probe } = await open({ width: 1440, text: 100 }, '/sr/pravilnik', 'main h1', ANSWERS)

  expect(probe.sideways).toBe(0)

  const tall = await page.evaluate(() => document.documentElement.scrollHeight / innerHeight)

  expect(tall, 'the page is several windows tall, so its foot is far from where the layer began').toBeGreaterThan(3)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

  const box = await page.evaluate(() => {
    const layer = document.querySelector('.race-page')?.getBoundingClientRect()

    return { top: layer?.top, bottom: layer?.bottom, height: innerHeight }
  })

  expect(box.top).toBe(0)
  expect(box.bottom).toBe(box.height)
})
