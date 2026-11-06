import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'
import { expectOneColumn, expectTheRegistrationsRows, fieldsOf } from './support/formRows.ts'

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
  /* His own pictures, which the boxes at the bottom of the card and the name of the card read (06.11.2026). */
  '/api/me/photo': { waiting: null, standing: null },
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
  ['the member himself', HIS_OWN, 'section[aria-labelledby="form-licni-podaci-title"]'],
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

/**
 * <p><b>And the member's own form is the registration's</b> (PDL 06.11.2026, „Profil: forma „Podaci" po
 * obliku forme za prijavu", owner: „dakle ne sve jedno ispod drugog"): its rows in thirds on a desktop, and
 * one column on a telephone and a tablet in portrait, where the registration is one column too
 * (`forms/FormRenderer.css`, 51.25em).
 */
const HIS_CARD = 'section[aria-labelledby="form-licni-podaci-title"]'

test('the member’s own form stands in the registration’s rows on a desktop, 1280px, text 100%', async ({ open }) => {
  const { page } = await open({ width: 1280, text: 100 }, ADDRESS, HIS_CARD, HIS_OWN)

  expectTheRegistrationsRows(await fieldsOf(page, HIS_CARD), 'his card')
})

for (const width of [360, 768]) {
  test(`the member’s own form is one column, ${width}px, text 100%`, async ({ open }) => {
    const { page } = await open({ width, text: 100 }, ADDRESS, HIS_CARD, HIS_OWN)

    expectOneColumn(await fieldsOf(page, HIS_CARD), 'his card')
  })
}

/**
 * THE PICTURE BESIDE THE WORDS ABOUT HIMSELF, AT THE BOTTOM OF THE CARD (owner, 06.11.2026, PDL „Boksovi
 * „Profilna slika" i „Tekst o sebi" prelaze sa Podešavanja"), for both readers: the member, whose boxes go
 * for review, and the administration, whose save at once. One row of two from 51.25em (the `.member__pair`
 * the settings had them in, `pages/member/Member.css`), one under the other below it, and no empty space
 * under either field (the owner's „veliki prazan prostor", asked on the settings until that day).
 */
const BOXES = {
  his: { picture: 'section[aria-labelledby="settings-picture"]', words: 'section[aria-labelledby="settings-bio"]' },
  theirs: { picture: 'section[aria-labelledby="their-picture"]', words: 'section[aria-labelledby="their-bio"]' },
} as const

type Box = { left: number; right: number; top: number; bottom: number }

const boxOf = (page: Page, selector: string): Promise<Box | null> =>
  page.evaluate((one) => {
    const found = document.querySelector(one)
    const box = found?.getBoundingClientRect()

    return box === undefined ? null : { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
  }, selector)

/** Which arrangement the width reads, asked of the pair's own grid and not assumed. */
const columnsOf = (page: Page, selector: string) =>
  page.evaluate((one) => {
    const pair = document.querySelector(one)?.closest('.member__pair')

    return pair === null || pair === undefined ? 0 : getComputedStyle(pair).gridTemplateColumns.split(' ').length
  }, selector)

/** How much of the wide field is below what it holds, and what stands between it and the next thing. */
const gapAfterTheField = (page: Page, panel: string) =>
  page.evaluate((selector) => {
    const section = document.querySelector(selector)
    const field = section?.querySelector('.rankings__field--wide')
    let next = field?.nextElementSibling ?? null

    while (next !== null && getComputedStyle(next).position === 'absolute') {
      next = next.nextElementSibling
    }

    if (section === null || section === undefined || field === null || field === undefined || next === null) {
      return null
    }

    const box = field.getBoundingClientRect()
    const held = Math.max(
      ...[...field.children]
        .filter((one) => getComputedStyle(one).position !== 'absolute')
        .map((one) => one.getBoundingClientRect().bottom),
    )

    return {
      emptyTail: box.bottom - held,
      between: next.getBoundingClientRect().top - box.bottom,
      panelGap: Number.parseFloat(getComputedStyle(section).rowGap) + Number.parseFloat(getComputedStyle(next).marginTop),
    }
  }, panel)

for (const [who, answers, boxes] of [
  ['the member himself', HIS_OWN, BOXES.his],
  ['the administration', THE_ADMINISTRATION, BOXES.theirs],
] as const) {
  for (const at of WIDTHS) {
    test(`the picture and the words of ${who} stand at the bottom of the card, ${label(at)}`, async ({ open }) => {
      const { page, probe } = await open(at, ADDRESS, boxes.words, answers)

      await page.locator(boxes.picture).waitFor({ state: 'visible' })

      const picture = await boxOf(page, boxes.picture)
      const words = await boxOf(page, boxes.words)

      if (picture === null || words === null) {
        throw notMeasured(`the card of ${who} drew no boxes`)
      }

      const columns = await columnsOf(page, boxes.picture)
      const wide = at.width >= 820 && at.text === 100

      expect(columns, 'the width reads the arrangement it was chosen for').toBe(wide ? 2 : 1)

      if (wide) {
        expect(Math.abs(picture.top - words.top), 'they stand in one row').toBeLessThanOrEqual(SLACK)
        expect(Math.abs(picture.bottom - words.bottom), 'the two are as tall as each other').toBeLessThanOrEqual(SLACK)
        expect(picture.right, 'the picture ends before the words begin').toBeLessThanOrEqual(words.left + SLACK)
      } else {
        expect(Math.abs(picture.left - words.left), 'they stand against one left edge').toBeLessThanOrEqual(SLACK)
        expect(words.top, 'the words are under the picture').toBeGreaterThanOrEqual(picture.bottom - SLACK)
      }

      for (const [name, panel] of [
        ['for choosing a picture', boxes.picture],
        ['for the words', boxes.words],
      ] as const) {
        const seen = await gapAfterTheField(page, panel)

        if (seen === null) {
          throw notMeasured(`${panel} did not draw a field with something after it`)
        }

        expect(seen.emptyTail, `the field ${name} is taller than what it holds`).toBeLessThanOrEqual(SLACK)
        expect(seen.between, `more than the panel’s own gap stands after the field ${name}`).toBeLessThanOrEqual(
          seen.panelGap + SLACK,
        )
      }

      expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
      expect(probe.sideways, 'the page scrolls sideways').toBe(0)
    })
  }
}
