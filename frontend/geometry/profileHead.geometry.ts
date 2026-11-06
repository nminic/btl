import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { inYearlyWindow } from '../src/data/season.ts'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE HEAD OF A PROFILE, ITS PARTS AND THE INVITATIONS IN THEIR ROW, ASKED OF CHROME (owner, 06.11.2026,
 * PDL „Profil: forma „Podaci" po obliku forme za prijavu"; ADL A63).
 *
 * <p>His words: „malo normalno dugme alignovano desno, istog formata i reda gde se nalaze i Pregled,
 * Priznanja i nagrade, i podaci". `pages/profile/invitesInTheRow.test.tsx` holds where the buttons are in
 * the document and on which parts; this holds where they LAND:
 *
 * <ol>
 * <li><b>In the row of the parts</b>: every button inside the row's box, never under it as a row of its
 * own.
 * <li><b>To the right</b>: the last button ends where the row ends.
 * <li><b>Small</b>: no button is as wide as the row, unless its own words are.
 * <li><b>The format of the parts</b> („istog formata"): the same height as a part, the same letter and the
 * same rounding.
 * <li><b>The page does not move sideways and nothing of the head runs off its edge</b>, at a telephone of
 * 360px at the browser's own text and at 200%, a tablet, and a desktop at both (PDL P24, WCAG 2.2 SC
 * 1.4.10).
 * </ol>
 *
 * <p>Asked with no button (a visitor), with one („Pozovi u trkački par") and with two (and „Pozovi u tim",
 * which is offered only inside the transfer window, so only on a day that is inside it), on „Rezultati",
 * which carries the season, on „Priznanja", and on „Podaci", which carries neither the season nor a button.
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
  '/api/ducats': file('ducats.json'),
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

type Reader = { name: string; buttons: 0 | 1 | 2; answers: Answers }

const READERS: Reader[] = [
  { name: 'a visitor', buttons: 0, answers: THE_LISTS },
  { name: 'a member who may ask her into a pair', buttons: 1, answers: { ...THE_LISTS, '/api/me': meAs(ONE_BUTTON) } },
  {
    name: 'a member who may ask her into a pair and into his team',
    buttons: 2,
    answers: { ...THE_LISTS, '/api/me': meAs(TWO_BUTTONS) },
  },
]

const PARTS = [
  /* `ready` is what only that part draws, under the head, so the page is read once it is whole. */
  { part: 'Rezultati', path: HER_PAGE, season: true, ready: '#profile-results' },
  { part: 'Priznanja', path: `${HER_PAGE}/priznanja`, season: true, ready: '#awards-trophies' },
] as const

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 360, text: 200 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
]

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number }

type Measured = {
  viewport: number
  row: Box
  name: Box
  tabs: (Box & { fontSize: string; fontWeight: string; radius: string })[]
  buttons: (Box & { text: string; natural: number; fontSize: string; fontWeight: string; radius: string })[]
  season: Box | null
  head: Box[]
}

/** Every box of the head this guard reads, in one pass over the page. */
const measure = (page: Page): Promise<Measured | null> =>
  page.evaluate(() => {
    const boxOf = (one: Element) => {
      const box = one.getBoundingClientRect()

      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height }
    }
    const nav = document.querySelector('nav[aria-label="Delovi profila"]')
    const row = nav?.parentElement
    const name = document.querySelector('.profile__top h1')

    if (nav === null || row === null || row === undefined || name === null) {
      return null
    }

    const look = (one: Element) => {
      const style = getComputedStyle(one)

      return { fontSize: style.fontSize, fontWeight: style.fontWeight, radius: style.borderTopLeftRadius }
    }
    const buttons = [...row.querySelectorAll('button')].filter((one) => !nav.contains(one))
    const season = document.querySelector('.profile__top select')

    return {
      viewport: document.documentElement.clientWidth,
      row: boxOf(row),
      name: boxOf(name),
      tabs: [...nav.querySelectorAll('a')].map((one) => ({ ...boxOf(one), ...look(one) })),
      buttons: buttons.map((one) => {
        /* How wide its own words make it, so „not as wide as the row" can be asked of a button whose
           words are shorter than the row and not of one whose words are not. */
        const copy = one.cloneNode(true)

        if (!(copy instanceof HTMLElement)) {
          return { ...boxOf(one), ...look(one), text: one.textContent ?? '', natural: 0 }
        }

        copy.style.position = 'absolute'
        copy.style.width = 'max-content'
        copy.style.visibility = 'hidden'
        one.parentElement?.appendChild(copy)
        const natural = copy.getBoundingClientRect().width
        copy.remove()

        return { ...boxOf(one), ...look(one), text: one.textContent ?? '', natural }
      }),
      season: season === null ? null : boxOf(season),
      head: [...(document.querySelector('.profile__top')?.querySelectorAll('h1, a, button, select') ?? [])].map(boxOf),
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

for (const at of WIDTHS) {
  for (const { part, path, season, ready } of PARTS) {
    for (const reader of READERS) {
      test(`„${part}" for ${reader.name}: ${reader.buttons} button(s) in the row of the parts, ${label(at)}`, async ({
        open,
        theDay,
      }) => {
        test.skip(
          reader.buttons === 2 && !inYearlyWindow(theDay),
          `„Pozovi u tim" is offered only inside the transfer window, and ${theDay} is outside it`,
        )

        const { page, probe } = await open(at, path, ready, reader.answers)

        if (reader.buttons > 0) {
          await page.getByRole('button', { name: 'Pozovi u trkački par' }).waitFor({ state: 'visible', timeout: 15_000 })
        }

        if (reader.buttons > 1) {
          await page.getByRole('button', { name: 'Pozovi u tim' }).waitFor({ state: 'visible', timeout: 15_000 })
        }

        const measured = await measure(page)

        if (measured === null) {
          throw notMeasured(`„${part}" drew no head with its parts`)
        }

        expect(measured.buttons, 'how many buttons stand in the row').toHaveLength(reader.buttons)
        expect(measured.season !== null, 'whether the season stands in the head').toBe(season)

        const tab = measured.tabs[0]

        if (tab === undefined) {
          throw notMeasured(`„${part}" drew no parts`)
        }

        for (const button of measured.buttons) {
          expect(button.top, `„${button.text}" stands above the row`).toBeGreaterThanOrEqual(measured.row.top - SLACK)
          expect(button.bottom, `„${button.text}" stands under the row`).toBeLessThanOrEqual(measured.row.bottom + SLACK)
          /* As tall as a part wherever its words fit on one line of the row. At 360px and 200% text
             „Pozovi u trkački par" does not, and wraps inside the button rather than pushing the page
             sideways, which is what WCAG 2.2 SC 1.4.10 asks for. */
          if (button.natural <= measured.row.width + SLACK) {
            expect(Math.abs(button.height - tab.height), `„${button.text}" is not as tall as a part`).toBeLessThanOrEqual(SLACK)
          }
          expect(button.fontSize, `„${button.text}" is not in the letter of the parts`).toBe(tab.fontSize)
          expect(button.fontWeight, `„${button.text}" is not in the weight of the parts`).toBe(tab.fontWeight)
          expect(button.radius, `„${button.text}" is not rounded as the parts are`).toBe(tab.radius)
          expect(
            button.width,
            `„${button.text}" is wider than its own words, so it was stretched`,
          ).toBeLessThanOrEqual(Math.min(button.natural, measured.row.width) + SLACK)
        }

        const last = measured.buttons.at(-1)

        if (last !== undefined) {
          expect(Math.abs(measured.row.right - last.right), 'the last button does not end where the row ends').toBeLessThanOrEqual(SLACK)
        }

        standsInsideThePage(measured, probe)
      })
    }
  }

  test(`„Podaci" carries neither the season nor a button, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, `${HER_PAGE}/podaci`, 'section[aria-labelledby="account-personal"]', {
      ...THE_LISTS,
      '/api/me': meAs(HER),
    })
    const measured = await measure(page)

    if (measured === null) {
      throw notMeasured('„Podaci" drew no head with its parts')
    }

    expect(measured.buttons, 'a button stands on „Podaci"').toHaveLength(0)
    expect(measured.season, 'the season stands on „Podaci"').toBeNull()
    standsInsideThePage(measured, probe)
  })
}
