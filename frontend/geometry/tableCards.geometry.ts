import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { THE_OTHER_DAY_THE_SUITE_IS_READ_AS } from '../src/test/theDay.ts'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE THREE CARDS OF THE TABLES AND THE SEASON STAND ON THE SAME PIXEL ON ALL THREE CARDS.
 *
 * Owner, 31.07.2026 (ADL A7): „navigacija se ne sme pomerati tokom klikova, boksovi i naslovi moraju da
 * se gađaju u piksel". The cards Muškarci, Žene and Timovi are the navigation between three screens
 * (`src/pages/TableCards.tsx`), so pressing one must not move the row under the pointer. Review of PR 752
 * measured it moving for a member with no team: the button „Predloži tim" stood in the same row, before
 * the cards, and pushed them down by 59px at 360px and to the right by 260px at 1280px with the text at
 * 200%. Since then it stands beside the heading (owner, 16.11.2026, chosen between offered outcomes,
 * against my recommendation) and this guard holds the cards where they are.
 *
 * Asked of every reader the teams screen draws differently: a visitor, a member with a team and a member
 * with none, on both days of the suite. On one of them the transfer window is shut and a member with no
 * team is told when he may found one; on the other it is open and he is offered the button. Both stand
 * beside the heading and neither may move the cards.
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

const READERS: [name: string, answers: Answers][] = [
  ['a visitor', DATA],
  ['a member with no team', { ...DATA, ...signedInAs(WITHOUT_A_TEAM) }],
  ['a member in a team', { ...DATA, ...signedInAs(IN_A_TEAM) }],
]

/* The widths and text sizes the cards are held at. The first six are the portal's three widths at both
   text sizes. The rest are where the second review of PR 752 found the cards moving and the button over
   the heading, because the column of the content stops at 1100px while the window goes on: 150% from
   1280px, 175% at 1920px, 200% from 1640px; and two where the button does fit beside the heading at a
   larger text, so that the guard holds that side of the line too. */
const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 360, text: 200 },
  { width: 768, text: 100 },
  { width: 768, text: 200 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
  /* Wide enough for the button beside the heading, and narrower than 820px, the owner's line. */
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

/* WHERE THE BUTTON STANDS BESIDE THE HEADING, written out cell by cell and not read off the page: from
   820px (owner, 16.11.2026, chosen with my recommendation), and only where the cell of the heading holds
   the words, the button and a gap, beside the cards and the season. Every cell not named here has the
   button under the row of the cards. */
const BESIDE = new Set(['1280/100', '1920/100', '1440/125', '1280/150', '1366/150', '1440/150', '1920/150'])

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
    })
  }

  /* AND WHAT THE TEAMS OFFER A MEMBER WITH NO TEAM STANDS WHERE `BESIDE` SAYS, ON THE SCREEN AND CLEAR OF
     THE HEADING AND OF THE CARDS. Found by what a reader meets, the link „Predloži tim" or the sentence
     that stands in its place while the transfer window is shut, and never by a class: the class is what
     places it, so an expectation read from it would agree with whatever the class did. Nobody else is
     offered anything, and that is asked too. */
  for (const at of WIDTHS) {
    test(`what the teams offer a member with no team stands where it should, for ${reader}, ${label(at)}`, async ({ open, theDay }) => {
      const { page } = await open(at, '/sr/timovi', CARDS, answers)
      const button = page.getByRole('link', { name: 'Predloži tim', exact: true })
      const sentence = page.getByText('Tim se osniva u prelaznom roku', { exact: false })

      if (reader !== 'a member with no team') {
        expect(await button.count(), 'somebody who is not a member with no team is offered the button').toBe(0)
        expect(await sentence.count(), 'somebody who is not a member with no team is told when to found one').toBe(0)
        return
      }

      const windowOpen = theDay === THE_OTHER_DAY_THE_SUITE_IS_READ_AS
      const offered = windowOpen ? button : sentence

      expect(await offered.count(), windowOpen ? 'the button is not offered' : 'the sentence is not drawn').toBe(1)

      const seen = await offered.evaluate((element) => {
        const heading = document.querySelector('h1')
        const cards = document.querySelector('[role="group"][aria-label="BTL tabele"]')

        if (heading === null || cards === null) {
          throw new Error('NOT MEASURED: no heading or no cards')
        }

        const words = document.createRange()

        words.selectNodeContents(heading)

        const text = words.getBoundingClientRect()
        const box = element.getBoundingClientRect()
        const row = cards.getBoundingClientRect()
        const apart = (a: DOMRect, b: DOMRect) =>
          a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top

        return {
          left: box.left,
          right: box.right,
          width: document.documentElement.clientWidth,
          clearOfTheHeading: apart(text, box),
          clearOfTheCards: apart(row, box),
          levelWithTheHeading: box.top < text.bottom && box.bottom > text.top,
          rightOfTheWords: box.left >= text.right,
          leftOfTheCards: box.right <= row.left,
          underTheCards: box.top >= row.bottom,
        }
      })
      const beside = windowOpen && BESIDE.has(`${String(at.width)}/${String(at.text)}`)

      expect(seen.left, 'it starts left of the screen').toBeGreaterThanOrEqual(0)
      expect(seen.right, 'it runs off the right edge of the screen').toBeLessThanOrEqual(seen.width)
      expect(seen.clearOfTheHeading, 'it is drawn over the words of the heading').toBe(true)
      expect(seen.clearOfTheCards, 'it is drawn over the cards').toBe(true)

      if (beside) {
        expect(seen.levelWithTheHeading, 'it is not level with the heading').toBe(true)
        expect(seen.rightOfTheWords, 'it is not to the right of the words of the heading').toBe(true)
        expect(seen.leftOfTheCards, 'it is not to the left of the cards').toBe(true)
      } else {
        expect(seen.underTheCards, 'it is not under the row of the cards').toBe(true)
      }

      if (windowOpen) {
        await button.focus()
        expect(await button.evaluate((one) => one === document.activeElement), 'the button takes no focus').toBe(true)
      }
    })
  }
}
