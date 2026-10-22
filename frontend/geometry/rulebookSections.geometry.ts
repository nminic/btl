import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE LIST OF SECTIONS BESIDE THE RULEBOOK NAMES THE SECTION THE READER IS AT, TO THE VERY LAST ONE
 * (owner, 22.10.2026: „Inače dođem do dna strane ali ne mogu da selektujem, niti da se automatski
 * selektuje poslednja tačka iz leve podnavigacije članova").
 *
 * Measured before the change, with the sample, at 360, 768 and 1280: at the bottom of the page the
 * list still said „18. Dukati", and „19. Izmene pravilnika i završne odredbe" was marked neither
 * by scrolling nor by pressing it. The last section is shorter than the window, so its top never
 * rises into the band the list reads (the top third of the window, `Rulebook.tsx`); the page
 * runs out first. Pressing a link of one of the last sections takes the page to its end and no
 * further, and the section pressed never reaches the band either.
 *
 * **Asked in Chrome**, because jsdom scrolls nothing and lays nothing out:
 *
 * 1. **At the bottom of the page the last section is the one marked**, with a last section that is
 *    shorter than the window (the sample) and with one that is longer.
 * 2. **A press on a section marks that section**, also where the page cannot bring it to the
 *    line: the last two sections of the sample, pressed from the top.
 * 3. **Scrolling afterwards leads the list again**: the list follows the section at the line, and
 *    at the top of the page it is the first.
 *
 * Only one link is marked at a time, and the marked one is read off the page by its own attribute.
 */

/** The day the rulebook is read on. */
test.use({ theDay: '2026-10-22' })

type Section = { heading: string; body: string }
type Page_ = { slug: string; sections: Section[] }

const PAGES: Page_[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/test/mock/pages.json', import.meta.url)), 'utf-8'),
)

const RULEBOOK = PAGES.find((page) => page.slug === 'pravilnik')

if (RULEBOOK === undefined) {
  throw notMeasured('the sample has no rulebook')
}

const SECTIONS = RULEBOOK.sections
const LAST = SECTIONS[SECTIONS.length - 1]?.heading ?? ''
const BEFORE_LAST = SECTIONS[SECTIONS.length - 2]?.heading ?? ''
const FIFTH = SECTIONS[4]?.heading ?? ''
const EIGHTEENTH = '18. Dukati'
const NINTH = SECTIONS[8]?.heading ?? ''

/** The sample as it is: a last section a good deal shorter than a window. */
const SHORT_LAST: Answers = { '/api/pages': PAGES }

/** The same rulebook with a last section longer than any window the guard asks at. */
const LONG_LAST: Answers = {
  '/api/pages': PAGES.map((page) =>
    page.slug === 'pravilnik'
      ? {
          ...page,
          sections: page.sections.map((section, index) =>
            index === page.sections.length - 1
              ? { ...section, body: Array.from({ length: 14 }, () => section.body).join('\n\n') }
              : section,
          ),
        }
      : page,
  ),
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

/** Under 820px (51.25em) the list sits behind a button and a press on a link closes it again. */
const BEHIND_A_BUTTON = 820

const marked = (page: Page): Locator => page.locator('nav[aria-label="Na ovoj strani"] a[aria-current]')

const link = (page: Page, name: string): Locator => page.getByRole('link', { name, includeHidden: true })

/** Where the page has come to rest: the same height in every one of four reads a tenth of a second
 *  apart, which is longer than the list waits for a scroll to be over (`Rulebook.tsx`, 200ms), so
 *  that a scroll made next is the reader's and not read as the glide to a section just pressed.
 *  A glide to the end of this page takes more than a second in Chrome, so it is waited for. */
async function atRest(page: Page): Promise<void> {
  let reads: number[] = []

  for (let tries = 0; tries < 80; tries += 1) {
    reads = [...reads, await page.evaluate(() => window.scrollY)].slice(-4)

    if (reads.length === 4 && reads.every((read) => read === reads[0])) {
      return
    }

    await page.waitForTimeout(100)
  }

  throw notMeasured('the page did not stop scrolling')
}

async function scrollTo(page: Page, top: number | 'end'): Promise<void> {
  await page.evaluate((to) => {
    window.scrollTo({
      top: to === 'end' ? document.documentElement.scrollHeight : to,
      behavior: 'instant',
    })
  }, top)
  await atRest(page)
}

async function pressed(page: Page, at: At, name: string): Promise<void> {
  if (at.width < BEHIND_A_BUTTON) {
    await page.getByRole('button', { name: 'Sekcije pravilnika' }).click()
  }

  await link(page, name).click()
  await atRest(page)
}

/** Starts writing down every link of the list that is marked from now on, in the order it happens. */
async function watchTheMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gained: string[] = []

    new MutationObserver((changes) => {
      for (const change of changes) {
        const target = change.target

        if (
          target instanceof HTMLAnchorElement &&
          target.hasAttribute('aria-current') &&
          target.closest('nav[aria-label="Na ovoj strani"]') !== null
        ) {
          gained.push(target.getAttribute('href') ?? '')
        }
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-current'] })
    Object.assign(window, { gainedTheMark: gained })
  })
}

/** Every link marked since `watchTheMarker`, without repeats: a section that was passed on the way and
 *  marked for an instant is in it, which the mark a page ends on does not say. */
async function marksSinceWatching(page: Page): Promise<string[]> {
  const gained = await page.evaluate(() => {
    const seen: unknown = Reflect.get(window, 'gainedTheMark')

    return Array.isArray(seen) ? seen.map(String) : null
  })

  if (gained === null) {
    throw notMeasured('the marks were not being written down')
  }

  return [...new Set(gained)]
}

/** The same press, with the page's own thread held for `stall` milliseconds, six times, as soon as it is made:
 *  the glide goes on in the browser, and the scroll events it makes arrive late, which is what a
 *  slow phone or a busy page does to them. A pause between two scroll events is not the end of a glide. */
async function pressedWhileTheThreadIsBusy(page: Page, at: At, name: string, stall: number): Promise<void> {
  if (at.width < BEHIND_A_BUTTON) {
    await page.getByRole('button', { name: 'Sekcije pravilnika' }).click()
  }

  await link(page, name).click()

  // Held and let go again a few times: the glide is long, and one pause is easily the one before it starts.
  for (let round = 0; round < 6; round += 1) {
    await page.evaluate((hold) => {
      const until = performance.now() + hold

      while (performance.now() < until) {
        // held
      }
    }, stall)
    await page.waitForTimeout(60)
  }

  await atRest(page)
}

/** Where the page ended: asked, so that a rulebook that fits the window cannot be read as one scrolled to its end. */
async function isAtEnd(page: Page): Promise<boolean> {
  return page.evaluate(
    () => window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1,
  )
}

/** The id of the first section that stands in the top third of the window: what the list reads. */
async function sectionAtTheLine(page: Page): Promise<string> {
  return page.evaluate(() => {
    const line = window.innerHeight * 0.34
    const found = [...document.querySelectorAll('.rulebook__body section')].find((section) => {
      const box = section.getBoundingClientRect()

      return box.top < line && box.bottom > 0
    })

    return found === undefined ? '' : found.id
  })
}

/** Scrolls so that the section at `index` begins a hundred pixels under the top of the window. */
async function alignedAtTheLine(page: Page, index: number): Promise<void> {
  await page.evaluate((which) => {
    const section = document.querySelectorAll('.rulebook__body section')[which]

    if (section === undefined) {
      throw new Error('NOT MEASURED: the rulebook has no section ' + which)
    }

    window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top - 100, behavior: 'instant' })
  }, index)
  await atRest(page)
}

async function open(
  opener: (at: At, path: string, ready: string, answers: Answers) => Promise<{ page: Page }>,
  at: At,
  answers: Answers,
): Promise<Page> {
  const { page } = await opener(at, '/sr/pravilnik', '.rulebook__body section', answers)

  return page
}

for (const [kind, answers] of [
  ['last section shorter than the window', SHORT_LAST],
  ['last section longer than the window', LONG_LAST],
] as const) {
  for (const at of WIDTHS) {
    test(`at the bottom of the page the last section is marked, ${kind}, ${label(at)}`, async ({ open: opener }) => {
      const page = await open(opener, at, answers)

      await scrollTo(page, 'end')

      expect(await isAtEnd(page), 'the page was taken to its end').toBe(true)
      await expect(marked(page)).toHaveCount(1)
      await expect(link(page, LAST)).toHaveAttribute('aria-current', 'location')
    })
  }
}

for (const at of WIDTHS) {
  test(`a press on one of the last two sections marks that one, ${label(at)}`, async ({ open: opener }) => {
    const page = await open(opener, at, SHORT_LAST)

    await pressed(page, at, BEFORE_LAST)
    await expect(marked(page)).toHaveCount(1)
    await expect(link(page, BEFORE_LAST), 'the section before the last, pressed').toHaveAttribute('aria-current', 'location')

    await scrollTo(page, 0)
    await pressed(page, at, LAST)
    await expect(marked(page)).toHaveCount(1)
    await expect(link(page, LAST), 'the last section, pressed').toHaveAttribute('aria-current', 'location')
  })

  test(`scrolling after a press leads the list again, ${label(at)}`, async ({ open: opener }) => {
    const page = await open(opener, at, SHORT_LAST)

    await pressed(page, at, BEFORE_LAST)
    await expect(link(page, BEFORE_LAST)).toHaveAttribute('aria-current', 'location')

    // The reader takes the page in hand (a turn of the wheel), and then goes to the middle of the text:
    // a section there is at the line, and it is not either of the last two.
    await page.mouse.wheel(0, -50)
    await alignedAtTheLine(page, 9)

    const reading = await sectionAtTheLine(page)

    expect(reading, 'a section stands at the line').not.toBe('')
    await expect(marked(page)).toHaveCount(1)
    await expect(marked(page)).toHaveAttribute('href', `#${reading}`)

    // And back up to the first: the page was taken past every section on the way.
    await alignedAtTheLine(page, 0)
    await expect(marked(page)).toHaveAttribute('href', `#${await sectionAtTheLine(page)}`)
  })
}

/* The second press is the one that was not asked at first: from the top the glide starts at rest, and
 * from another section it starts moving, and a reader presses links one after another. */
for (const at of WIDTHS) {
  for (const [from, name] of [
    ['the top', undefined],
    [FIFTH, FIFTH],
    [NINTH, NINTH],
  ] as const) {
    test(`a press marks its section whether it was made from ${from === FIFTH ? 'the fifth' : from === NINTH ? 'the ninth' : 'the top'}, ${label(at)}`, async ({ open: opener }) => {
      const page = await open(opener, at, SHORT_LAST)

      if (name !== undefined) {
        await pressed(page, at, name)
      }

      await watchTheMarker(page)
      await pressed(page, at, EIGHTEENTH)
      await expect(marked(page)).toHaveCount(1)
      await expect(link(page, EIGHTEENTH), 'the section pressed').toHaveAttribute('aria-current', 'location')
      expect(
        (await marksSinceWatching(page)).filter((href) => href !== '#18-dukati'),
        'no other section was marked on the way',
      ).toEqual([])
    })

    test(`a press marks its section when the scroll events of the glide come late, from ${from === FIFTH ? 'the fifth' : from === NINTH ? 'the ninth' : 'the top'}, ${label(at)}`, async ({ open: opener }) => {
      const page = await open(opener, at, SHORT_LAST)

      // Whether the glide is held up depends on when the browser draws, so it is asked four times.
      for (let again = 0; again < 4; again += 1) {
        await scrollTo(page, 0)

        if (name !== undefined) {
          await pressed(page, at, name)
        }

        await watchTheMarker(page)
        await pressedWhileTheThreadIsBusy(page, at, EIGHTEENTH, 250)
        await expect(marked(page)).toHaveCount(1)
        await expect(link(page, EIGHTEENTH), 'the section pressed').toHaveAttribute('aria-current', 'location')
        expect(
        (await marksSinceWatching(page)).filter((href) => href !== '#18-dukati'),
        'no other section was marked on the way',
      ).toEqual([])
      }
    })
  }
}

/* After a press the list follows the reader again as soon as the reader moves the page, by whatever
 * means, and not before: the glide's own scrolling does not count (the tests above). */
for (const at of WIDTHS) {
  const hands: [string, (page: Page) => Promise<void>][] = [
    ['the wheel', (page) => page.mouse.wheel(0, -4000)],
    ['the page up key', (page) => page.keyboard.press('PageUp')],
  ]

  if (at.width >= 1000) {
    // A press in the track above the thumb: the page jumps a screen up. The bar is only drawn on a desktop.
    hands.push(['the bar at the edge of the window', (page) => page.mouse.click(at.width - 6, 300)])
  }

  for (const [hand, move] of hands) {
    test(`after a press the list follows the page again once the reader moves it with ${hand}, ${label(at)}`, async ({
      open: opener,
    }) => {
      const page = await open(opener, at, SHORT_LAST)

      await pressed(page, at, EIGHTEENTH)
      await expect(link(page, EIGHTEENTH)).toHaveAttribute('aria-current', 'location')

      const before = await page.evaluate(() => window.scrollY)

      await move(page)
      await atRest(page)

      expect(await page.evaluate(() => window.scrollY), 'the page moved').toBeLessThan(before)

      const reading = await sectionAtTheLine(page)

      expect(reading, 'a section stands at the line').not.toBe('')
      await expect(marked(page)).toHaveCount(1)
      await expect(marked(page)).toHaveAttribute('href', `#${reading}`)
    })
  }
}
