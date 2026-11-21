import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { inYearlyWindow } from '../src/data/season.ts'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE HEAD OF A PROFILE, ITS PARTS, THE SEASON AND THE INVITATION, ASKED OF CHROME (owner, 21.11.2026, PDL
 * „Zaglavlje profila: izbor „Godina” (podrazumevano „Sve”) stoji u redu sa karticama, desno, na svim uređajima;
 * „Pozovi u tim” postaje ikonica na kraju reda sa imenom"; ADL A63). It replaces the guard of 06.11.2026, which
 * asked where the buttons stood in the row of the parts: they stand in the row of the name now.
 *
 * <p>What it holds, where jsdom cannot say it (`pages/profile/invitesInTheRow.test.tsx` holds the document):
 *
 * <ol>
 * <li><b>THE PARTS AND THE SEASON IN ONE ROW</b>, at the browser's own text and at every width: the season
 * overlaps a part vertically and stands to the right of every part it overlaps.
 * <li><b>ON A TELEPHONE THE WORD „GODINA" IS NOT DRAWN</b> (a box of a pixel) and is still the name of the field;
 * from 560px it is drawn.
 * <li><b>„POZOVI U TIM" IS AN ICON AT THE END OF THE ROW OF THE NAME</b>: no wider than a square, at least 24px
 * on each side (WCAG 2.2 SC 2.5.8), level with the name, ending where the row ends, above the belt of the parts
 * and with no word drawn in it, and named „Pozovi u tim" for a reader who hears it.
 * <li><b>THREE PARTS AND THE SEASON ON A TELEPHONE</b>: where they do not fit in one row (360px at the browser's
 * own text, measured below), „Podaci" is an icon beside the invitation and the parts are two; from 768 it is a part.
 * <li><b>THE FILTER OF THE RACES</b> at 768 and 1280 is as wide as its buttons ask and starts where its parent
 * does; at 360 it is the whole row, as it was.
 * <li><b>The page does not move sideways and nothing of the head runs off its edge</b>, at 360px at the
 * browser's own text and at 200%, a tablet, and a desktop at both (PDL P24, WCAG 2.2 SC 1.4.10).
 * </ol>
 *
 * <p><b>Relations, never pixels</b>, as in `settings.geometry.ts`.
 */

const MOCK = new URL('../src/test/mock/', import.meta.url)
const file = (name: string): unknown => JSON.parse(readFileSync(new URL(name, MOCK), 'utf-8'))

type Row = Record<string, unknown> & { memberNumber: string; active: boolean }

const isRow = (one: unknown): one is Row =>
  typeof one === 'object' &&
  one !== null &&
  typeof Reflect.get(one, 'memberNumber') === 'string' &&
  typeof Reflect.get(one, 'active') === 'boolean'

const MEMBERS: Row[] = (() => {
  const all = file('competitors.json')

  return Array.isArray(all) ? all.filter(isRow).filter((one) => one.active) : []
})()

const rowOf = (memberNumber: string): Row => {
  const found = MEMBERS.find((one) => one.memberNumber === memberNumber)

  if (found === undefined) {
    throw notMeasured(`member ${memberNumber} is not on the generated list`)
  }

  return found
}

/** The member on the page: a woman with no team and no pair. */
const HER = '000030'

const HER_PAGE = '/sr/takmicar/000030-isidora-zivkovic'

/** A man with no team and no pair: offered „Pozovi u trkački par" alone. */
const ONE_BUTTON = '000002'

/** A man who leads Nišavski maraton klub: offered both. */
const TWO_BUTTONS = '000005'

/** What `/api/me` answers about a member whose fee stands. */
/** What the administration's route says of her, which its form opens with (`profile/TheMembersData.tsx`). */
const HER_DATA = {
  memberNumber: HER,
  firstName: 'Isidora',
  lastName: 'Živković',
  fatherName: 'Petar',
  gender: 'F',
  birthDate: '1990-04-02',
  idNumber: 'AB12345',
  email: 'isidora@primer.rs',
  emailConfirmed: true,
  address: 'Bulevar Pupina 10',
  phone: '+381 60 123 456',
  placeId: null,
  city: 'Beograd',
  country: 'RS',
  shirtSize: 'M',
}

const meAs = (memberNumber: string): unknown => {
  const row = rowOf(memberNumber)

  return {
    role: 'competitor',
    account: 1,
    mailLanguage: 'sr',
    seasonsOpenForAReport: [2027],
    member: {
      ...row,
      category: undefined,
      ageBand: '40-54',
      beginner: false,
      categorySeason: 2027,
      membershipBasis: 'payment',
      membershipSeason: 2027,
      referredCount: 0,
      address: 'Bulevar Pupina 10, stan 14, ulaz B',
      phone: '+381 60 123 456',
      shirtSize: 'L',
      fatherName: 'Petar',
      birthDate: '1980-04-02',
      idNumber: 'AB12345',
      viberCommunity: false,
    },
  }
}

/**
 * THE FROZEN SEASON OF THE SAMPLE, WITH TROPHIES OF HERS IN IT, so that her „Priznanja" is taller than the
 * screen: three ducats and no trophy fit in 900px, a desktop then draws no scrollbar, and the harness refuses
 * to measure a desktop without one (`support/harness.ts`).
 */
const FROZEN: unknown = (() => {
  const table = file('frozen-tables.json')

  if (typeof table !== 'object' || table === null) {
    throw notMeasured('the frozen tables of the sample are not a record')
  }

  const hers = (kind: string, category: string | null, position: number) => ({
    kind,
    category,
    position,
    memberNumber: HER,
    who: 'Isidora Živković',
    gender: 'F',
    points: 300 - position,
    teamName: null,
  })

  return {
    ...table,
    awards: [hers('overall', null, 3), hers('category', 'Ž25-39', 2), hers('category', 'Ž R', 2)],
  }
})()

const THE_LISTS: Answers = {
  '/api/competitors': MEMBERS,
  '/api/teams': file('teams.json'),
  '/api/pairs': [],
  '/api/results': file('results.json'),
  /* The races the league does not score, which the profile reads beside `results` since 14.11.2026; left
     out, the page never finishes reading and the row of the parts is never drawn. */
  '/api/unscored-results': file('unscored-results.json'),
  '/api/ducats': file('ducats.json'),
  /* HER THREE DUCATS, as the server awarded them (`DucatAwardApi`, since 13.11.2026). Until then the page
     worked three out of `results.json` itself; the page now reads this address, and an address left out of
     this list is a 404 that leaves „Priznanja" undrawn. */
  [`/api/ducat-awards/${HER}`]: [
    { ducat: 'duk-sve-trke', value: 100, tier: 3, season: null, month: null },
    { ducat: 'duk-krace-trke', value: 100, tier: 3, season: null, month: null },
    { ducat: 'duk-drzave', value: 10, tier: 3, season: null, month: null },
  ],
  '/api/frozen-seasons': [{ season: 2027 }],
  '/api/frozen-tables/2027': FROZEN,
  '/api/me/applications': {
    teamApplications: [],
    teamInvitations: [],
    teamProposals: [],
    pairInvites: [],
    alreadyInATeam: false,
    seasonToPayFor: null,
  },
  '/api/teams/2/invitations': [],
}

type Reader = { name: string; pair: boolean; team: boolean; data: boolean; answers: Answers }

/** The superadmin, who races for nobody and holds every right, so he is offered the card „Podaci" of a member. */
const THE_SUPERADMIN = { role: 'superadmin', account: 11, mailLanguage: 'sr' }

const READERS: Reader[] = [
  { name: 'a visitor', pair: false, team: false, data: false, answers: THE_LISTS },
  /* THE MEMBER ON HER OWN PROFILE: two parts and no invitation (owner, 07.11.2026). */
  { name: 'the member on her own page', pair: false, team: false, data: false, answers: { ...THE_LISTS, '/api/me': meAs(HER) } },
  /* THE ADMINISTRATION: „Podaci" is his on somebody else's profile, and he races for nobody. */
  { name: 'the administration', pair: false, team: false, data: true, answers: { ...THE_LISTS, '/api/me': THE_SUPERADMIN } },
  {
    name: 'a member who may ask her into a pair',
    pair: true,
    team: false,
    data: false,
    answers: { ...THE_LISTS, '/api/me': meAs(ONE_BUTTON) },
  },
  {
    name: 'a member who may ask her into a pair and into his team',
    pair: true,
    team: true,
    data: false,
    answers: { ...THE_LISTS, '/api/me': meAs(TWO_BUTTONS) },
  },
]

const PARTS = [
  /* `ready` is what only that part draws, under the head, so the page is read once it is whole. */
  { part: 'Rezultati', path: HER_PAGE, ready: '#profile-results' },
  { part: 'Priznanja', path: `${HER_PAGE}/priznanja`, ready: '#awards-trophies' },
] as const

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 360, text: 200 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
]

/** The width under which three parts and the season are not in one row at the browser's own text
 *  (`THREE_PARTS_DO_NOT_FIT`, `pages/profile/ProfileHead.tsx`): 24em. */
const THREE_PARTS_FIT_FROM = 24

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number }

type Measured = {
  viewport: number
  root: number
  row: Box
  name: Box
  /** The links of the nav of the parts. */
  tabs: Box[]
  /** Every control of the head that is not a part and not the season: the icons and the word of the pair. */
  acts: (Box & { name: string; text: string; icon: boolean; link: boolean })[]
  season: Box | null
  /** The box of the word „Godina", which is a pixel on a telephone. */
  seasonWord: Box | null
  head: Box[]
  filter: { group: Box; parent: Box; buttons: Box[] } | null
}

/** Every box of the head this guard reads, in one pass over the page. */
const measure = (page: Page): Promise<Measured | null> =>
  page.evaluate(() => {
    const boxOf = (one: Element) => {
      const box = one.getBoundingClientRect()

      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height }
    }
    const nav = document.querySelector('nav[aria-label="Delovi profila"]')
    const row = document.querySelector('.profile__top')
    const name = document.querySelector('.profile__top h1')

    if (nav === null || row === null || name === null) {
      return null
    }

    const acts = [...row.querySelectorAll('.profile__acts > *')]
      .filter((one) => one.matches('button, a'))
      .map((one) => ({
        ...boxOf(one),
        name: one.getAttribute('aria-label') ?? one.textContent ?? '',
        text: (one.textContent ?? '').trim(),
        icon: one.classList.contains('profile__act--icon'),
        link: one.tagName === 'A',
      }))
    const season = document.querySelector('.profile__top select')
    const word = document.querySelector('.profile__season .rankings__field > span')
    const group = document.querySelector('.profile__results .seg')

    return {
      viewport: document.documentElement.clientWidth,
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      row: boxOf(row),
      name: boxOf(name),
      tabs: [...nav.querySelectorAll('a')].map(boxOf),
      acts,
      season: season === null ? null : boxOf(season),
      seasonWord: word === null ? null : boxOf(word),
      head: [...row.querySelectorAll('h1, a, button, select')].map(boxOf),
      filter:
        group === null || group.parentElement === null
          ? null
          : {
              group: boxOf(group),
              parent: boxOf(group.parentElement),
              buttons: [...group.querySelectorAll('.seg__b')].map(boxOf),
            },
    }
  })

/** What every arrangement of the head owes, whatever stands in it. */
function standsInsideThePage(measured: Measured, probe: { widened: number; sideways: number }): void {
  for (const box of measured.head) {
    expect(box.left, 'something of the head starts left of the page').toBeGreaterThanOrEqual(-SLACK)
    expect(box.right, 'something of the head runs off the right edge').toBeLessThanOrEqual(measured.viewport + SLACK)
  }

  expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
  expect(probe.sideways, 'the page scrolls sideways').toBe(0)
}

const overlapsVertically = (one: Box, other: Box): boolean => one.top < other.bottom - SLACK && one.bottom > other.top + SLACK

const overlapsHorizontally = (one: Box, other: Box): boolean => one.left < other.right - SLACK && one.right > other.left + SLACK

for (const at of WIDTHS) {
  for (const { part, path, ready } of PARTS) {
    for (const reader of READERS) {
      test(`„${part}" for ${reader.name}: the parts and the season in one row, the invitation at the end of the name, ${label(at)}`, async ({
        open,
        theDay,
      }) => {
        test.skip(
          reader.team && !inYearlyWindow(theDay),
          `„Pozovi u tim" is offered only inside the transfer window, and ${theDay} is outside it`,
        )

        const { page, probe } = await open(at, path, ready, reader.answers)

        if (reader.pair) {
          await page.getByRole('button', { name: 'Pozovi u trkački par' }).waitFor({ state: 'visible', timeout: 15_000 })
        }

        if (reader.team) {
          /* By NAME: a button that carries no word is found by what it is called, and an icon that lost its
             name is not found at all, which is what this line is for. */
          await page.getByRole('button', { name: 'Pozovi u tim' }).waitFor({ state: 'visible', timeout: 15_000 })
        }

        if (reader.data) {
          await page.getByRole('link', { name: 'Podaci' }).waitFor({ state: 'visible', timeout: 15_000 })
        }

        const measured = await measure(page)

        if (measured === null) {
          throw notMeasured(`„${part}" drew no head with its parts`)
        }

        /* THREE PARTS ARE NOT IN THE ROW WHERE THE ROW HAS NO ROOM FOR THEM: „Podaci" is then an icon. */
        const dataAsIcon = reader.data && at.width / (16 * (at.text / 100)) < THREE_PARTS_FIT_FROM
        const expectedTabs = reader.data && !dataAsIcon ? 3 : 2

        expect(measured.tabs, 'how many parts stand in the row').toHaveLength(expectedTabs)
        expect(measured.season, 'the season stands in the head').not.toBeNull()

        const season = measured.season

        if (season === null) {
          throw notMeasured(`„${part}" drew no season`)
        }

        /* THE PARTS AND THE SEASON IN ONE ROW (owner, 21.11.2026) wherever the row is planned to hold both: at
           the browser's own text, which is the case asked ("pri tekstu od 100 odsto"). At 200% the belt wraps by
           design, so the season may fall under the parts, and the page must still not move sideways. */
        if (at.text === 100) {
          const beside = measured.tabs.filter((one) => overlapsVertically(season, one))

          expect(beside.length, 'the season is not in the row of any part').toBeGreaterThan(0)

          for (const one of beside) {
            expect(season.left, 'the season does not stand to the right of a part it shares a row with').toBeGreaterThanOrEqual(one.right - SLACK)
          }

          const shortest = Math.min(...measured.tabs.map((one) => one.height))

          for (const one of measured.tabs) {
            expect(one.height - shortest, 'a part is taller than another, so it wrapped its own words').toBeLessThanOrEqual(SLACK)
          }

          expect(Math.abs(season.right - measured.row.right), 'the season does not end where the row ends').toBeLessThanOrEqual(SLACK)
        }

        /* THE WORD „GODINA": not drawn on a telephone, drawn from 560px, and in both the name of the field. */
        const word = measured.seasonWord

        if (word === null) {
          throw notMeasured(`„${part}" drew no word for the season`)
        }

        if (at.width < 560) {
          expect(word.width, 'the word „Godina" is drawn on a telephone').toBeLessThanOrEqual(1 + SLACK)
        } else {
          expect(word.width, 'the word „Godina" is not drawn where there is room').toBeGreaterThan(8)
        }

        await expect(page.getByLabel('Godina'), 'the season has lost its name').toHaveCount(1)

        /* THE ICONS: at the end of the row of the name, square, above the belt, and no word in them. */
        const icons = measured.acts.filter((one) => one.icon)
        const wordsOfActs = measured.acts.filter((one) => !one.icon)

        expect(icons, 'how many icons stand at the end of the row of the name').toHaveLength((reader.team ? 1 : 0) + (dataAsIcon ? 1 : 0))
        expect(wordsOfActs, 'how many buttons with words stand in the row of the name').toHaveLength(reader.pair ? 1 : 0)

        for (const icon of icons) {
          expect(icon.text, `„${icon.name}" draws a word beside its icon`).toBe('')
          expect(icon.width, `„${icon.name}" is under 24px wide`).toBeGreaterThanOrEqual(24)
          expect(icon.height, `„${icon.name}" is under 24px high`).toBeGreaterThanOrEqual(24)
          expect(Math.abs(icon.width - icon.height), `„${icon.name}" is not a square`).toBeLessThanOrEqual(SLACK)
          /* At 200% the name wraps and the icon may fall under it, still at the right: the row breaks, it does not
             overflow. */
          if (at.text === 100) {
            expect(overlapsVertically(icon, measured.name), `„${icon.name}" is not level with the name`).toBe(true)
          }
          expect(
            overlapsHorizontally(icon, measured.name) && overlapsVertically(icon, measured.name),
            `„${icon.name}" runs into the name`,
          ).toBe(false)

          for (const part of measured.tabs) {
            expect(overlapsVertically(icon, part), `„${icon.name}" stands in the row of the parts`).toBe(false)
          }

          expect(icon.bottom, `„${icon.name}" stands under the belt of the parts`).toBeLessThanOrEqual(season.top + SLACK)
        }

        const last = icons.at(-1)

        if (last !== undefined) {
          expect(Math.abs(measured.row.right - last.right), 'the last icon does not end where the row ends').toBeLessThanOrEqual(SLACK)
        }

        if (dataAsIcon) {
          expect(icons.some((one) => one.link && one.name === 'Podaci'), '„Podaci" is not an icon in the row of the name').toBe(true)
        }

        standsInsideThePage(measured, probe)
      })
    }
  }

  test(`„Podaci" carries neither the season nor a button, ${label(at)}`, async ({ open }) => {
    /* Read by the administration, the one reader the card has since 07.11.2026. */
    const { page, probe } = await open(at, `${HER_PAGE}/podaci`, 'section[aria-labelledby="form-podaci-clana-title"]', {
      ...THE_LISTS,
      '/api/me': THE_SUPERADMIN,
      [`/api/members/${HER}/data`]: HER_DATA,
    })
    const measured = await measure(page)

    if (measured === null) {
      throw notMeasured('„Podaci" drew no head with its parts')
    }

    expect(measured.acts.filter((one) => !one.icon), 'a button with words stands on „Podaci"').toHaveLength(0)
    expect(measured.season, 'the season stands on „Podaci"').toBeNull()
    standsInsideThePage(measured, probe)
  })
}

/** THE FILTER OF THE RACES ON THE PROFILE (owner, 21.11.2026: „na desktopu filter trka na profilu nije širok kao
 *  strana nego koliko mu dugmad traže, levo"). */
const FILTER_WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

for (const at of FILTER_WIDTHS) {
  test(`the filter of the races on the profile is as wide as its buttons ask from a tablet up, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, HER_PAGE, '#profile-results', THE_LISTS)
    const measured = await measure(page)

    if (measured === null || measured.filter === null) {
      throw notMeasured('the profile drew no filter of the races')
    }

    const { group, parent, buttons } = measured.filter

    expect(buttons, 'six buttons').toHaveLength(6)
    expect(group.left, 'the filter does not start where its parent starts').toBeLessThanOrEqual(parent.left + SLACK)

    if (at.width >= 700) {
      const asked = buttons.reduce((sum, one) => sum + one.width, 0)

      /* The buttons, the gap between none of them, and the padding and the border of the group (`.seg`): a few
         pixels, never the width of the page. */
      expect(group.width, 'the filter is wider than its buttons ask').toBeLessThanOrEqual(asked + 12)
      expect(group.width, 'the filter is as wide as the page').toBeLessThan(parent.width - 100)
    } else {
      expect(group.width, 'on a telephone the filter is the whole row').toBeGreaterThanOrEqual(parent.width - SLACK)
    }

    standsInsideThePage(measured, probe)
  })
}
