import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PHONE_HEADER } from '../src/app/phoneHeader.ts'
import { THE_OTHER_DAY_THE_SUITE_IS_READ_AS } from '../src/test/theDay.ts'
import { label, notMeasured, SLACK, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE CARDS OF THE TABLES AND THE SEASON STAND ON THE SAME PIXEL ON ALL THREE CARDS, IN THE ORDER THE
 * OWNER NAMED, AND „PRIJAVI TIM” STANDS UNDER THE TABLE OF THE TEAMS.
 *
 * Owner, 31.07.2026 (ADL A7): „navigacija se ne sme pomerati tokom klikova, boksovi i naslovi moraju da
 * se gađaju u piksel". The cards Muškarci, Žene and Timovi are the navigation between three screens
 * (`src/pages/TableCards.tsx`), so pressing one must not move the row under the pointer.
 *
 * Owner, 17.11.2026: on a telephone „u gornjem redu naslov BTL tabele levo i dropdown sezone desno, a u
 * jednom redu ispod [...] Muskarci, Zene”; „Dugme Prijavi tim ne treba da se nadje gde se trenutno nalazi,
 * nego ispod tabele sa svim timovima”; and „Timovi dugme treba da bude na kraju, nakon Muskarci i Zene, a
 * Muskarci ponovo treba da postanu default.” Nothing changeable stands above the cards any more, so they
 * stand on the same pixel by themselves; what is held is that it stays so, and that the button is under
 * the table and not above it.
 *
 * Asked of every reader the teams draw differently: a visitor, a member with a team and a member with
 * none, on both days of the suite. On one of them the transfer window is shut and a member with no team
 * is told when he may found one; on the other it is open and he is offered the button.
 * **Everything here is found by what a reader meets or by where it stands in the row, never by a class**:
 * the class is what places it, so an expectation read from it would agree with whatever the class did.
 */

function sample<T>(name: string): T {
  const read: T = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'),
  )

  return read
}

type Row = { memberNumber: string; firstName: string; lastName: string; gender: string; city: string; country: string; teamId: number | null }

const COMPETITORS = sample<Row[]>('competitors')

/** What `GET /api/me` answers for one member of the sample, in the shape the session reads. */
function signedInAs(memberNumber: string): Answers {
  const row = COMPETITORS.find((one) => one.memberNumber === memberNumber)

  if (row === undefined) {
    throw notMeasured(`the sample has no member ${memberNumber}`)
  }

  return {
    '/api/me': {
      role: 'competitor',
      account: Number(memberNumber),
      mailLanguage: 'sr',
      member: {
        memberNumber,
        country: row.country,
        firstSeason: 2027,
        membershipBasis: 'payment',
        active: true,
        referralCode: '7f07b38ff7ee7543',
        referredCount: 0,
        firstName: row.firstName,
        lastName: row.lastName,
        gender: row.gender,
        city: row.city,
        ageBand: '40-54',
        beginner: false,
        categorySeason: 2027,
        categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
        bio: '',
        profileHidden: false,
        birthdayShown: 'none',
        address: '',
        phone: '',
        shirtSize: 'L',
      },
    },
  }
}

type Team = { id: number; slug: string; name: string }

const SAMPLE_TEAMS = sample<Team[]>('teams')

/* THIRTY TEAMS MORE, with no member: the sample's four make a page shorter than a desktop window, and a
   page that does not scroll draws no scrollbar, so its boxes are as wide as no reader's (the harness
   refuses to measure it). A team with no member still has its row in the standing. */
const MORE_TEAMS: Team[] = Array.from({ length: 30 }, (_, index) => {
  const model = SAMPLE_TEAMS[index % SAMPLE_TEAMS.length]

  if (model === undefined) {
    throw notMeasured('the sample has no team to copy')
  }

  return { ...model, id: 1000 + index, slug: `probni-tim-${String(index)}`, name: `Probni tim ${String(index)}`, logo: null, smallLogo: null, crop: null }
})

const DATA: Answers = {
  '/api/competitors': COMPETITORS,
  '/api/results': sample('results'),
  '/api/teams': [...SAMPLE_TEAMS, ...MORE_TEAMS],
  '/api/frozen-seasons': [],
}

/* 000002 has no team in the sample, 000001 is in one. Read off the sample rather than trusted. */
const WITHOUT_A_TEAM = '000002'
const IN_A_TEAM = '000001'

if (COMPETITORS.find((one) => one.memberNumber === WITHOUT_A_TEAM)?.teamId !== null) {
  throw notMeasured(`${WITHOUT_A_TEAM} is in a team in the sample`)
}

if (COMPETITORS.find((one) => one.memberNumber === IN_A_TEAM)?.teamId == null) {
  throw notMeasured(`${IN_A_TEAM} is in no team in the sample`)
}

const WITH_NO_TEAM = 'a member with no team'

const READERS: [name: string, answers: Answers][] = [
  ['a visitor', DATA],
  [WITH_NO_TEAM, { ...DATA, ...signedInAs(WITHOUT_A_TEAM) }],
  ['a member in a team', { ...DATA, ...signedInAs(IN_A_TEAM) }],
]

/* The widths and text sizes the row is held at. The first six are the portal's three widths at both text
   sizes. Then the two sides of 700px, where the shape of a telephone ends, and the wide windows with a
   larger text, where the column of the content stops at 1100px while the window goes on and a query in
   `em` turns over with the text: 1280px at 200% is read as 640 and is a telephone, 1640px at 200% as 820
   and is not. */
const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 360, text: 200 },
  { width: 320, text: 100 },
  { width: 320, text: 150 },
  { width: 360, text: 150 },
  { width: 375, text: 100 },
  { width: 375, text: 150 },
  { width: 414, text: 100 },
  { width: 414, text: 150 },
  { width: 768, text: 100 },
  { width: 768, text: 200 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
  { width: 699, text: 100 },
  { width: 700, text: 100 },
  { width: 810, text: 100 },
  { width: 1920, text: 100 },
  { width: 1440, text: 125 },
  { width: 1280, text: 150 },
  { width: 1366, text: 150 },
  { width: 1440, text: 150 },
  { width: 1920, text: 150 },
  { width: 1920, text: 175 },
  { width: 1640, text: 200 },
  { width: 1920, text: 200 },
  { width: 2560, text: 200 },
]

/* WHERE THE HEADING AND THE SEASON DO NOT FIT ON ONE LINE ON A TELEPHONE, written out cell by cell and
   not read off the page: there the season goes to a line of its own, at the right, still above the row
   of the cards (`Rankings.css`), instead of being drawn over the heading. Everywhere else on a telephone
   it is level with the heading, as the owner asked, except 320px at the reader's own text size: there the
   season goes to its own line too, since the new arrow of the dropdowns (owner's decision, 23.11.2026)
   leaves it no room beside the heading. */
const SEASON_UNDER_THE_HEADING = new Set(['360/200', '320/100', '320/150', '360/150', '375/150'])

const CARDS = '[role="group"][aria-label="BTL tabele"]'

type Box = { x: number; y: number; width: number; height: number }

/** Where the three cards and the season stand, read off the page as it was drawn. */
async function whereTheyStand(page: Page): Promise<{ cards: Box[]; season: Box }> {
  return page.evaluate((selector) => {
    const box = (element: Element): Box => {
      const { x, y, width, height } = element.getBoundingClientRect()

      return { x: x + scrollX, y: y + scrollY, width, height }
    }
    const group = document.querySelector(selector)
    const season = [...document.querySelectorAll('label')].find((one) => one.textContent?.startsWith('Sezona'))

    if (group === null || season === undefined) {
      throw new Error('NOT MEASURED: the screen drew no cards or no season')
    }

    return { cards: [...group.querySelectorAll('a')].map(box), season: box(season) }
  }, CARDS)
}

/* Read in the order of reading: on the same line, from the left; on a later line, below. */
const readBefore = (a: Box, b: Box) =>
  a.x + a.width <= b.x + SLACK || a.y + a.height <= b.y + SLACK

for (const [reader, answers] of READERS) {
  for (const at of WIDTHS) {
    test(`the cards and the season do not move from card to card, for ${reader}, ${label(at)}`, async ({ open }) => {
      const seen: [string, { cards: Box[]; season: Box }][] = []

      for (const path of ['/sr/tabela', '/sr/tabela?pol=z', '/sr/timovi']) {
        const { page, probe } = await open(at, path, CARDS, answers)

        expect(probe.sideways, `${path} scrolls sideways`).toBe(0)
        expect(probe.widened, `${path} was widened by something running off its right edge`).toBe(0)
        seen.push([path, await whereTheyStand(page)])
      }

      const [first, ...rest] = seen

      if (first === undefined || first[1].cards.length !== 3) {
        throw notMeasured('the tables drew no three cards')
      }

      for (const [path, standing] of rest) {
        expect(standing, `${path} against ${first[0]}`).toEqual(first[1])
      }

      /* Every card can be pressed: no target under 24 by 24 (WCAG 2.2 SC 2.5.8). */
      for (const card of first[1].cards) {
        expect(Math.min(card.width, card.height), 'a card is smaller than 24 by 24').toBeGreaterThanOrEqual(24)
      }
    })
  }

  /* AND EACH THING STANDS WHERE THE OWNER PUT IT: Muškarci, Žene and Timovi, the season after them on a wide
     screen and beside the heading on a telephone, with the row of the cards under it; and on the teams,
     „Prijavi tim” or the sentence of a shut window UNDER THE TABLE, never above it. */
  for (const at of WIDTHS) {
    test(`the row and the button stand in the owner's order, for ${reader}, ${label(at)}`, async ({ open, theDay }) => {
      for (const path of ['/sr/tabela', '/sr/timovi']) {
        const { page } = await open(at, path, CARDS, answers)
        const phone = await page.evaluate((query) => matchMedia(query).matches, PHONE_HEADER)

        /* The shape is the header's, and the header's is a telephone under 700px of the reader's text. */
        expect(phone, 'the shape of a telephone is not where 700px of text is').toBe((at.width * 100) / at.text < 700)

        const seen = await page.evaluate((selector) => {
          const group = document.querySelector(selector)
          const heading = document.querySelector('h1')
          const season = [...document.querySelectorAll('label')].find((one) => one.textContent?.startsWith('Sezona'))

          if (group === null || heading === null || season === undefined) {
            throw new Error('NOT MEASURED: no cards, no heading or no season')
          }

          const words = document.createRange()

          words.selectNodeContents(heading)

          const rect = (one: DOMRect) => ({ x: one.left, y: one.top, width: one.width, height: one.height })

          return {
            words: rect(words.getBoundingClientRect()),
            season: rect(season.getBoundingClientRect()),
            cards: [...group.querySelectorAll('a')].map((one) => [one.textContent, rect(one.getBoundingClientRect())] as const),
          }
        }, CARDS)

        expect(seen.cards.map(([name]) => name), 'the order of the cards').toEqual(['Muškarci', 'Žene', 'Timovi'])

        const [men, women, teams] = seen.cards.map(([, box]) => box)

        if (teams === undefined || men === undefined || women === undefined) {
          throw notMeasured('the tables drew no three cards')
        }

        expect(readBefore(men, women) && readBefore(women, teams), 'the cards are not read Muškarci, Žene, Timovi').toBe(true)

        const overlap = (a: Box, b: Box) =>
          a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

        for (const one of [men, women, teams, seen.season]) {
          expect(overlap(one, seen.words), 'something of the row is drawn over the heading').toBe(false)
        }

        if (phone) {
          expect(seen.season.y + seen.season.height, 'the season is not above the row of the cards').toBeLessThanOrEqual(
            Math.min(men.y, women.y, teams.y) + SLACK,
          )

          const level = seen.season.y < seen.words.y + seen.words.height && seen.words.y < seen.season.y + seen.season.height

          expect(level, 'the season is level with the heading').toBe(!SEASON_UNDER_THE_HEADING.has(`${String(at.width)}/${String(at.text)}`))

          if (level) {
            expect(seen.season.x, 'the season is not right of the heading').toBeGreaterThanOrEqual(seen.words.x + seen.words.width)
          }
        } else {
          expect(readBefore(teams, seen.season), 'the season is not after Timovi').toBe(true)
        }
      }

      /* „PRIJAVI TIM”, OR THE SENTENCE OF A SHUT WINDOW, UNDER THE TABLE OF THE TEAMS, on the screen, and to
         nobody but a member with no team. Found by what a reader meets, never by a class. */
      const windowOpen = theDay === THE_OTHER_DAY_THE_SUITE_IS_READ_AS
      const { page } = await open(at, '/sr/timovi', CARDS, answers)
      const button = page.getByRole('link', { name: 'Prijavi tim', exact: true })
      const sentence = page.getByText('Tim se osniva u prelaznom roku', { exact: false })
      const offered = reader === WITH_NO_TEAM

      expect(await button.count(), 'the button').toBe(offered && windowOpen ? 1 : 0)
      expect(await sentence.count(), 'the sentence').toBe(offered && !windowOpen ? 1 : 0)

      if (!offered) {
        return
      }

      const where = await (windowOpen ? button : sentence).evaluate((element) => {
        const table = document.querySelector('table')

        if (table === null) {
          throw new Error('NOT MEASURED: the teams drew no table')
        }

        const box = element.getBoundingClientRect()
        /* `--space-16`, as the browser resolves it at this text size: a probe that is as wide as it, read off its box. */
        const probe = document.createElement('div')

        probe.style.inlineSize = 'var(--space-16)'
        probe.style.position = 'absolute'
        document.body.append(probe)

        const sixteen = probe.getBoundingClientRect().width

        probe.remove()

        return {
          gap: box.top - table.getBoundingClientRect().bottom,
          sixteen,
          underTheTable: box.top >= table.getBoundingClientRect().bottom,
          left: box.left,
          right: box.right,
          width: document.documentElement.clientWidth,
          height: box.height,
          boxWidth: box.width,
        }
      })

      expect(where.underTheTable, 'it is not under the table').toBe(true)
      /* **The gap above it is `--space-16` and not only „not nothing”** (review of PR 804, medium 1: `box.top >=
         table.bottom` is met by 0px as well, the gap the sentence stood with when two rules argued over it). The
         button and the sentence are asked alike, since the sentence is the button's box (`.rankings__propose`). */
      expect(where.sixteen, 'the probe resolved no space').toBeGreaterThan(0)
      expect(where.gap, 'the gap under the table is not --space-16').toBeCloseTo(where.sixteen, 0)
      expect(where.left, 'it starts left of the screen').toBeGreaterThanOrEqual(0)
      expect(where.right, 'it runs off the right edge of the screen').toBeLessThanOrEqual(where.width)

      if (windowOpen) {
        expect(Math.min(where.height, where.boxWidth), 'the button is smaller than 24 by 24').toBeGreaterThanOrEqual(24)
        expect(await button.evaluate((one) => one.tabIndex), 'the button is out of the order of the keyboard').toBe(0)
      }
    })
  }
}
