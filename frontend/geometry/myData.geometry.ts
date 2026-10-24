import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE PAGE „MOJI PODACI" AND THE MENU WITH THE NAME ON IT, ASKED OF CHROME, for somebody who registered
 * and has not paid (PDL 22.10.2026, „Član koji još nije platio: bez reči nalog, samo Članarina"; ADL A63).
 *
 * <p>jsdom lays nothing out, so `pages/member/myData.test.tsx` and `app/unpaidMenu.test.tsx` hold what is
 * drawn and this holds where it LANDS: at a telephone, a tablet in portrait and a desktop, and at 200%
 * text, <b>nothing runs off the right edge of the page and the page does not move sideways</b> (PDL P24),
 * <b>every box of the form stands inside the viewport</b>, and <b>the panel behind the picture, opened on
 * a name as long as a name gets, stands inside the viewport and does not cut the name off</b>.
 *
 * <p><b>Relations, never pixels</b>, as in `settings.geometry.ts`: every assertion compares a box with the
 * page the same browser drew.
 */

const HE = {
  country: 'RS',
  firstSeason: 2027,
  active: false,
  referralCode: '3d6b1f0a9c2e4478',
  referredCount: 0,
  firstName: 'Aleksandar',
  /* The longest kind of surname the portal meets: two names joined, with a diacritic at each end. */
  lastName: 'Radosavljević-Petrović',
  gender: 'M',
  city: 'Beograd',
  ageBand: '25-39',
  firstSeason2027: false,
  bio: '',
  profileHidden: false,
  birthdayShown: 'none',
  address: 'Bulevar Pupina 10, stan 14, ulaz B',
  shirtSize: 'XL',
}

const SOMEBODY_WHO_HAS_NOT_PAID: Answers = {
  '/api/competitors': [],
  '/api/teams': [],
  '/api/pairs': [],
  '/api/me': { role: 'competitor', account: 4, member: HE, mailLanguage: 'sr' },
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
]

const CARD = 'section[aria-labelledby="account-personal"]'

/** Every control of the panel a reader types into or chooses in, as boxes. */
const controlsOf = (page: Page) =>
  page.evaluate((selector) => {
    const root = document.querySelector(selector)

    if (root === null) {
      return null
    }

    return [...root.querySelectorAll('input:not([type="hidden"]), select, textarea, button')]
      .filter((one) => getComputedStyle(one).position !== 'absolute')
      .map((one) => {
        const box = one.getBoundingClientRect()

        return { name: one.getAttribute('name') ?? one.textContent ?? '', left: box.left, right: box.right, width: box.width }
      })
  }, CARD)

for (const at of WIDTHS) {
  test(`the page of his data stands inside the page, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr/moji-podaci', CARD, SOMEBODY_WHO_HAS_NOT_PAID)
    const controls = await controlsOf(page)
    const viewport = await page.evaluate(() => document.documentElement.clientWidth)

    if (controls === null || controls.length === 0) {
      throw notMeasured('the page of his data drew no controls')
    }

    for (const one of controls) {
      expect(one.width, `${one.name} has a width`).toBeGreaterThan(0)
      expect(one.left, `${one.name} starts inside the page`).toBeGreaterThanOrEqual(-SLACK)
      expect(one.right, `${one.name} ends inside the page`).toBeLessThanOrEqual(viewport + SLACK)
    }

    expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
    expect(probe.sideways, 'the page scrolls sideways').toBe(0)
  })

  test(`the menu with his name stands inside the page and cuts nothing off, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr', '.account__btn', SOMEBODY_WHO_HAS_NOT_PAID)

    /* Waited for until the name is in the circle, so the panel is opened on his name and not on nothing. */
    await expect(page.locator('.account__monogram')).toHaveText('AR')
    await page.locator('.account__btn').click()
    await page.locator('.account__panel .account__who').waitFor({ state: 'visible' })

    const measured = await page.evaluate(() => {
      const panel = document.querySelector('.account__panel')?.getBoundingClientRect()
      const who = document.querySelector('.account__who')

      if (panel === undefined || who === null) {
        return null
      }

      return {
        left: panel.left,
        right: panel.right,
        viewport: document.documentElement.clientWidth,
        /* A name wider than the line it stands on is cut off or runs under the edge of the panel. */
        cutOff: who.scrollWidth - who.clientWidth,
        entries: [...document.querySelectorAll('.account__panel .account__link')].map((one) => one.textContent),
      }
    })

    if (measured === null) {
      throw notMeasured('the panel behind the picture was not drawn')
    }

    expect(measured.entries, 'the entries he is drawn, in order').toEqual([
      'Moji podaci',
      'Moja članarina',
      'Odjavi se',
    ])
    expect(measured.left, 'the panel starts inside the page').toBeGreaterThanOrEqual(-SLACK)
    expect(measured.right, 'the panel ends inside the page').toBeLessThanOrEqual(measured.viewport + SLACK)
    expect(measured.cutOff, 'the name is not cut off').toBeLessThanOrEqual(SLACK)
    expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
    expect(probe.sideways, 'the page scrolls sideways').toBe(0)
  })
}
