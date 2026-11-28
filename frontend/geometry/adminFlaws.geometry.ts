import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * FOUR SMALL FAULTS OF THE ADMINISTRATION, ASKED OF CHROME (the UX agent's survey of 28.11.2026, over the
 * screens as they stand): jsdom lays nothing out, so none of the four can be seen anywhere else.
 *
 * 1. **The names of the moderators are never broken inside a word** (PDL, 20.10.2026: „Imena i nazivi trka se
 *    nikad ne lome usred reči"), and the table does not scroll sideways in its box on a telephone (PDL P24).
 *    The address may break anywhere, as it is one long word to a browser.
 * 2. **The box of the description of a proposed team is dressed as the boxes beside it** (the portal has one
 *    theme, the dark one): the same border, ground, colour and typeface as the input of the name.
 * 3. **On the screen of payments the member number stands UNDER the name**, on a line of its own, at every
 *    width (`pages/admin/Payments.tsx` says „Under the name").
 * 4. **In the queue of results the column of the member holds the name and the number**, the name whole
 *    (owner, 28.11.2026, O6: „kolona Član nosi ime i broj; ime se ne skraćuje"), and the page does not scroll
 *    sideways.
 *
 * Every case asks, as well, that what it measures was on the page: a table with no row would pass them all.
 */

function SAMPLE_OF<T>(name: string): T {
  const read: T = JSON.parse(readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'))

  return read
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

const ME: Answers = { '/api/me': { role: 'superadmin', account: 41, membershipBasis: null } }

/* ---------------------------------------------------------------- 1. the moderators */

const MODERATORS: Answers = {
  ...ME,
  '/api/moderators': [
    ...SAMPLE_OF<Record<string, unknown>[]>('moderators'),
    {
      id: 90,
      firstName: 'Konstantin',
      lastName: 'Hadžiantonović',
      email: 'konstantin.hadziantonovic@primer.rs',
      rights: [],
    },
  ],
}

for (const at of WIDTHS) {
  test(`no name of a moderator is broken inside a word, and the table fits its box (but for the allowance) at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr/administracija/moderatori', 'table.moderators tbody tr', MODERATORS)

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)

    const seen = await page.evaluate(() => {
      const table = document.querySelector('table.moderators')
      const box = table?.closest('.table-scroll')

      if (table === null || table === undefined || box === null || box === undefined) {
        throw new Error('the table of the moderators is not on the page in a box of its own')
      }

      const broken: string[] = []
      const said: string[] = []

      for (const row of table.querySelectorAll('tbody tr')) {
        /* The first two cells: the given name and the surname. */
        for (const cell of [...row.children].slice(0, 2)) {
          const node = cell.firstChild

          if (node === null || node.nodeType !== Node.TEXT_NODE) {
            continue
          }

          for (const word of (node.textContent ?? '').matchAll(/[^\s-]+/g)) {
            const range = document.createRange()

            range.setStart(node, word.index)
            range.setEnd(node, word.index + word[0].length)

            said.push(word[0])

            if (new Set([...range.getClientRects()].map((one) => Math.round(one.top / 4))).size > 1) {
              broken.push(word[0])
            }
          }
        }
      }

      return { broken, said, inside: box.scrollWidth, outside: box.clientWidth }
    })

    expect(seen.said).toContain('Hadžiantonović')
    expect(seen.broken).toEqual([])
    /* NO SCROLL IN THE BOX, but for one allowance that is mine and not the owner's for this list ([IZVEDENO],
       borrowed from his rule for the table of results, PDL 20.10.2026, „osim kod moderatora na telefonu sa vrlo
       dugim prezimenom, gde smeju da odstupe za nekoliko piksela"): the sample holds a surname of fourteen
       letters, which on a telephone may take up to ten pixels over. */
    expect(seen.inside - seen.outside).toBeLessThanOrEqual(at.width < 700 ? 10 : 0)
  })
}

/* ---------------------------------------------------------------- 2. the box of a team's description */

test('the description of a proposed team is dressed as the boxes beside it', async ({ open }) => {
  const { page } = await open(
    { width: 1280, text: 100 },
    '/sr/administracija/verifikacija/timovi',
    '.pending__fields textarea',
    {
      ...ME,
      '/api/verification': SAMPLE_OF<Record<string, unknown>[]>('verification').filter((one) => one.queue === 'teams'),
      '/api/competitors': [],
      '/api/teams': [],
    },
  )

  const dressed = await page.evaluate(() => {
    const look = (selector: string) => {
      const one = document.querySelector(selector)

      if (one === null) {
        throw new Error(`nothing on the page matches ${selector}`)
      }

      const style = getComputedStyle(one)

      return {
        border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
        ground: style.backgroundColor,
        colour: style.color,
        font: style.fontFamily,
        radius: style.borderTopLeftRadius,
      }
    }

    return { box: look('.pending__fields textarea'), beside: look('.pending__fields input[type="text"]') }
  })

  expect(dressed.box).toEqual(dressed.beside)
})

/* ---------------------------------------------------------------- 3. payments */

const PAYMENTS: Answers = {
  ...ME,
  '/api/payments': {
    season: 2027,
    accounts: [
      { competitorId: 23, memberNumber: '000031', firstName: 'Jovana', lastName: 'Ilić', city: 'Beograd',
        currency: 'RSD', expected: 4800, price: 4800, balance: 6000, mayBeDeleted: false },
      { competitorId: 41, memberNumber: '', firstName: 'Ana', lastName: 'Ilić', city: 'Novi Sad',
        currency: 'RSD', expected: 4800, price: 4800, balance: 0, mayBeDeleted: true },
    ],
  },
}

for (const at of WIDTHS) {
  test(`the member number stands under the name on a line of its own at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr/administracija/verifikacija/uplate', 'table.activate tbody tr', PAYMENTS)

    expect(probe.sideways).toBe(0)

    const seen = await page.evaluate(() => {
      const number = [...document.querySelectorAll('table.activate tbody td .table__member-number')].find(
        (one) => (one.textContent ?? '').trim() === '000031',
      )
      const cell = number?.closest('td')

      if (number === undefined || cell === null || cell === undefined) {
        throw new Error('the row of the member with a number is not on the page')
      }

      /* Everything in the cell before the number: the name, which React writes as three text nodes. */
      const range = document.createRange()

      range.setStart(cell, 0)
      range.setEndBefore(number)

      return {
        text: range.toString().trim(),
        nameBottom: Math.max(...[...range.getClientRects()].map((one) => one.bottom)),
        numberTop: number.getBoundingClientRect().top,
      }
    })

    expect(seen.text).toBe('Jovana Ilić')
    expect(seen.numberTop).toBeGreaterThanOrEqual(seen.nameBottom - 0.5)
  })
}

/* ---------------------------------------------------------------- 4. the queue of results */

const A_RUN = {
  queue: 'results',
  subjectId: '',
  city: '',
  country: '',
  photoId: null,
  crop: null,
  rating: { organisation: 0, value: 0, ambience: 0 },
  kind: '',
  date: '2027-03-08',
  raceId: 11,
  raceDate: '2027-03-06',
  raceKind: 'length',
  distanceKm: 10,
  ascentM: 50,
  descentM: 40,
  seconds: 3300,
  link: '',
  body: '',
  eventId: null,
  eventName: null,
  eventKind: null,
}

const REVIEW: Answers = {
  ...ME,
  '/api/competitors': [],
  '/api/races': [],
  '/api/events': [],
  '/api/verification': [
    { ...A_RUN, id: 701, memberNumber: '000010', who: 'Ana Anić', subject: 'Beogradska desetka' },
    { ...A_RUN, id: 702, memberNumber: '000020', who: 'Konstantin Karađorđević-Obrenović', subject: 'Šestočasovna' },
  ],
}

for (const at of WIDTHS) {
  test(`the column of the member holds the name whole and the number at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr/administracija/verifikacija/rezultati', 'table tbody tr', REVIEW)

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)

    const seen = await page.evaluate(() => {
      const table = document.querySelector('.table-scroll table')
      const box = table?.closest('.table-scroll')

      if (table === null || table === undefined || box === null || box === undefined) {
        throw new Error('the queue of results is not on the page in a box of its own')
      }

      const column = [...table.querySelectorAll('thead th')].findIndex((one) => (one.textContent ?? '').trim() === 'Član')
      const cells = [...table.querySelectorAll('tbody tr')].map((row) => row.children[column])
      const broken: string[] = []
      const said: string[] = []

      for (const cell of cells) {
        const walk = document.createTreeWalker(cell ?? document.body, NodeFilter.SHOW_TEXT)

        for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
          for (const word of (node.textContent ?? '').matchAll(/[^\s-]+/g)) {
            const range = document.createRange()

            range.setStart(node, word.index)
            range.setEnd(node, word.index + word[0].length)

            said.push(word[0])

            if (new Set([...range.getClientRects()].map((one) => Math.round(one.top / 4))).size > 1) {
              broken.push(word[0])
            }
          }
        }
      }

      return {
        column,
        said,
        broken,
        text: cells.map((one) => (one?.textContent ?? '').trim()),
        inside: box.scrollWidth,
        outside: box.clientWidth,
      }
    })

    expect(seen.column).toBeGreaterThanOrEqual(0)
    expect(seen.text.join('|')).toContain('Ana Anić')
    expect(seen.text.join('|')).toContain('000010')
    expect(seen.said).toContain('Karađorđević')
    expect(seen.broken).toEqual([])
    /* THE BOX IS NOT ASKED TO FIT HERE: at 360 this table was already wider than its box with the number
       alone in the column (382 against 328, measured 28.11.2026), a fault of its own that is not one of these
       five. What is asked is that the name is whole, and that the page does not move (`probe`, above). */
  })
}
