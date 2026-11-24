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
 * <li><b>One tall row since 24.11.2026: the password on the left, and on the right the privacy with the
 * language of the mail right under it</b> (owner, PDL „Portal ima samo tamnu temu; svetla se izbacuje": „boks
 * iz priloga prebaci odmah ispod sekcije Privatnosti (a desno od promene šifre)"; before it, PDL „Strana
 * Podešavanja u tri visoka reda sa dve kolone": „Privatnost tekst iz priloga ide u desni stubac pored boksa za
 * lozinku"; the picture and the words about himself are asked on the card „Podaci", `dataCard.geometry.ts`),
 * <b>the two columns as tall as each other, and on a telephone one box under the other, in the order the
 * password, the privacy, the mail</b> (the UI standard of the repository, `CLAUDE.md`). Beside is asked as the
 * same top and the first's right edge not past the second's left; under as the same left edge and the second's
 * top not above the first's bottom; as tall as each other as the same bottom.
 * <li><b>The three readers this screen has, each in his own arrangement</b>: a member whose fee stands (the
 * three boxes); an administration account with no member (no privacy, so the mail stands beside the password);
 * and a member whose fee has lapsed (no password either, so the mail is alone and takes the whole row).
 * Somebody who has not paid is not drawn the settings since 23.10.2026 (PDL 22.10.2026), so his arrangement is
 * not asked.
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

/** An administration account with no member: the password and the mail, and no profile to hide. */
const AN_ACCOUNT: Answers = {
  '/api/me': { role: 'moderator', account: 11, mailLanguage: 'sr' },
  '/api/competitors': [ROW],
}

/** A member whose fee has lapsed: the mail and the sentence about the renewal, and no password. */
const A_LAPSED_MEMBER: Answers = {
  ...A_MEMBER,
  '/api/me': { role: 'competitor', account: 1, member: { ...MEMBER, active: false }, mailLanguage: 'sr' },
}

const PANELS = {
  password: 'section[aria-labelledby="account-password"]',
  privacy: 'section[aria-labelledby="settings-privacy"]',
  mail: 'section[aria-labelledby="settings-mail"]',
  picture: 'section[aria-labelledby="settings-picture"]',
  bio: 'section[aria-labelledby="settings-bio"]',
} as const

/** The box of the theme, which no reader is drawn since 24.11.2026. */
const THE_THEME = 'section[aria-labelledby="settings-appearance"]'

/** Only the screen of the settings, drawn with its panels, has the mail, and every reader of it does. */
const READY = PANELS.mail

/** Where the panels stand two to a row: from 51.25em, which is 820px at the browser's own text.
 *  The desktops ask for a window 500px tall: since 24.11.2026 the screen is one row and no longer
 *  scrolls in a window of 900, and a desktop that draws no scrollbar is not measured (the harness). */
const BESIDE: At[] = [
  { width: 820, text: 100 },
  { width: 1024, text: 100, height: 500 },
  { width: 1280, text: 100, height: 500 },
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

/** Two boxes read off the page, and proof that both were drawn with a width. */
const twoBoxes = async (page: Page, first: string, second: string, why: string): Promise<[Box, Box]> => {
  const found = await boxesOf(page, { first, second })
  const a = found['first']
  const b = found['second']

  if (a === undefined || b === undefined) {
    throw notMeasured(`${why}: the panels were not read`)
  }

  expect(a.right - a.left, `${why}: the first panel has a width`).toBeGreaterThan(0)
  expect(b.right - b.left, `${why}: the second panel has a width`).toBeGreaterThan(0)

  return [a, b]
}

/** The second box beside the first, in the same row, starting at its top. */
const expectBeside = async (page: Page, first: string, second: string, why: string) => {
  const [a, b] = await twoBoxes(page, first, second, why)

  expect(Math.abs(a.top - b.top), `${why}: they stand in one row`).toBeLessThanOrEqual(SLACK)
  expect(a.right, `${why}: the first ends before the second begins`).toBeLessThanOrEqual(b.left + SLACK)
}

/** The second box under the first, against the same left edge. */
const expectUnder = async (page: Page, first: string, second: string, why: string) => {
  const [a, b] = await twoBoxes(page, first, second, why)

  expect(Math.abs(a.left - b.left), `${why}: they stand against one left edge`).toBeLessThanOrEqual(SLACK)
  expect(b.top, `${why}: the second is under the first`).toBeGreaterThanOrEqual(a.bottom - SLACK)
}

/** The two boxes end on one line: the columns of the row are as tall as each other. */
const expectSameBottom = async (page: Page, first: string, second: string, why: string) => {
  const [a, b] = await twoBoxes(page, first, second, why)

  expect(Math.abs(a.bottom - b.bottom), `${why}: the two columns are as tall as each other`).toBeLessThanOrEqual(SLACK)
}

/** The box as wide as the screen's own column, which is what a box with no neighbour is given. */
const expectWholeRow = async (page: Page, box: string, why: string) => {
  const [screen, alone] = await twoBoxes(page, 'main .member', box, why)

  expect(Math.abs(alone.left - screen.left), `${why}: it starts where the screen starts`).toBeLessThanOrEqual(SLACK)
  expect(Math.abs(alone.right - screen.right), `${why}: it ends where the screen ends`).toBeLessThanOrEqual(SLACK)
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
    test(`the password, and the privacy with the mail under it, ${columns === 2 ? 'beside' : 'under'} it, for a member whose fee stands, ${label(at)}`, async ({ open: opener }) => {
      const { page, probe } = await open(opener, at, A_MEMBER)

      await page.locator(PANELS.privacy).waitFor({ state: 'visible' })

      expect(await pairsAreTwoColumns(page), 'the width reads the arrangement it was chosen for').toBe(columns)

      if (columns === 2) {
        await expectBeside(page, PANELS.password, PANELS.privacy, 'the password and the privacy')
        await expectUnder(page, PANELS.privacy, PANELS.mail, 'the mail right under the privacy')
        await expectSameBottom(page, PANELS.password, PANELS.mail, 'the password and the column of the privacy and the mail')
      } else {
        await expectUnder(page, PANELS.password, PANELS.privacy, 'the privacy under the password')
        await expectUnder(page, PANELS.privacy, PANELS.mail, 'the mail under the privacy')
      }

      /* AND NOT THE THEME, which left the portal on 24.11.2026, NOR THE PICTURE OR THE WORDS, which stand on the
         card „Podaci" since 06.11.2026. Asked once the privacy is drawn, which comes off the same list the two
         were drawn from. */
      expect(await page.locator(THE_THEME).count(), 'the theme is not on the settings').toBe(0)
      expect(await page.locator(PANELS.picture).count(), 'the picture is not on the settings').toBe(0)
      expect(await page.locator(PANELS.bio).count(), 'the words are not on the settings').toBe(0)

      expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
      expect(probe.sideways, 'the page scrolls sideways').toBe(0)
    })

    test(`the mail ${columns === 2 ? 'beside' : 'under'} the password, for an administration account with no member, ${label(at)}`, async ({ open: opener }) => {
      const { page, probe } = await open(opener, at, AN_ACCOUNT)

      await page.locator(PANELS.password).waitFor({ state: 'visible' })

      expect(await pairsAreTwoColumns(page), 'the width reads the arrangement it was chosen for').toBe(columns)
      expect(await page.locator(PANELS.privacy).count(), 'an account with no member has no profile to hide').toBe(0)

      if (columns === 2) {
        await expectBeside(page, PANELS.password, PANELS.mail, 'the password and the mail')
        await expectSameBottom(page, PANELS.password, PANELS.mail, 'the password and the column of the mail')
      } else {
        await expectUnder(page, PANELS.password, PANELS.mail, 'the mail under the password')
      }

      expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
      expect(probe.sideways, 'the page scrolls sideways').toBe(0)
    })

    test(`the mail alone, across the whole row, for a member whose fee has lapsed, ${label(at)}`, async ({ open: opener }) => {
      const { page, probe } = await open(opener, at, A_LAPSED_MEMBER)

      expect(await page.locator(PANELS.password).count(), 'a member whose fee has lapsed is drawn no password').toBe(0)
      expect(await page.locator(PANELS.privacy).count(), 'a member whose fee has lapsed is drawn no privacy').toBe(0)

      await expectWholeRow(page, PANELS.mail, 'the mail with no neighbour')

      expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
      expect(probe.sideways, 'the page scrolls sideways').toBe(0)
    })
  }
}
