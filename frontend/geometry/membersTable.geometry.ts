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
 * **FIVE COLUMNS SINCE 22.10.2026** (owner, „Red na ekranu članova ima pet kolona"): Ime i prezime,
 * Mesto, Osnov, Sezone, Opcije, folded under the name where they do not fit (the coordinator's answer of
 * 22.10.2026, P2). Every list of seasons on the screen is OPENED before anything is measured, because an
 * open list, with „Promeni osnov u oslobođenje" beside the season on sale, is the widest a row can be.
 *
 * 1. **The table's own box is not wider inside than outside**, and the page does not scroll sideways,
 *    at 360, at 700 and 720 (the narrowest a table is drawn with its middle columns), at 768, at 820,
 *    860 and 912 (the navigation stands beside the page from 820, so the box is narrower there than at
 *    768), at 1000 (where „Mesto" comes back as a column) and at 1100 and 1280. **And at every tenth
 *    pixel from 700 to 1100** with the widest rows, because the bands where it did not fit were found
 *    between the widths that were asked.
 * 2. **With the names of the sample, with long ones, and with the widest rows**: the real names the
 *    review of PR 591 used and the longest surname of the sample, every member a member of four
 *    seasons with the fourth on sale, and the town and the country of the sample with the longest
 *    names. A row of the sample holds „Promeni osnov u oslobođenje", and the case asks that it was on
 *    the screen.
 * 3. **The columns each width draws, by their heads**: the name and the options on a telephone, with the
 *    town, the basis and the seasons under the name; from 700 the basis and the seasons as columns as
 *    well, the town still under the name; from 1000 all five. A table that fits because a column is
 *    missing that the owner did not take away would otherwise pass. **And what is folded under the name
 *    says what its column says**, at every width where it is drawn, and nothing is folded where the
 *    column is drawn.
 * 3a. **Every drawn cell stands under its own head, and a row draws as many cells as the head does**:
 *    a cell whose column is hidden in the head and drawn in the body passes every count of heads and
 *    every width, and puts the year of the last season under the record's head (review of PR 594).
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

/** Four seasons, on all three bases, the fourth the one on sale, so every list holds four boxes. */
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

    return { ...one, firstName, lastName, city: 'Sremski Karlovci', country: 'BA', seasons: FOUR_SEASONS, seasonOnSale: 2030 }
  }),
}

/**
 * THE WIDEST ROWS (review of PR 594): the long names and the long town, the four seasons and the basis
 * all on „Oslobođen članarine", the longest pill (but the one row paid, which keeps the widest record),
 * and the basis of 2028.
 */
const WORST: Answers = {
  ...SAMPLE,
  '/api/members': MEMBERS.map((one, index) => {
    const [firstName, lastName] = REAL_NAMES[index % REAL_NAMES.length] ?? REAL_NAMES[0]

    return {
      ...one,
      firstName,
      lastName,
      city: 'Sremski Karlovci',
      country: 'BA',
      seasonOnSale: 2030,
      seasons: FOUR_SEASONS.map((held) => ({ ...held, basis: 'feeExempt' })),
      /* Every basis on the exemption but the one paid: that row keeps „Promeni osnov u oslobođenje", the
         widest the record can be, and its pill is the shorter one, so the column of the basis is still
         set by the longest. */
      ...(one.membershipBasis === undefined || one.membershipBasis === 'payment'
        ? {}
        : { membershipBasis: 'feeExempt', membershipSeason: 2030 }),
    }
  }),
}

const CASES = [
  ['the members of the sample', SAMPLE],
  ['long names and four seasons', LONG],
  ['the widest rows, four seasons', WORST],
] as const

/** The heads of the five columns, in order. */
const ALL = ['Ime i prezime', 'Mesto', 'Osnov', 'Sezone', 'Opcije']

/** What a width draws (the coordinator's answer of 22.10.2026, P2). */
function drawnAt(width: number): string[] {
  if (width < 700) {
    return ['Ime i prezime', 'Opcije']
  }

  return width < 1000 ? ['Ime i prezime', 'Osnov', 'Sezone', 'Opcije'] : ALL
}

/** What a width folds under the name, by the column it stands for. */
function foldedAt(width: number): string[] {
  if (width < 700) {
    return ['Mesto', 'Osnov', 'Sezone']
  }

  return width < 1000 ? ['Mesto'] : []
}

const WIDTHS = [360, 700, 720, 768, 820, 860, 912, 1000, 1100, 1280]

/** Opens the moderation of the members with every member on it, and reads the table. */
async function readTheTable(open: Geometry['open'], at: At, answers: Answers) {
  const { page, probe } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', answers)

  /* Everybody ever given a number, so the rows that record a payment are among them as well. */
  await page.getByRole('combobox').first().selectOption('all')

  /* EVERY LIST OF SEASONS THE WIDTH DRAWS, OPENED: the copy the stylesheet hides is not pressed. */
  const toggles = page.locator('table.members-table button[aria-expanded]')

  for (let index = 0; index < (await toggles.count()); index += 1) {
    const toggle = toggles.nth(index)

    if (await toggle.isVisible()) {
      await toggle.click()
    }
  }

  await page.getByText('Promeni osnov u oslobođenje').filter({ visible: true }).first().waitFor({ state: 'visible' })
  /* The pointer is parked off the table again: the last press left it over a control. */
  await page.mouse.move(1, 1)

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

    /* WHAT EACH ROW FOLDS UNDER THE NAME, found by being drawn in that cell and not by the class of the box
       that holds it (a box that lost its class is drawn at every width, and a guard that looked for the
       class would not see it), each said as its column says it: the list of seasons by the words on its
       button, everything else by its text. */
    const heads = [...table.querySelectorAll('thead th')]
    const named = (one: Element | undefined) => (one?.textContent ?? '').trim()
    const says = (one: Element) => {
      const toggle = one.querySelector('button[aria-expanded]')

      return (toggle === null ? one.textContent ?? '' : toggle.textContent ?? '').replace(/\s+/g, '')
    }
    const folded = rows.map((row) => {
      const first = row.children[0]
      const parts = first === undefined ? [] : [...first.querySelectorAll('dd')].filter(drawn)

      return parts.map((part) => {
        const name = named(part.previousElementSibling ?? undefined)
        const column = [...row.children][heads.findIndex((head) => named(head) === name)]

        return { name, here: says(part), there: column === undefined ? '' : says(column) }
      })
    })

    /* Every drawn cell against the head drawn over it, found by where the two stand and not by their
       order: the head over the middle of the cell must be the cell's own (the head at its index). */
    const drawnHeads = heads.filter(drawn)
    const misplaced = rows.flatMap((row, index) => {
      const all = [...row.children]
      const shown = all.filter(drawn)
      const wrong: string[] = []

      if (shown.length !== drawnHeads.length) {
        wrong.push(`row ${String(index)}: ${String(shown.length)} cells under ${String(drawnHeads.length)} heads`)
      }

      for (const cell of shown) {
        const { left, right } = cell.getBoundingClientRect()
        const middle = (left + right) / 2
        const over = drawnHeads.find((head) => {
          const edges = head.getBoundingClientRect()

          return middle >= edges.left && middle <= edges.right
        })
        const own = heads[all.indexOf(cell)]

        if (over !== own) {
          wrong.push(`row ${String(index)}: the cell of „${named(own)}" stands under „${named(over)}"`)
        }
      }

      return wrong
    })

    return {
      misplaced: misplaced.slice(0, 6),
      inside: box.scrollWidth,
      outside: box.clientWidth,
      heads: [...table.querySelectorAll('thead th')].filter(drawn).map((one) => (one.textContent ?? '').trim()),
      rows: rows.length,
      words: [...table.querySelectorAll('tbody button')].filter(drawn).map((one) => (one.textContent ?? '').trim()),
      folded,
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
      expect(seen.misplaced, 'cells that do not stand under their own head').toEqual([])

      /* Under the name, on every row, exactly the columns this width folds, each saying what its column
         says. */
      expect(seen.folded.filter((parts) => parts.map((one) => one.name).join() !== foldedAt(width).join())).toEqual([])
      expect(seen.folded.flat().filter((one) => one.here !== one.there)).toEqual([])

      expect(seen.said.length).toBeGreaterThan(MEMBERS.length * 2)

      if (what !== 'the members of the sample') {
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

/* EVERY TENTH PIXEL FROM 700 TO 1100, with the widest rows (review of PR 594): the bands where the table
   did not fit, 700 to 722, 820 to 910 and 1000 to 1025, lay between the widths that were asked. */
for (let width = 700; width <= 1100; width += 10) {
  const at: At = { width, text: 100 }

  test(`the table of the members fits its box, with the widest rows, at ${label(at)} (the sweep)`, async ({ open }) => {
    const { probe, seen } = await readTheTable(open, at, WORST)

    expect(probe.sideways).toBe(0)
    expect(seen.rows).toBe(MEMBERS.length)
    expect(seen.said).toContain('Hadživukašinović')
    expect(seen.heads).toEqual(drawnAt(width))
    expect(seen.misplaced, 'cells that do not stand under their own head').toEqual([])
    expect(seen.broken, 'words broken inside the word').toEqual([])
    expect(seen.inside, `the table's box scrolls: ${String(seen.inside)} inside ${String(seen.outside)}`).toBeLessThanOrEqual(
      seen.outside,
    )
  })
}
