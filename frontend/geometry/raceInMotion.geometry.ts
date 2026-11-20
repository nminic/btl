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
  /* Two widths between the largest telephone and the tablet, where the owner's list has none (review of PR 736: a
     gold line moved onto the tools at 600px alone survived 30 of 30). */
  { width: 600, text: 100 },
  { width: 700, text: 100 },
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

      /* A word kept for the reader alone is clipped to a pixel, and is no word anyone sees. THE PIXEL IS
         THE BOX OF THE ELEMENT IT STANDS IN, and not the boxes of its lines: `.visually-hidden` and the
         rules that repeat it shrink the element to 1px and cut what overflows it, and the lines of the text
         inside keep their whole width. Read off the lines alone, the code of the language a telephone keeps
         for the reader (16.11.2026, `app/Shell.css`) was a word the gold touched at 600px. */
      const holder = node.parentElement?.getBoundingClientRect()

      if (holder === undefined || holder.width <= 1 || holder.height <= 1) {
        continue
      }

      for (const box of range.getClientRects()) {
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
      page.getByRole('button', { name: 'Jezik, SR' }),
      page.getByRole('button', { name: /^Otvori poruke/ }),
      page.getByRole('button', { name: 'Otvori nalog' }),
    ]
    /* The navigation is on the screen at every width since 16.11.2026: words from 700px up and a row of
       symbols under it, where it was folded behind „Otvori meni" under 820px (owner, 16.11.2026, PDL
       „Pravilnik prelazi u podnožje, a Timovi postaju treća kartica BTL tabela”). */
    const navigation = page.getByRole('navigation', { name: 'Glavna navigacija' })

    controls.push(...(await navigation.getByRole('link').all()))

    expect(controls.length).toBeGreaterThan(9)

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

/** Whether anything of this selector is drawn: no element on the way up from it is `display: none`. Read
 *  from the computed style, since `checkVisibility()` answers true for an SVG group taken off the page by
 *  `display: none` in Chrome (measured 20.11.2026: `getComputedStyle` said `none`, `checkVisibility()` said
 *  `true`, and nothing was running). */
async function isDrawn(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((query) => {
    const drawnUp = (one: Element | null): boolean => one === null || (getComputedStyle(one).display !== 'none' && drawnUp(one.parentElement))

    return [...document.querySelectorAll(query)].some((one) => drawnUp(one))
  }, selector)
}

/* THE GROUND AND THE DOT (owner, 20.11.2026, the approved draft „Pozadina i tačka"): a telephone has a
   ground of its own and no route and no dot, from 560px the wide ground is drawn with the route, and the
   dot runs only for a reader who has not asked for less movement. What the sheet says is read there; what
   Chrome draws is read here, at every width the owner listed. */
for (const at of WIDTHS.flatMap((one): At[] => [one, { ...one, theme: 'dark' }])) {
  test(`the ground draws the drawing of its width, and the dot only where the sheet lets it at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr', 'header .brand', ANSWERS)

    /* Neither drawing widens the page, in either theme. */
    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)

    const reads = at.width / (at.text / 100)
    const seen = {
      wide: await isDrawn(page, '.terrain--wide'),
      narrow: await isDrawn(page, '.terrain--narrow'),
      route: await isDrawn(page, '.terrain__route'),
      dot: await isDrawn(page, '.race-page__dot'),
    }

    expect(seen.wide, 'the wide ground').toBe(reads >= 560)
    expect(seen.narrow, 'the ground of a telephone').toBe(reads < 560)
    expect(seen.route, 'the route').toBe(reads >= 560)
    expect(seen.dot, 'the dot').toBe(reads >= 560)
  })
}

/**
 * Where the route, and so the dot that runs it, meets a word that stands on the bare page, if anywhere
 * (owner, 20.11.2026: „Jaka tačka, nikad ispod teksta").
 *
 * <p>The route is sampled along its length every few units and each sample is placed on the screen through
 * the path's own matrix, so the drawing is read where Chrome puts it at this width, slice and all. A word
 * is every line box of every text node of the page outside the layer, read the way the browser lays it out
 * (`Range.getClientRects`). Words that stand on something opaque are not measured: a card, the header, the
 * footer and the menus are painted over the layer, so nothing is under them to read. What is left are the
 * words that stand on the page itself, the only ones the route and the dot can be seen behind.
 *
 * <p>The layer is fixed to the window and the page scrolls under it, so any word may be scrolled to any
 * height the route reaches. A word is therefore compared by where it stands ACROSS, not by how far down: a
 * word that shares a column with a sample of the route, within the radius of the ring of the dot, is a
 * touch whatever the scroll.
 */
async function routeTouches(page: Page): Promise<{ words: number; points: number; touches: string[] }> {
  return page.evaluate(() => {
    const route = document.querySelector('.terrain--lane .terrain__route')
    const dotRadius = 11 + 2

    if (!(route instanceof SVGGeometryElement)) {
      return { words: 0, points: 0, touches: ['no route'] }
    }

    const matrix = route.getScreenCTM()
    const length = route.getTotalLength()
    const columns: number[] = []

    for (let at = 0; at <= length; at += 4) {
      const point = route.getPointAtLength(at)

      columns.push(matrix === null ? Number.NaN : new DOMPoint(point.x, point.y).matrixTransform(matrix).x)
    }

    /* And the path the dot itself is sent along, which is its own data and not the route's, so a dot sent
       somewhere the route does not go is seen as well. It is read from what Chrome computed for the dot. */
    const dot = document.querySelector('.race-page__dot')
    const travel = dot === null ? null : /path\("([^"]+)"\)/.exec(getComputedStyle(dot).offsetPath)?.[1]

    if (travel === undefined || travel === null) {
      return { words: 0, points: 0, touches: ['no path for the dot'] }
    }

    const own = document.createElementNS('http://www.w3.org/2000/svg', 'path')

    own.setAttribute('d', travel)
    route.parentElement?.append(own)

    for (let at = 0; at <= own.getTotalLength(); at += 4) {
      const point = own.getPointAtLength(at)

      columns.push(matrix === null ? Number.NaN : new DOMPoint(point.x, point.y).matrixTransform(matrix).x)
    }

    own.remove()

    /* Nothing of this word is seen on the bare page: it stands on something painted over the layer, or it is
       taken out of sight (the visually hidden words of a screen, which are one pixel and cut). The colour is
       read for its alpha whatever notation Chrome answers in, so a colour it writes in a notation of its own
       is not taken for a transparent one. */
    const covered = (one: Element | null): boolean => {
      for (let up = one; up !== null; up = up.parentElement) {
        const style = getComputedStyle(up)
        const alpha = /(?:,|\/)\s*([\d.]+)(%?)\s*\)$/.exec(style.backgroundColor)
        const strength = alpha === null ? 1 : Number(alpha[1]) / (alpha[2] === '%' ? 100 : 1)
        const painted = style.backgroundColor !== 'transparent' && strength >= 0.99

        if (up.localName === 'header' || up.localName === 'footer') return true
        if (style.backgroundImage !== 'none') return true
        if (painted && up !== document.body && up !== document.documentElement) return true
        if (style.overflow !== 'visible' && up.getBoundingClientRect().width <= 1) return true
      }

      return false
    }

    const words: { text: string; left: number; right: number }[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)

    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim()
      const parent = node.parentElement

      if (text === '' || parent === null || parent.closest('.race-page, script, style') !== null) continue
      if (!parent.checkVisibility({ opacityProperty: true, visibilityProperty: true }) || covered(parent)) continue

      const range = document.createRange()

      range.selectNodeContents(node)

      for (const box of range.getClientRects()) {
        if (box.width > 0) words.push({ text, left: box.left, right: box.right })
      }
    }

    const touches = words
      .filter((word) => columns.some((x) => x + dotRadius > word.left && x - dotRadius < word.right))
      .map((word) => `„${word.text.slice(0, 40)}" at ${Math.round(word.left)}-${Math.round(word.right)}`)

    return { words: words.length, points: columns.length, touches }
  })
}

/* The front page has no word on the bare page at all, so it would pass whatever the route did: the rulebook is
   text laid straight on the page (534 words) and the calendar has its heading and its notes there (13). Each
   must hold words, or this asks nothing. */
for (const at of WIDTHS.flatMap((one): At[] => [one, { ...one, theme: 'dark' }])) {
  const reads = at.width / (at.text / 100)

  if (reads < 560) continue

  for (const path of ['/sr', '/sr/pravilnik', '/sr/kalendar']) {
    test(`the route and the dot touch no word on ${path} at ${label(at)}`, async ({ open }) => {
      const { page } = await open(at, path, 'header .brand', ANSWERS)
      const seen = await routeTouches(page)

      expect(seen.points, 'the route was sampled').toBeGreaterThan(100)

      if (path !== '/sr') {
        expect(seen.words, 'words that stand on the bare page, so this asks something').toBeGreaterThan(5)
      }

      expect(seen.touches).toEqual([])
    })
  }
}

test('the dot is not drawn for a reader who asked for less movement, and the ground still is', async ({ open }) => {
  const { page } = await open({ width: 1280, text: 100 }, '/sr', 'header .brand', ANSWERS)

  await page.emulateMedia({ reducedMotion: 'reduce' })

  const seen = {
    wide: await isDrawn(page, '.terrain--wide'),
    dot: await isDrawn(page, '.race-page__dot'),
    running: await page.evaluate(() => document.getAnimations().length),
  }

  expect(seen).toEqual({ wide: true, dot: false, running: 0 })
})

test('the dot runs once, for five seconds at most, and starts again on the next screen', async ({ open }) => {
  const { page } = await open({ width: 1280, text: 100 }, '/sr', 'header .brand', ANSWERS)
  const timing = () =>
    page.evaluate(() => {
      const run = document.querySelector('.race-page__dot')?.getAnimations()[0]
      const effect = run?.effect?.getComputedTiming()

      return { at: Number(run?.currentTime ?? Number.NaN), duration: Number(effect?.duration), iterations: effect?.iterations }
    })

  /* The page has settled, so the first run is over and nothing runs: the dot rests where it stopped. */
  expect((await timing()).at).toBeNaN()

  await page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('link', { name: 'Kalendar' }).click()
  await page.waitForURL(/kalendar/)

  const after = await timing()

  expect(after.duration, 'seconds the dot runs').toBeLessThanOrEqual(5000)
  expect(after.iterations).toBe(1)
  expect(after.at, 'a new screen started the dot from the beginning').toBeLessThan(2000)
})

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

/* THE SAME QUESTION WITH THE MENU OPEN stood here until 16.11.2026, at every width where the navigation
   folded into „Otvori meni" (review of PR 736: the gold moved under „Pravilnik" in the open menu). There is
   no folded menu since: the words stand on the screen from 700px up and under it the entries are symbols
   whose words are kept for the reader alone, so every word of the header is among the ones the loop above
   reads. */

/**
 * How far each of the runner's feet stands off the gold line he runs up, in pixels on the screen.
 *
 * <p>Owner, 15.11.2026: „i pripoji stopala ka podlozi". The runner and the line are two shapes in one
 * drawing, so they could drift apart only if one of them is moved; this reads both where Chrome draws
 * them. A foot is the lowest point of the outline in its part of the runner's box (the rear one in the
 * left quarter, the front one in the lower fifth right of the middle), and the line is sampled densely
 * and read at that point's x.
 */
async function feetOffTheLine(page: Page): Promise<{ rear: number; front: number }> {
  return page.evaluate(() => {
    const onScreen = (path: SVGPathElement, steps: number) => {
      const matrix = path.getScreenCTM()
      const length = path.getTotalLength()

      return matrix === null
        ? []
        : Array.from({ length: steps + 1 }, (_, step) => path.getPointAtLength((length * step) / steps).matrixTransform(matrix))
    }
    const runner = document.querySelector<SVGPathElement>('.race-header__runner')
    const line = document.querySelector<SVGPathElement>('.race-header__rise .race-header__gold')

    if (runner === null || line === null) {
      return { rear: Number.NaN, front: Number.NaN }
    }

    const outline = onScreen(runner, 4000)
    const gold = onScreen(line, 4000).sort((a, b) => a.x - b.x)
    const box = runner.getBoundingClientRect()
    const lineAt = (x: number) => {
      const after = gold.findIndex((point) => point.x >= x)
      const right = gold[after]
      const left = gold[after - 1]

      if (right === undefined || left === undefined) {
        return Number.NaN
      }

      return left.y + ((right.y - left.y) * (x - left.x)) / (right.x - left.x || 1)
    }
    const lowest = (points: DOMPoint[]) => points.reduce((low, point) => (point.y > low.y ? point : low))
    const rear = lowest(outline.filter((point) => point.x < box.left + box.width * 0.25))
    const front = lowest(
      outline.filter((point) => point.x > box.left + box.width * 0.55 && point.y > box.top + box.height * 0.8),
    )

    return { rear: rear.y - lineAt(rear.x), front: front.y - lineAt(front.x) }
  })
}

for (const at of [
  { width: 1280, text: 100 },
  { width: 1440, text: 100 },
  { width: 1714, text: 100 },
] satisfies At[]) {
  test(`both feet of the runner stand on the gold line at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr', 'header .brand', ANSWERS)
    const off = await feetOffTheLine(page)

    /* Within a pixel, either way: no gap under a foot and no foot through the line. */
    expect(Math.abs(off.rear), `the rear foot is ${off.rear}px off the line`).toBeLessThanOrEqual(1)
    expect(Math.abs(off.front), `the front foot is ${off.front}px off the line`).toBeLessThanOrEqual(1)
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
