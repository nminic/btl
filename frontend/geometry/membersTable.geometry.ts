import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At, Geometry } from './support/harness.ts'

/**
 * THE TABLE OF THE MODERATION OF THE MEMBERS DOES NOT SCROLL SIDEWAYS IN ITS BOX, AT ANY WIDTH (PDL P24,
 * „Tabele na telefonu nemaju horizontalni skrol"; owner, 20.10.2026: „Tabela članova u moderaciji članova
 * (klizi bočno u svom okviru na svim širinama, protiv P24) popravlja se pre puštanja").
 *
 * Measured before the change, with the sample: 936px inside a box of 328 at 360, of 736 at 768 and of
 * 796 at 1280 (`pages/admin/AdminMembers.css` says what held it there and what lets it go).
 *
 * **Asked in Chrome**, because jsdom lays nothing out:
 *
 * 1. **The table's own box is not wider inside than outside**, and the page does not scroll sideways,
 *    at 360, at 700 and 720 (the narrowest a table is drawn whole, where the seven columns did not fit
 *    with the two rules alone), at 768, at 1000 and at 1100 (either side of „Poslednja sezona", owner
 *    20.10.2026) and at 1280.
 * 2. **With the names of the sample and with long ones**: the real names the review of PR 591 used and
 *    the longest surname of the sample, every member a member of four seasons on three bases, and the
 *    town of the sample with the longest name. A row of the sample holds „Promeni osnov u oslobođenje",
 *    the widest the record can be, and the case asks that it was on the screen.
 * 3. **The columns each width draws, by their heads**: the member and the record on a telephone, with
 *    the basis and the seasons under the name; six from 700, without „Poslednja sezona"; seven from
 *    1100. A table that fits because a column is missing that the owner did not take away would
 *    otherwise pass.
 * 4. **No word of a name, a town, a head or a pill is broken inside the word** (owner, 20.10.2026,
 *    „imena ostaju cela"), at every width.
 * 5. **At 200% text the page does not scroll sideways**, at 360, 768 and 1280. The table's box may
 *    there: PDL P24, „[DOPUNJENO 12.08.2026] … Kad čitalac uveća tekst … Skrol je unutar kutije tabele,
 *    a sama strana se ne pomera bočno." At 360 the search beside the filter moved the page 32px.
 */

/** The day the moderation of the members is read on. */
test.use({ theDay: '2026-10-20' })

function sample<T>(name: string): T {
  const read: T = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'),
  )

  return read
}

const MEMBERS = sample<Record<string, unknown>[]>('members')

/** Somebody who moderates the members: a superadmin, who may do everything (`useMay`). */
const SAMPLE: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/members': MEMBERS,
  '/api/competitors': sample('competitors'),
}

/**
 * THE NAMES THE REVIEW OF PR 591 USED, which are real ones, and the longest surname of the sample
 * (22 letters, a hyphen in it). Cycled over every member, so the table carries each of them.
 */
const REAL_NAMES = [
  ['Ana', 'Hadživukašinović'],
  ['Aleksandra', 'Konstantinović'],
  ['Konstantin', 'Hadžiantonović'],
  ['Konstantin', 'Karađorđević-Obrenović'],
] as const

/** Four seasons, on all three bases, so the column of seasons and the box under the name hold four pills. */
const FOUR_SEASONS = [
  { season: 2027, basis: 'feeExempt' },
  { season: 2028, basis: 'payment' },
  { season: 2029, basis: 'balance' },
  { season: 2030, basis: 'feeExempt' },
]

const LONG: Answers = {
  ...SAMPLE,
  '/api/members': MEMBERS.map((one, index) => {
    const [firstName, lastName] = REAL_NAMES[index % REAL_NAMES.length] ?? REAL_NAMES[0]

    return { ...one, firstName, lastName, city: 'Sremski Karlovci', seasons: FOUR_SEASONS }
  }),
}

const CASES = [
  ['the members of the sample', SAMPLE],
  ['long names and four seasons', LONG],
] as const

/** The heads of the seven columns, in order. */
const ALL = ['Član', 'Kat.', 'Mesto', 'Osnov članstva', 'Sezone članstva', 'Poslednja sezona', 'Zapis']

/** What a width draws (owner, 20.10.2026, both with my recommendation). */
function drawnAt(width: number): string[] {
  if (width < 700) {
    return ['Član', 'Zapis']
  }

  return width < 1100 ? ALL.filter((one) => one !== 'Poslednja sezona') : ALL
}

const WIDTHS = [360, 700, 720, 768, 1000, 1100, 1280]

/** Opens the moderation of the members with every member on it, and reads the table. */
async function readTheTable(open: Geometry['open'], at: At, answers: Answers) {
  const { page, probe } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', answers)

  /* Everybody ever given a number, so the rows that record a payment are among them as well. */
  await page.getByRole('combobox').first().selectOption('all')
  await page.getByText('Promeni osnov u oslobođenje').first().waitFor({ state: 'visible' })

  const seen = await page.evaluate(() => {
    const table = document.querySelector('table.members-table')
    const box = table?.closest('.table-scroll')

    if (table === null || table === undefined || box === null || box === undefined) {
      throw new Error('the table of the members is not on the page in a box of its own')
    }

    const drawn = (one: Element) => getComputedStyle(one).display !== 'none' && one.getClientRects().length > 0
    const rows = [...table.querySelectorAll('tbody tr')]

    /* Every word of every drawn cell but the record's, cut where the portal may cut it (a space, a
       hyphen), and the ones whose letters stand on more than one line: those were broken inside the
       word. The record holds symbols whose words are text clipped to a pixel (`visually-hidden`), which
       a range would answer for where the letters WOULD stand unclipped. */
    const said: string[] = []
    const broken: string[] = []
    const cells = [...table.querySelectorAll('thead th, tbody td')].filter(
      (cell) => drawn(cell) && cell !== cell.parentElement?.lastElementChild,
    )

    for (const cell of cells) {
      const walk = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)

      for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
        const parent = node.parentElement

        if (parent === null || !drawn(parent)) {
          continue
        }

        for (const word of (node.textContent ?? '').matchAll(/[^\s-]+/g)) {
          const range = document.createRange()

          range.setStart(node, word.index)
          range.setEnd(node, word.index + word[0].length)

          const lines = new Set([...range.getClientRects()].map((one) => Math.round(one.top / 4)))

          said.push(word[0])

          if (lines.size > 1) {
            broken.push(word[0])
          }
        }
      }
    }

    /* The pills each row draws under the name, where the box under it is drawn at all, against the
       pills of the columns of the basis and of the seasons in the same row, drawn or not: the box carries
       every one of them and nothing else. */
    const underTheName = rows.map((row) => {
      const held = row.querySelector('td:first-child .table__phone-only')
      const columns = [...row.children].slice(3, 5).reduce((sum, cell) => sum + cell.querySelectorAll('.tag').length, 0)

      return {
        under: held !== null && drawn(held) ? [...held.querySelectorAll('.tag')].map((one) => one.textContent).join(' | ') : '',
        columns: [...row.children].slice(3, 5).flatMap((cell) => [...cell.querySelectorAll('.tag')].map((one) => one.textContent)).join(' | '),
        count: columns,
      }
    })

    return {
      inside: box.scrollWidth,
      outside: box.clientWidth,
      heads: [...table.querySelectorAll('thead th')].filter(drawn).map((one) => (one.textContent ?? '').trim()),
      rows: rows.length,
      words: [...table.querySelectorAll('tbody button')].filter(drawn).map((one) => (one.textContent ?? '').trim()),
      underTheName,
      said,
      broken,
    }
  })

  return { probe, seen }
}

for (const width of WIDTHS) {
  const at: At = { width, text: 100 }

  for (const [what, answers] of CASES) {
    test(`the table of the members fits its box, with ${what}, at ${label(at)}`, async ({ open }) => {
      const { probe, seen } = await readTheTable(open, at, answers)

      expect(probe.sideways).toBe(0)

      /* Measured is not assumed: every member of the sample is a row, and the widest record is drawn. */
      expect(seen.rows).toBe(MEMBERS.length)
      expect(seen.words).toContain('Promeni osnov u oslobođenje')

      expect(seen.heads).toEqual(drawnAt(width))

      /* On a telephone the basis and the seasons stand under the name, every one of them; from 700 the
         box under the name is not drawn at all. */
      if (width < 700) {
        expect(seen.underTheName.filter((one) => one.under !== one.columns)).toEqual([])
      } else {
        expect(seen.underTheName.filter((one) => one.under !== '')).toEqual([])
      }

      /* Measured is not assumed: the pills were there to be carried, four seasons on every long row. */
      expect(seen.underTheName.reduce((sum, one) => sum + one.count, 0)).toBeGreaterThanOrEqual(
        what.startsWith('long') ? MEMBERS.length * 4 : MEMBERS.length - 3,
      )

      expect(seen.said.length).toBeGreaterThan(MEMBERS.length * 2)

      if (what.startsWith('long')) {
        expect(seen.said).toContain('Hadživukašinović')
        expect(seen.said).toContain('Karađorđević')
      }

      expect(seen.broken, 'words broken inside the word').toEqual([])

      expect(seen.inside, `the table's box scrolls: ${String(seen.inside)} inside ${String(seen.outside)}`).toBeLessThanOrEqual(
        seen.outside,
      )
    })
  }
}

for (const width of [360, 768, 1280]) {
  const at: At = { width, text: 200 }

  test(`the page with the table of the members does not scroll sideways, with long names, at ${label(at)}`, async ({
    open,
  }) => {
    const { probe, seen } = await readTheTable(open, at, LONG)

    /* Measured is not assumed: the long names are on the screen. */
    expect(seen.said).toContain('Hadživukašinović')
    expect(probe.widened).toBe(0)
    expect(probe.sideways).toBe(0)
    expect(seen.broken, 'words broken inside the word').toEqual([])
  })
}
