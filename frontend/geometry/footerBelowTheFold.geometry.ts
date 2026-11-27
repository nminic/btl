import { expect } from '@playwright/test'
import { SLACK, label, notMeasured, settle, test } from './support/harness.ts'
import type { At } from './support/harness.ts'

/**
 * THE FOOT IS UNDER THE FIRST SCREEN WHILE A SCREEN IS ON ITS WAY, AND IN IT ONCE A SHORT SCREEN IS DRAWN
 * (owner, 25.11.2026, „1 potvrđujem", PENDING „Pregled performansi: 1 se radi": „min-height na .shell__main
 * dok ekran stiže, da podnožje ne stoji u prvom ekranu").
 *
 * <p>Lighthouse 12 on a simulated telephone measured a layout shift of 0.18 on the front page, the calendar,
 * a profile and a competitor, and put all of it on `footer.shell__footer` (the limit for „dobro" is 0.10).
 * While a screen waits for its data the main is short, the foot is held at the bottom of the window by `#root`
 * and is therefore IN the first screen, and when the content lands it is pushed out of it. The cure is a main
 * as tall as the window while the page-level loader is in it, and only then (`app/Shell.css`).
 *
 * <p>jsdom lays out nothing, so this is a measurement, at 360 and 768 (a desktop that does not scroll is refused by the harness, and a short screen does not scroll):
 *
 * - **while the screen is on its way** (the calendar, its data asked of a server that never answers, reached
 *   from the sign in form by its link) the loader is on the page and the foot starts at or under the bottom
 *   edge of the window;
 * - **once a short screen is drawn** (the sign in form, every answer a 404) the foot is in the first screen,
 *   the page is no taller than the window, and it does not scroll for the sake of the rule;
 * - **once a screen that WAS on its way is drawn short** (the calendar reached from the sign in form, every answer
 *   a 404, so its wait ends in the sentence that its data cannot be read) the same three hold and no loader
 *   is left on the page. The sign in form has never had a loader, so the case above cannot see one that stays
 *   (PENDING, PR 834, 27.11.2026).
 *
 * What it does not read is the shift itself, which `open` cannot see because it waits for the page to settle:
 * the number is Lighthouse's, and the property that makes it zero is the first one above. And it does not
 * read the wait for a screen's CODE, which draws no main to be short (`app/Shell.css`).
 */

const SHORT = '/sr/prijava'
const ON_ITS_WAY = 'a[href="/sr/kalendar"]'

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
]

for (const at of WIDTHS) {
  test(`the foot is under the first screen while a screen is on its way, at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, SHORT, '.shell__footer', {})

    /* A server that never answers, put in front of the harness's own answers (the route registered last is
       asked first), and then a press on a link of the header: the calendar is drawn as soon as its code is
       here, and its data is the wait. */
    await page.context().route('**/api/**', () => undefined)
    await page.locator(ON_ITS_WAY).first().click()
    await page
      .locator('.loader:not(.loader--inline)')
      .waitFor({ state: 'attached', timeout: 15_000 })
      .catch(() => {
        throw notMeasured('the page-level loader never came onto the page after the press, so there was no wait to measure')
      })

    /* READ NOW, WHILE THE SCREEN WAITS: the page's own sideways reading is the one taken before the press, on
       the sign in form, and says nothing of the state this case is about (PENDING, PR 834 N1, 27.11.2026). */
    const seen = await page.evaluate(() => {
      const foot = document.querySelector('.shell__footer')

      if (foot === null) {
        throw new Error('nothing matches .shell__footer')
      }

      const root = document.documentElement

      return {
        footTop: foot.getBoundingClientRect().top + scrollY,
        window: innerHeight,
        loaders: document.querySelectorAll('.loader:not(.loader--inline)').length,
        sideways: Math.max(0, root.scrollWidth - root.clientWidth),
      }
    })

    expect(seen.loaders).toBe(1)
    expect(seen.footTop).toBeGreaterThanOrEqual(seen.window - SLACK)
    expect(seen.sideways).toBe(0)
    expect(probe.sideways).toBe(0)
  })
}

for (const at of WIDTHS) {
  test(`a short screen once drawn has its foot in the first screen and no scroll, at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, SHORT, '.shell__footer', {})

    const seen = await page.evaluate(() => {
      const foot = document.querySelector('.shell__footer')

      if (foot === null) {
        throw new Error('nothing matches .shell__footer')
      }

      return {
        loaders: document.querySelectorAll('.loader').length,
        footTop: foot.getBoundingClientRect().top + scrollY,
        window: innerHeight,
        document: document.documentElement.scrollHeight,
      }
    })

    expect(seen.loaders).toBe(0)

    expect(seen.document).toBeLessThanOrEqual(seen.window + SLACK)
    expect(seen.footTop).toBeLessThan(seen.window)

    expect(probe.sideways).toBe(0)
  })
}

for (const at of WIDTHS) {
  test(`a screen that was on its way and is drawn short keeps no loader and has its foot in the first screen, at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, SHORT, '.shell__footer', {})

    /* The harness answers every request for data with a 404, so the calendar's wait ends in the sentence that
       its data cannot be read: a short screen that WAS on its way, which is the state the loader has to leave
       the main in. */
    await page.locator(ON_ITS_WAY).first().click()
    await settle(page, '.unreadable')

    const seen = await page.evaluate(() => {
      const foot = document.querySelector('.shell__footer')

      if (foot === null) {
        throw new Error('nothing matches .shell__footer')
      }

      const root = document.documentElement

      return {
        loaders: document.querySelectorAll('.loader').length,
        footTop: foot.getBoundingClientRect().top + scrollY,
        window: innerHeight,
        document: root.scrollHeight,
        sideways: Math.max(0, root.scrollWidth - root.clientWidth),
      }
    })

    expect(seen.loaders).toBe(0)
    expect(seen.document).toBeLessThanOrEqual(seen.window + SLACK)
    expect(seen.footTop).toBeLessThan(seen.window)
    expect(seen.sideways).toBe(0)
  })
}
