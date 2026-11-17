import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PHONE_HEADER } from '../src/app/phoneHeader.ts'
import { THE_OTHER_DAY_THE_SUITE_IS_READ_AS } from '../src/test/theDay.ts'
import { label, notMeasured, SLACK, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE CARDS OF THE TABLES, THE SEASON AND THE PLACE OF „PRIJAVI TIM” STAND ON THE SAME PIXEL ON ALL THREE
 * CARDS, IN THE ORDER THE OWNER NAMED.
 *
 * Owner, 31.07.2026 (ADL A7): „navigacija se ne sme pomerati tokom klikova, boksovi i naslovi moraju da
 * se gađaju u piksel". The cards Timovi, Muškarci and Žene are the navigation between three screens
 * (`src/pages/TableCards.tsx`), so pressing one must not move the row under the pointer.
 *
 * Owner, 17.11.2026: „Zelim da se zameni redosled dugmica na BTL tabele tako da uvek idu Predlozi tim
 * (ako postoji), pa Timovi (default), pa Muskarci, pa Zene, pa drop down godine. Ukoliko se otvara na
 * mobilnom, u gornjem redu naslov BTL tabele levo i dropdown sezone desno, a u jednom redu ispod Predlozi
 * tim ako postoji, Timovi (default), Muskarci, Zene.” The button is „Prijavi tim” and only on the teams
 * (answer 1), and on the men and the women an invisible place of its width stands where it stands
 * (answer 3), which is what keeps the cards on the same pixel when the row wraps.
 *
 * Asked of every reader the teams draw differently: a visitor, a member with a team and a member with
 * none, on both days of the suite. On one of them the transfer window is shut and a member with no team
 * is told when he may found one, under the cards; on the other it is open and he is offered the button.
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
   it is level with the heading, as the owner asked. */
const SEASON_UNDER_THE_HEADING = new Set(['360/200'])

/** The words a reader meets, by language. */
const WORDS = {
  sr: { cards: 'BTL tabele', season: 'Sezona', button: 'Prijavi tim', teams: 'Timovi', men: 'Muškarci', women: 'Žene' },
  en: { cards: 'BTL tables', season: 'Season', button: 'Register a team', teams: 'Teams', men: 'Men', women: 'Women' },
} as const

type Locale = keyof typeof WORDS

const cardsOf = (locale: Locale) => `[role="group"][aria-label="${WORDS[locale].cards}"]`

type Box = { x: number; y: number; width: number; height: number }

type Standing = {
  /** The three cards, in the order they are drawn. */
  cards: Box[]
  season: Box
  /** What stands before the cards in their row: the button, the place held for it, or nothing. */
  before: Box | null
}

/** Where the cards, the season and whatever stands before the cards are, read off the page as drawn. */
async function whereTheyStand(page: Page, locale: Locale): Promise<Standing> {
  return page.evaluate(
    ([selector, seasonWord]) => {
      const box = (element: Element): Box => {
        const { x, y, width, height } = element.getBoundingClientRect()

        return { x: x + scrollX, y: y + scrollY, width, height }
      }
      const group = document.querySelector(selector)
      const season = [...document.querySelectorAll('label')].find((one) => one.textContent?.startsWith(seasonWord))

      if (group === null || season === undefined) {
        throw new Error('NOT MEASURED: the screen drew no cards or no season')
      }

      const before = group.previousElementSibling

      return { cards: [...group.querySelectorAll('a')].map(box), season: box(season), before: before === null ? null : box(before) }
    },
    [cardsOf(locale), WORDS[locale].season] as const,
  )
}

/* Read in the order of reading: on the same line, from the left; on a later line, below. */
const readBefore = (a: Box, b: Box) =>
  a.x + a.width <= b.x + SLACK || a.y + a.height <= b.y + SLACK

for (const [reader, answers] of READERS) {
  for (const at of WIDTHS) {
    test(`the row does not move from card to card, for ${reader}, ${label(at)}`, async ({ open, theDay }) => {
      const offered = reader === WITH_NO_TEAM && theDay === THE_OTHER_DAY_THE_SUITE_IS_READ_AS
      /* English too for the one reader who has a place held, because the place is as wide as the
         button's words and those are other words in English. */
      const locales: Locale[] = reader === WITH_NO_TEAM ? ['sr', 'en'] : ['sr']

      for (const locale of locales) {
        const seen: [string, Standing][] = []

        for (const path of ['/timovi', '/tabela', '/tabela?pol=z']) {
          const address = `/${locale}${path}`
          const { page, probe } = await open(at, address, cardsOf(locale), answers)

          expect(probe.sideways, `${address} scrolls sideways`).toBe(0)
          expect(probe.widened, `${address} was widened by something running off its right edge`).toBe(0)
          seen.push([address, await whereTheyStand(page, locale)])
        }

        const [first, ...rest] = seen

        if (first === undefined || first[1].cards.length !== 3) {
          throw notMeasured('the tables drew no three cards')
        }

        /* Something stands before the cards exactly where the teams offer the button. */
        for (const [address, standing] of seen) {
          expect(standing.before === null, `${address}: what stands before the cards`).toBe(!offered)
        }

        for (const [address, standing] of rest) {
          expect(standing, `${address} against ${first[0]}`).toEqual(first[1])
        }
      }
    })
  }

  /* AND EACH THING STANDS WHERE THE OWNER PUT IT: the button or its place first, then Timovi, Muškarci
     and Žene, and the season after them on a wide screen and beside the heading on a telephone, with the
     row of the cards under it. Asked on the screen the button is on and on one that holds its place. */
  for (const at of WIDTHS) {
    test(`the row stands in the owner's order, for ${reader}, ${label(at)}`, async ({ open, theDay }) => {
      const windowOpen = theDay === THE_OTHER_DAY_THE_SUITE_IS_READ_AS
      const offered = reader === WITH_NO_TEAM && windowOpen

      for (const path of ['/sr/timovi', '/sr/tabela']) {
        const { page } = await open(at, path, cardsOf('sr'), answers)
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
            before: group.previousElementSibling === null ? null : rect(group.previousElementSibling.getBoundingClientRect()),
          }
        }, cardsOf('sr'))

        expect(seen.cards.map(([name]) => name), 'the order of the cards').toEqual([WORDS.sr.teams, WORDS.sr.men, WORDS.sr.women])

        const [teams, men, women] = seen.cards.map(([, box]) => box)

        if (teams === undefined || men === undefined || women === undefined) {
          throw notMeasured('the tables drew no three cards')
        }

        expect(readBefore(teams, men) && readBefore(men, women), 'the cards are not read Timovi, Muškarci, Žene').toBe(true)

        /* A fault and not a measurement that failed, so it is an assertion: nothing before the cards
           where the teams offer the button is exactly what a place read off the wrong reader draws. */
        expect(seen.before !== null, `${path}: something stands before the cards`).toBe(offered)

        if (seen.before !== null) {
          expect(readBefore(seen.before, teams), 'the button is not before Timovi').toBe(true)
        }

        const overlap = (a: typeof teams, b: typeof teams) =>
          a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

        for (const one of [teams, men, women, seen.season, ...(seen.before === null ? [] : [seen.before])]) {
          expect(overlap(one, seen.words), 'something of the row is drawn over the heading').toBe(false)
        }

        if (phone) {
          const top = Math.min(teams.y, men.y, women.y, ...(seen.before === null ? [] : [seen.before.y]))

          expect(seen.season.y + seen.season.height, 'the season is not above the row of the cards').toBeLessThanOrEqual(top + SLACK)

          const level = seen.season.y < seen.words.y + seen.words.height && seen.words.y < seen.season.y + seen.season.height

          expect(level, 'the season is level with the heading').toBe(!SEASON_UNDER_THE_HEADING.has(`${String(at.width)}/${String(at.text)}`))

          if (level) {
            expect(seen.season.x, 'the season is not right of the heading').toBeGreaterThanOrEqual(seen.words.x + seen.words.width)
          }
        } else {
          expect(readBefore(women, seen.season), 'the season is not after Žene').toBe(true)
        }
      }

      /* THE SENTENCE OF A SHUT WINDOW STANDS UNDER THE CARDS, AND THE BUTTON TAKES THE KEYBOARD. */
      if (reader !== WITH_NO_TEAM) {
        return
      }

      const { page } = await open(at, '/sr/timovi', cardsOf('sr'), answers)
      const button = page.getByRole('link', { name: WORDS.sr.button, exact: true })
      const sentence = page.getByText('Tim se osniva u prelaznom roku', { exact: false })

      expect(await button.count(), 'the button').toBe(windowOpen ? 1 : 0)
      expect(await sentence.count(), 'the sentence').toBe(windowOpen ? 0 : 1)

      if (windowOpen) {
        expect(await button.evaluate((one) => one.tabIndex), 'the button is out of the order of the keyboard').toBe(0)
        return
      }

      const under = await sentence.evaluate((element) => {
        const cards = document.querySelector('[role="group"][aria-label="BTL tabele"]')

        if (cards === null) {
          throw new Error('NOT MEASURED: no cards')
        }

        return element.getBoundingClientRect().top >= cards.getBoundingClientRect().bottom
      })

      expect(under, 'the sentence is not under the cards').toBe(true)
    })
  }
}

/* THE PLACE HELD ON THE MEN AND THE WOMEN IS NOTHING ANYBODY CAN MEET: not painted, not under a press,
   not reached by the keyboard. Asked of the page and not of the markup, because `visibility` is what the
   stylesheet does with it. */
for (const at of [WIDTHS[0], WIDTHS[4], WIDTHS[5]]) {
  if (at === undefined) {
    throw notMeasured('no width')
  }

  test(`the place of the button is out of reach on the men and the women, ${label(at)}`, async ({ open, theDay }) => {
    if (theDay !== THE_OTHER_DAY_THE_SUITE_IS_READ_AS) {
      return
    }

    for (const path of ['/sr/tabela', '/sr/tabela?pol=z']) {
      const { page } = await open(at, path, cardsOf('sr'), { ...DATA, ...signedInAs(WITHOUT_A_TEAM) })
      const held = await page.evaluate((selector) => {
        const group = document.querySelector(selector)

        if (group === null) {
          throw new Error('NOT MEASURED: the screen drew no cards')
        }

        const place = group.previousElementSibling

        /* No place is a fault, answered as one and asserted below. */
        if (!(place instanceof HTMLElement)) {
          return null
        }

        const box = place.getBoundingClientRect()
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)

        place.focus()

        return {
          words: place.textContent,
          width: box.width,
          painted: place.checkVisibility({ visibilityProperty: true }),
          pressed: hit !== null && (hit === place || place.contains(hit)),
          focused: document.activeElement === place,
        }
      }, cardsOf('sr'))

      expect(held, `${path}: nothing holds the place of the button`).not.toBeNull()

      if (held === null) {
        return
      }

      expect(held.words, `${path}: the place does not carry the button's words`).toBe(WORDS.sr.button)
      expect(held.width, `${path}: the place has no width`).toBeGreaterThan(0)
      expect(held.painted, `${path}: the place is painted`).toBe(false)
      expect(held.pressed, `${path}: a press lands on the place`).toBe(false)
      expect(held.focused, `${path}: the place takes the focus`).toBe(false)
    }
  })
}
