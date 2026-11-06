import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * WHERE THE PANELS OF THE SETTINGS PAGE STAND, ASKED OF CHROME (PDL P11, owner, 18.10.2026, „Strana
 * Podešavanja, sa snimaka"; ADL A63).
 *
 * <p>`styles/settingsLayout.test.ts` holds what the stylesheet SAYS, and `pages/member/
 * settingsByStanding.test.tsx` holds which panels share a `.member__pair`. Neither can say where a
 * panel then LANDS, and this is what the owner looked at:
 *
 * <ol>
 * <li><b>Two tall rows of two since 06.11.2026: the password beside the privacy, the theme beside the
 * language of the mail</b> (PDL, „Strana Podešavanja u tri visoka reda sa dve kolone": „lozinka prelazi
 * levo na njeno mesto, a Privatnost tekst iz priloga ide u desni stubac pored boksa za lozinku"; the row
 * of the picture beside the words about himself moved to the card „Podaci" on 06.11.2026, PDL „Boksovi
 * „Profilna slika" i „Tekst o sebi" prelaze sa Podešavanja", and is asked there,
 * `dataCard.geometry.ts`), <b>the two of a row as tall as each other, and on a telephone one under the other</b>
 * (the UI standard of the repository, `CLAUDE.md`). Beside is asked as the same top, the same bottom,
 * and the first's right edge not past the second's left; under is asked as the same left edge and the
 * second's top not above the first's bottom. Asked for a member whose fee stands. Somebody who has not
 * paid is not drawn the settings since 23.10.2026 (PDL 22.10.2026), so his arrangement is not asked.
 * <li><b>No empty space under the field for choosing a picture, and none between the box for the words
 * about himself and the button</b> (his words: „veliki prazan prostor"): asked on the card „Podaci" since
 * 06.11.2026, where the two boxes now stand (`dataCard.geometry.ts`).
 * <li><b>The page does not move sideways</b> at any of the widths (PDL P24).
 * </ol>
 *
 * <p><b>The widths on either side of the one the pair is made at</b> (`51.25em`: 819 and 820 at the
 * browser's own text, and 1639 and 1640 at 200%, because a query in `em` moves with the reader's letters,
 * ADL A34). Asserted rather than assumed: every case says first which of the two arrangements it reads.
 *
 * <p><b>Relations, never pixels.</b> The portal names no font of its own, so a number measured here
 * would be a claim about this machine; every assertion compares two boxes the same page drew.
 */

const MEMBER = {
  memberNumber: '000001',
  country: 'RS',
  firstSeason: 2014,
  membershipBasis: 'payment',
  active: true,
  referralCode: '7f07b38ff7ee7543',
  referredCount: 4,
  firstName: 'Vladan',
  lastName: 'Đurišić',
  gender: 'M',
  city: 'Beograd',
  ageBand: '40-54',
  beginner: false,
  categorySeason: 2027,
  categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
  bio: '',
  profileHidden: false,
  birthdayShown: 'none',
  address: 'Bulevar Pupina 10',
  phone: '+381 60 123 456',
  shirtSize: 'L',
}

const ROW = {
  memberNumber: MEMBER.memberNumber,
  firstName: MEMBER.firstName,
  lastName: MEMBER.lastName,
  gender: MEMBER.gender,
  city: MEMBER.city,
  country: MEMBER.country,
  category: { season: MEMBER.categorySeason, ageBand: MEMBER.ageBand, beginner: MEMBER.beginner },
  categories: MEMBER.categories,
  firstSeason: MEMBER.firstSeason,
  bio: '',
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  photo: null,
  crop: null,
}

/** A member whose fee stands: every panel there is. */
const A_MEMBER: Answers = {
  '/api/me': { role: 'competitor', account: 1, member: MEMBER, mailLanguage: 'sr' },
  '/api/competitors': [ROW],
  '/api/me/photo': { waiting: null, standing: null },
}

const PANELS = {
  password: 'section[aria-labelledby="account-password"]',
  privacy: 'section[aria-labelledby="settings-privacy"]',
  theme: 'section[aria-labelledby="settings-appearance"]',
  mail: 'section[aria-labelledby="settings-mail"]',
  picture: 'section[aria-labelledby="settings-picture"]',
  bio: 'section[aria-labelledby="settings-bio"]',
} as const

/** Only the screen of the settings, drawn with its panels, has the password with the theme. */
const READY = PANELS.password

/** Where the panels stand two to a row: from 51.25em, which is 820px at the browser's own text. */
const BESIDE: At[] = [
  { width: 820, text: 100 },
  { width: 1024, text: 100 },
  { width: 1280, text: 100 },
  { width: 1920, text: 200 },
]

/** Where they stand one under the other: a telephone, a tablet in portrait, and the pixel before. */
const UNDER: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 819, text: 100 },
  { width: 1280, text: 200 },
]

type Box = { left: number; right: number; top: number; bottom: number }

/** The boxes of the named panels, read off the page in one go. */
const boxesOf = async (page: Page, panels: Record<string, string>): Promise<Record<string, Box>> => {
  const seen = await page.evaluate((selectors) => {
    const out: Record<string, { left: number; right: number; top: number; bottom: number } | null> = {}

    for (const [name, selector] of Object.entries(selectors)) {
      const found = document.querySelector(selector)
      const box = found === null ? null : found.getBoundingClientRect()

      out[name] = box === null ? null : { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
    }

    return out
  }, panels)
  const boxes: Record<string, Box> = {}

  for (const [name, box] of Object.entries(seen)) {
    if (box === null) {
      throw notMeasured(`the settings did not draw ${name}`)
    }

    boxes[name] = box
  }

  return boxes
}

/** Which of the two arrangements this width reads, asked of the page's own query and not assumed. */
const pairsAreTwoColumns = (page: Page) =>
  page.evaluate(() => {
    const pair = document.querySelector('.member__pair')

    return pair === null ? 0 : getComputedStyle(pair).gridTemplateColumns.split(' ').length
  })

/** Two panels, one against the other, in the arrangement the width asks for. */
const expectPair = async (page: Page, first: string, second: string, columns: 1 | 2, why: string) => {
  const found = await boxesOf(page, { first, second })
  const a = found['first']
  const b = found['second']

  if (a === undefined || b === undefined) {
    throw notMeasured(`${why}: the panels were not read`)
  }

  expect(a.right - a.left, `${why}: the first panel has a width`).toBeGreaterThan(0)
  expect(b.right - b.left, `${why}: the second panel has a width`).toBeGreaterThan(0)

  if (columns === 2) {
    expect(Math.abs(a.top - b.top), `${why}: they stand in one row`).toBeLessThanOrEqual(SLACK)
    expect(Math.abs(a.bottom - b.bottom), `${why}: the two of a row are as tall as each other`).toBeLessThanOrEqual(SLACK)
    expect(a.right, `${why}: the first ends before the second begins`).toBeLessThanOrEqual(b.left + SLACK)
  } else {
    expect(Math.abs(a.left - b.left), `${why}: they stand against one left edge`).toBeLessThanOrEqual(SLACK)
    expect(b.top, `${why}: the second is under the first`).toBeGreaterThanOrEqual(a.bottom - SLACK)
  }
}

/** The settings of one kind of reader, at one width. */
const open = async (
  opener: (at: At, path: string, ready: string, answers: Answers) => Promise<{ page: Page; probe: { widened: number; sideways: number } }>,
  at: At,
  answers: Answers,
) => opener(at, '/sr/podesavanja', READY, answers)

for (const [columns, widths] of [
  [2, BESIDE],
  [1, UNDER],
] as const) {
  for (const at of widths) {
    test(`two rows, the two of each ${columns === 2 ? 'beside' : 'under'} each other, for a member whose fee stands, ${label(at)}`, async ({ open: opener }) => {
      const { page, probe } = await open(opener, at, A_MEMBER)

      await page.locator(PANELS.mail).waitFor({ state: 'visible' })
      await page.locator(PANELS.privacy).waitFor({ state: 'visible' })

      expect(await pairsAreTwoColumns(page), 'the width reads the arrangement it was chosen for').toBe(columns)

      await expectPair(page, PANELS.password, PANELS.privacy, columns, 'the password and the privacy')
      await expectPair(page, PANELS.theme, PANELS.mail, columns, 'the theme and the language of the mail')
      /* AND NOT THE PICTURE OR THE WORDS, which stand on the card „Podaci" since 06.11.2026. Asked once the
         privacy is drawn, which comes off the same list the two were drawn from. */
      expect(await page.locator(PANELS.picture).count(), 'the picture is not on the settings').toBe(0)
      expect(await page.locator(PANELS.bio).count(), 'the words are not on the settings').toBe(0)

      expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
      expect(probe.sideways, 'the page scrolls sideways').toBe(0)
    })
  }
}
