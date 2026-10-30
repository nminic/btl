import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE CARD „PODACI" OF A PROFILE, ASKED OF CHROME (PDL 22.10.2026, „Profil dobija karticu „Podaci"";
 * ADL A63), for both readers it has: the member himself, whose panel is his own form, and the
 * administration, whose form is the registration's.
 *
 * <p>jsdom lays nothing out, so `pages/profile/competitorData.test.tsx` holds who sees what and this holds
 * where it LANDS: at a telephone, a tablet in portrait and a desktop, and at 200% text, <b>nothing runs
 * off the right edge of the page and the page does not move sideways</b> (PDL P24), and <b>every box of the
 * form stands inside the viewport</b>, so nothing a reader has to type into is cut off at the edge.
 *
 * <p><b>Relations, never pixels</b>, as in `settings.geometry.ts`: every assertion compares a box with the
 * page the same browser drew.
 */

const NUMBER = '000001'

const ROW = {
  memberNumber: NUMBER,
  firstName: 'Vladan',
  lastName: 'Đurišić',
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  /* The card and every season he stands in (`CompetitorApi`, V81). */
  category: { season: 2027, ageBand: '40-54', beginner: false },
  categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
  firstSeason: 2014,
  bio: '',
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  photo: null,
  crop: null,
}

const HIM = {
  ...ROW,
  /* `/api/me` spells the category of his card in three fields of its own (`MeApi`, V81). */
  category: undefined,
  ageBand: '40-54',
  beginner: false,
  categorySeason: 2027,
  membershipBasis: 'payment',
  active: true,
  referralCode: '7f07b38ff7ee7543',
  referredCount: 4,
  address: 'Bulevar Pupina 10, stan 14, ulaz B',
  phone: '+381 60 123 456',
  shirtSize: 'L',
  /* The four he sees held (PDL 24.10.2026), with a father's name and a document as long as they get. */
  fatherName: 'Aleksandar-Petrović Radosavljević',
  birthDate: '1980-04-02',
  idNumber: 'ABCDEFGHIJ1234567890',
}

const THE_LISTS = {
  '/api/competitors': [ROW],
  '/api/teams': [],
  '/api/pairs': [],
}

/** The member himself, whose fee stands. */
const HIS_OWN: Answers = {
  ...THE_LISTS,
  '/api/me': { role: 'competitor', account: 1, member: HIM, mailLanguage: 'sr' },
}

/** The superadmin, who races for nobody, opening the member's card from the screen of the members. */
const THE_ADMINISTRATION: Answers = {
  ...THE_LISTS,
  '/api/me': { role: 'superadmin', account: 11, mailLanguage: 'sr' },
  [`/api/members/${NUMBER}/data`]: {
    memberNumber: NUMBER,
    firstName: 'Vladan',
    lastName: 'Đurišić',
    fatherName: 'Petar',
    gender: 'M',
    birthDate: '1980-04-02',
    idNumber: 'AB12345',
    email: 'vladan.djurisic.dugacka.adresa@primer.rs',
    emailConfirmed: false,
    address: 'Bulevar Pupina 10, stan 14, ulaz B',
    phone: '+381 60 123 456',
    placeId: null,
    city: 'Beograd',
    country: 'RS',
    shirtSize: 'L',
  },
}

const ADDRESS = `/sr/takmicar/${NUMBER}-vladan-durisic/podaci`

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
]

/** Every control of the card a reader types into or chooses in, as boxes. */
const controlsOf = (page: Page, card: string) =>
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
  }, card)

for (const [who, answers, card] of [
  ['the member himself', HIS_OWN, 'section[aria-labelledby="account-personal"]'],
  ['the administration', THE_ADMINISTRATION, 'section[aria-labelledby="form-podaci-clana-title"]'],
] as const) {
  for (const at of WIDTHS) {
    test(`the card of ${who} stands inside the page, ${label(at)}`, async ({ open }) => {
      const { page, probe } = await open(at, ADDRESS, card, answers)
      const controls = await controlsOf(page, card)
      const viewport = await page.evaluate(() => document.documentElement.clientWidth)

      if (controls === null || controls.length === 0) {
        throw notMeasured(`the card of ${who} drew no controls`)
      }

      for (const one of controls) {
        expect(one.width, `${one.name} has a width`).toBeGreaterThan(0)
        expect(one.left, `${one.name} starts inside the page`).toBeGreaterThanOrEqual(-SLACK)
        expect(one.right, `${one.name} ends inside the page`).toBeLessThanOrEqual(viewport + SLACK)
      }

      expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
      expect(probe.sideways, 'the page scrolls sideways').toBe(0)
    })
  }
}
