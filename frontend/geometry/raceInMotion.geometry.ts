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
async function drawn(page: Page): Promise<{ lanes: number; gold: boolean; rise: boolean; runner: boolean }> {
  return page.evaluate(() => {
    const shown = (element: Element) => getComputedStyle(element).display !== 'none'
    const boxed = (one: Element) => shown(one) && one.getBoundingClientRect().width > 0
    const lanes = [...document.querySelectorAll('.race-header__lane')].filter(shown).length
    const gold = [...document.querySelectorAll('.race-header__track')].some(boxed)
    const rise = [...document.querySelectorAll('.race-header__rise')].some(boxed)
    const runner = [...document.querySelectorAll('.race-header__runner')].some(
      (one) => boxed(one) && one.closest('svg') !== null && shown(one.closest('svg') ?? one),
    )

    return { lanes, gold, rise, runner }
  })
}

/** How close the bright gold may come to a word: the glow the sheet draws around it (0.1875rem) and
 *  half its stroke, at the text size of the screen. */
const CLEARANCE_REM = 0.1875 + 0.0625

/**
 * Where the bright gold and the runner touch a word of the header, if anywhere.
 *
 * <p>A word is every line box of every text node in the header outside the layer, read the way the
 * browser lays it out (`Range.getClientRects`), so a word that wraps is two boxes and a hidden word is
 * none. The gold is every visible `.race-header__gold` sampled along its length and placed on the
 * screen through its own matrix, so the stretched strip and the climb are read where Chrome draws
 * them and not where their numbers say. The runner is its whole box, which is stricter than its
 * outline.
 */
async function touching(page: Page): Promise<{ words: number; points: number; touches: string[] }> {
  return page.evaluate((clearanceRem) => {
    const header = document.querySelector('header')
    const layer = header?.querySelector('.race-header')

    if (!header || !layer) {
      return { words: 0, points: 0, touches: ['no header or no layer'] }
    }

    const clearance = clearanceRem * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    const words: { text: string; box: DOMRect }[] = []
    const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT)

    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim()
      /* A closed menu of the header keeps its words laid out and unseen; they are no word anyone
         reads over the gold, and when the menu opens they stand on its own opaque panel. */
      const seen = node.parentElement?.checkVisibility({ opacityProperty: true, visibilityProperty: true }) ?? false

      if (layer.contains(node) || text === '' || !seen) {
        continue
      }

      const range = document.createRange()

      range.selectNodeContents(node)

      for (const box of range.getClientRects()) {
        /* A word kept for the reader alone is clipped to a pixel, and is no word anyone sees. */
        if (box.width > 1 && box.height > 1) {
          words.push({ text, box })
        }
      }
    }

    const shown = (element: Element) => {
      const svg = element.closest('svg')

      return svg !== null && getComputedStyle(svg).display !== 'none' && svg.getBoundingClientRect().width > 0
    }
    const points: { x: number; y: number; from: string }[] = []

    for (const path of header.querySelectorAll<SVGPathElement>('.race-header__gold')) {
      const matrix = path.getScreenCTM()

      if (!shown(path) || matrix === null) {
        continue
      }

      const length = path.getTotalLength()

      for (let step = 0; step <= 800; step += 1) {
        const at = path.getPointAtLength((length * step) / 800).matrixTransform(matrix)

        if (at.x >= 0 && at.x <= innerWidth) {
          points.push({ x: at.x, y: at.y, from: path.closest('svg')?.getAttribute('class') ?? '' })
        }
      }
    }

    const touches: string[] = []

    for (const { text, box } of words) {
      for (const point of points) {
        if (
          point.x >= box.left - clearance &&
          point.x <= box.right + clearance &&
          point.y >= box.top - clearance &&
          point.y <= box.bottom + clearance
        ) {
          touches.push(`${point.from} at ${Math.round(point.x)},${Math.round(point.y)} touches „${text}"`)
          break
        }
      }

      for (const runner of header.querySelectorAll('.race-header__runner')) {
        const body = runner.getBoundingClientRect()

        if (
          shown(runner) &&
          body.left < box.right &&
          body.right > box.left &&
          body.top < box.bottom &&
          body.bottom > box.top
        ) {
          touches.push(`the runner touches „${text}"`)
        }
      }
    }

    return { words: words.length, points: points.length, touches }
  }, CLEARANCE_REM)
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
    expect(seen.lanes).toBe(5)
    expect(seen.rise).toBe(reads >= 1280)
    expect(seen.runner).toBe(reads >= 1280)
  })
}

/* The gold line is bright where the reference has it bright (owner, 15.11.2026: „lepe istaknute
   zlatne linije"), too bright for a word to stand on it at 4,5:1, and the runner stands beside the
   tools. So both stand where no word does, and that is asked here at every width the owner listed
   and at 1280 at the browser's own text size, the narrowest screen the runner is drawn on;
   `styles/raceInMotion.test.ts` measures every ground a word may stand on, which is the rest. */
for (const at of [...WIDTHS, { width: 1280, text: 100 } satisfies At]) {
  test(`the bright gold and the runner touch no text at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr', 'header .brand', ANSWERS)
    const seen = await touching(page)

    /* The brand, the tools and, on a desktop, every link of the navigation: something was read, and
       some of the gold is on the screen at every width. */
    expect(seen.words, 'the words of the header that were read').toBeGreaterThan(3)
    expect(seen.points, 'the points of the gold that were read').toBeGreaterThan(50)
    expect(seen.touches).toEqual([])
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
