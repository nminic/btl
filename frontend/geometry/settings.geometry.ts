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
 * <li><b>Three tall rows of two since 23.10.2026: the password beside the privacy, the picture beside
 * the words about himself, the theme beside the language of the mail</b> (PDL, „Strana Podešavanja u
 * tri visoka reda sa dve kolone": „lozinka prelazi levo na njeno mesto, a Privatnost tekst iz priloga
 * ide u desni stubac pored boksa za lozinku [...] u desni stubac treba da dođe u njenoj visini Tekst o
 * sebi boks"), <b>the two of a row as tall as each other, and on a telephone one under the other</b>
 * (the UI standard of the repository, `CLAUDE.md`). Beside is asked as the same top, the same bottom,
 * and the first's right edge not past the second's left; under is asked as the same left edge and the
 * second's top not above the first's bottom. Asked for a member whose fee stands. Somebody who has not
 * paid is not drawn the settings since 23.10.2026 (PDL 22.10.2026), so his arrangement is not asked.
 * <li><b>No empty space under the field for choosing a picture, and none between the box for the words
 * about himself and the button</b> (his words: „veliki prazan prostor"). The cause was
 * `.rankings__field--wide { flex: 1 1 14rem }` meeting a column, where the basis is a HEIGHT: each field
 * stood 224px tall around a control that is 30px (`pages/member/Member.css`). Asked as a relation, not
 * as a number: the field ends where its last child ends, and what separates it from the next thing is
 * no more than the panel's own gap.
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
    test(`three rows, the two of each ${columns === 2 ? 'beside' : 'under'} each other, for a member whose fee stands, ${label(at)}`, async ({ open: opener }) => {
      const { page, probe } = await open(opener, at, A_MEMBER)

      await page.locator(PANELS.mail).waitFor({ state: 'visible' })
      await page.locator(PANELS.privacy).waitFor({ state: 'visible' })
      await page.locator(PANELS.bio).waitFor({ state: 'visible' })

      expect(await pairsAreTwoColumns(page), 'the width reads the arrangement it was chosen for').toBe(columns)

      await expectPair(page, PANELS.password, PANELS.privacy, columns, 'the password and the privacy')
      await expectPair(page, PANELS.picture, PANELS.bio, columns, 'the picture and the words about himself')
      await expectPair(page, PANELS.theme, PANELS.mail, columns, 'the theme and the language of the mail')

      expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
      expect(probe.sideways, 'the page scrolls sideways').toBe(0)
    })
  }
}

/** The field that takes what is left of a row, and what comes after it, in one panel. */
const gapAfterTheField = (page: Page, panel: string) =>
  page.evaluate((selector) => {
    const section = document.querySelector(selector)
    const field = section?.querySelector('.rankings__field--wide')
    /* The next thing that is IN the flow: a visually hidden sibling (the picture measured off the
       screen) is taken out of it and stands nowhere that matters. */
    let next = field?.nextElementSibling ?? null

    while (next !== null && getComputedStyle(next).position === 'absolute') {
      next = next.nextElementSibling
    }

    if (section === null || section === undefined || field === null || field === undefined || next === null) {
      return null
    }

    const box = field.getBoundingClientRect()
    /* What the field holds, where it ends: the lowest bottom of a child that is IN the flow. A visually
       hidden child (the live region of the box for the words) is taken out of it and stands wherever its
       static position happens to be, which is above the field's own top. */
    const held = Math.max(
      ...[...field.children]
        .filter((one) => getComputedStyle(one).position !== 'absolute')
        .map((one) => one.getBoundingClientRect().bottom),
    )

    return {
      height: box.height,
      /* How much of the field is below what it holds: nothing, when it is exactly as tall as that. */
      emptyTail: box.bottom - held,
      /* What stands between the field and the next thing, which is the panel's own gap and nothing else. */
      between: next.getBoundingClientRect().top - box.bottom,
      /* The gap, and the margin the next thing asks for above itself: both are spacing somebody wrote. */
      panelGap: Number.parseFloat(getComputedStyle(section).rowGap) + Number.parseFloat(getComputedStyle(next).marginTop),
    }
  }, panel)

for (const at of [...BESIDE, ...UNDER]) {
  for (const [name, panel] of [
    ['for choosing a picture', PANELS.picture],
    ['for the words about himself', PANELS.bio],
  ] as const) {
    test(`there is no empty space under the field ${name}, ${label(at)}`, async ({ open: opener }) => {
      const { page } = await open(opener, at, A_MEMBER)

      await page.locator(panel).waitFor({ state: 'visible' })
      await page.locator(`${panel} .rankings__field--wide`).waitFor({ state: 'visible' })

      const seen = await gapAfterTheField(page, panel)

      if (seen === null) {
        throw notMeasured(`${panel} did not draw a field with something after it`)
      }

      expect(seen.height, 'the field has a height').toBeGreaterThan(0)
      expect(seen.emptyTail, 'the field is taller than what it holds').toBeLessThanOrEqual(SLACK)
      expect(seen.between, 'more than the panel’s own gap stands between the field and what follows it').toBeLessThanOrEqual(
        seen.panelGap + SLACK,
      )
    })
  }
}
