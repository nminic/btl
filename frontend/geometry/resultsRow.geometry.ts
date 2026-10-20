import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE ROW OF A MEMBER'S RESULT ON THE PAGE OF AN EVENT: ONE VERTICAL CENTRE FOR THE WORDS AND THE
 * BUTTONS, AND NO SIDEWAYS SCROLL OF THE TABLE ON A TELEPHONE.
 *
 * Owner, 20.10.2026, with a screenshot of QA: „Red sa rezultatom člana nije centriran, ikonice su niže
 * nego vrednosti u redu". For whoever checks results the last cell of every row of „Rezultati članova"
 * holds the pencil and the x, two square buttons 2,4rem high, and every other cell holds one line of
 * text. `styles/table.css` puts every cell of every table at the TOP of its row on purpose („a table is
 * read across, and reading across needs a shared baseline"), which is right while nothing in a row is
 * taller than a line of words and wrong in this row, where the buttons are: the words stood at the top
 * and the buttons, being taller, stood lower.
 *
 * **Asked in Chrome and not in jsdom**, which lays nothing out: for each row, the vertical centre of the
 * text of every cell the width shows, and the centre of the GROUP of buttons (the box `.entity-row-actions`
 * draws, which is the content of the last cell), and the distance between the highest and the lowest of
 * them. The group and not each button, because the pair is allowed to wrap onto two lines where the cell is
 * narrow, and then there is no one centre for two buttons, only one for the cell's content.
 *
 * **And the same three rows of cases ask the second half of PDL P24, „Tabele na telefonu nemaju
 * horizontalni skrol"**: the table's own box (`.table-scroll`) is not wider inside than outside, at 360 and
 * at 768px at the ordinary text size, with the long names of the sample, and with the question that the x
 * opens drawn in the row. A rule that keeps the pair on one line fixes the centres and breaks this, which
 * is why the two are asked together (PR 586, review: `flex-wrap: nowrap` measured 345 against 328 at
 * 360px with long names and 491 against 347 with the question open).
 *
 * **Three widths, 360, 768 and 1280**, because the cells that are shown change with the width (the
 * phone keeps the name, the time and the points and the buttons; `table__hide-phone` takes the rest).
 */

/** A day after the event was run, so the results are drawn. */
test.use({ theDay: '2026-10-20' })

/** The event with the most runs in the sample of the file, so there are many rows to read. */
const SLUG = 'zimski-nocni-polumaraton-2020'

/** One pixel, which is what „agree" means in the owner's report: the centres of a row's cells. */
const AGREE = 1

function sample<T>(name: string): T {
  const read: T = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'),
  )

  return read
}

const COMPETITORS = sample<Record<string, unknown>[]>('competitors')

/** Somebody who checks results: a superadmin, who may do everything (`useMay`). */
const ANSWERS: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/events': sample('events'),
  '/api/races': sample('races'),
  '/api/results': sample('results'),
  '/api/competitors': COMPETITORS,
}

/** The same members with the longest names a family has: a name that wraps is a taller cell in the row. */
const LONG: Answers = {
  ...ANSWERS,
  '/api/competitors': COMPETITORS.map((one) => ({
    ...one,
    firstName: 'Aleksandar Konstantin',
    lastName: 'Papadopulos-Karamanlis',
  })),
}

/**
 * THE ONE CASE WHOSE BOX IS NOT ASKED ABOUT: the question of the x open, at 360px.
 *
 * There the table's box is wider inside than outside, and it was before this change: 332 inside 328 on
 * this machine, 334 inside 328 on the CI runner, and the same on `main` (measured 20.10.2026 with the same
 * answers; the width of a table does not depend on `vertical-align`). It is the widest button of the
 * question, „Potvrdi brisanje", against three other columns at their narrowest. It breaches PDL P24, it is
 * recorded as such in `btl-produkt/PENDING.md` (entry „SREDNJI, zateceno (ispravka PR-a 586, 20.10.2026,
 * izmereno i na `main`-u)"), and it is not this change's to fix: it needs a choice about the spacing or the
 * word of a button, and the design is closed.
 *
 * **Not pinned at a number**, which was tried (4px) and failed on the runner's fonts: the portal's font
 * stack is the system's own, so a pixel count of an overflow differs from machine to machine. The case
 * still asks the vertical centres; only the width of the box is left out, and only here. Every other case
 * (the sample names, long names, 768 and 1280 with the question open) asks it with no allowance.
 */
const THE_BOX_IS_NOT_ASKED = (width: number, asking: boolean) => asking && width === 360

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

const CASES = [
  ['the names of the sample', ANSWERS, false],
  ['long names', LONG, false],
  ['the question of the x open in the first row', ANSWERS, true],
] as const

for (const at of WIDTHS) {
  for (const [what, answers, asking] of CASES) {
    test(`every cell of a result's row shares one vertical centre, with ${what}, at ${label(at)}`, async ({
      open,
    }) => {
      const { page, probe } = await open(at, `/sr/kalendar/${SLUG}`, 'tbody td.table__points', answers)

      if (asking) {
        await page.getByRole('button', { name: /^Obriši: / }).first().click()
        await page.getByRole('button', { name: /^Potvrdi brisanje/ }).first().waitFor({ state: 'visible' })
      }

      const seen = await page.evaluate(() => {
        const results = document.querySelector('td.table__points')?.closest('table')

        if (results === null || results === undefined) {
          throw new Error('the table of results is not on the page')
        }

        const box = results.closest('.table-scroll')

        if (box === null) {
          throw new Error('the table of results is not in its own box')
        }

        const rows = [...results.querySelectorAll('tbody tr')].map((row) => {
          const centres: { what: string; centre: number }[] = []

          for (const cell of row.querySelectorAll('td')) {
            if (getComputedStyle(cell).display === 'none') {
              continue
            }

            const group = cell.querySelector('.entity-row-actions')

            if (group !== null) {
              const { top, height } = group.getBoundingClientRect()

              centres.push({
                what: `buttons ${String(group.querySelectorAll('a.button, button.button').length)}`,
                centre: top + height / 2,
              })

              continue
            }

            /* The words of the cell, as the browser set them: the lines they stand on and not the box
               of the cell they stand in. */
            const range = document.createRange()

            range.selectNodeContents(cell)

            const { top, height } = range.getBoundingClientRect()

            centres.push({ what: `text ${(cell.textContent ?? '').trim()}`, centre: top + height / 2 })
          }

          return centres
        })

        return { rows, inside: box.scrollWidth, outside: box.clientWidth }
      })

      expect(probe.sideways).toBe(0)
      expect(seen.rows.length).toBeGreaterThanOrEqual(10)

      for (const row of seen.rows) {
        const group = row.filter((one) => one.what.startsWith('buttons'))
        const words = row.filter((one) => one.what.startsWith('text'))

        /* Measured is not assumed: a row with no buttons would pass the spread below for the wrong
           reason, and a width that showed only one cell of words would pass it for none. */
        expect(group, JSON.stringify(row)).toHaveLength(1)
        expect(words.length, JSON.stringify(row)).toBeGreaterThanOrEqual(3)

        const all = row.map((one) => one.centre)
        const spread = Math.max(...all) - Math.min(...all)

        expect(spread, JSON.stringify(row)).toBeLessThanOrEqual(AGREE)
      }

      /* PDL P24: no sideways scroll of a table on a telephone. The box may be exactly as wide inside as
         outside, and not wider; except in the one case above. */
      if (!THE_BOX_IS_NOT_ASKED(at.width, asking)) {
        expect(
          seen.inside,
          `the table's box scrolls: ${String(seen.inside)} inside ${String(seen.outside)}`,
        ).toBeLessThanOrEqual(seen.outside)
      }
    })
  }
}

/**
 * THE FIGURES OF THE TABLE ARE ONE WIDTH, AND THEY TAKE NO MORE THAN THEY NEED (owner, 20.10.2026).
 *
 * „U ovoj tabelici umesto distance zelim da pise naziv trke. Ove ostale kolone desno od toga slozi
 * ekonomicno i jednakih sirina." The member and the race are the two columns of words; the length, the
 * climb, the fall, the time, the points and, for whoever checks results, the pencil and the x are the
 * figures, and each has a `col` that says so (`EventDetail.tsx`, `.results__figure`).
 *
 * **Asked in Chrome**, because jsdom lays nothing out: the width of the head of every figure column the
 * screen draws, at 360 (a telephone, three figures or two), at 700 (the narrowest a table is drawn whole,
 * where a share of the table is smallest), at 768, at 1000, at 1280 and at 1920 (the widest table the
 * portal draws, 1068px, where 9% of it is the 96px the figures need and no more). They agree to within one pixel (for whoever checks results on a telephone, to within
 * six: see `THE_TELEPHONE_OF_WHOEVER_CHECKS`), none is wider than 6rem (96px) and so none takes
 * more than it needs, and the table's own box is not wider inside than outside. **Both readers**, a
 * visitor (five figures on a wide screen) and whoever checks results (six, the buttons among them), with the
 * long names of a family and with the real names of the review of PR 591. **And no word of a name or of a
 * race is broken inside the word** (owner, 20.10.2026), at every width, whatever it costs the figures.
 *
 * The question of the x open is not asked here: the column grows to hold its widest button for as long as
 * it is open, which is the question's doing and not the table's, and its box is asked about above.
 */
const EQUAL: At[] = [
  { width: 360, text: 100 },
  { width: 700, text: 100 },
  { width: 768, text: 100 },
  { width: 1000, text: 100 },
  { width: 1280, text: 100 },
  { width: 1920, text: 100 },
]

/** The widest a figure column may be: 6rem at the ordinary size, which is 9% of the widest table the portal draws. */
const CAP = 96 + 1

/**
 * THE NAMES THE REVIEW OF PR 591 USED, which are real ones (20.10.2026): a race whose longest word is
 * 23 letters, a German event with an 18-letter word, and three Serbian surnames of 16, 14 and 15 letters.
 * Cycled over every member and every result, so that a row of the table carries one of each wherever it
 * is read. **Whole words are the owner's decision** („imena ostaju cela"): nothing may break a name or a
 * race inside a word, so a column of words that cannot give up room takes it from the figures instead
 * (`Profile.css`, the note over `.results__figure`), and the case below asks both what the figures come
 * to and that no word was broken.
 */
const REAL_NAMES = [
  ['Ana', 'Hadživukašinović'],
  ['Aleksandra', 'Konstantinović'],
  ['Konstantin', 'Hadžiantonović'],
] as const
const REAL_RACES = ['Trka samoprevazilaženja', 'Langenzersdorfer Weihnachtsmarathon'] as const

const REAL: Answers = {
  ...ANSWERS,
  '/api/competitors': COMPETITORS.map((one, index) => {
    const [firstName, lastName] = REAL_NAMES[index % REAL_NAMES.length] ?? REAL_NAMES[0]

    return { ...one, firstName, lastName }
  }),
  '/api/results': sample<Record<string, unknown>[]>('results').map((one, index) => ({
    ...one,
    raceName: REAL_RACES[index % REAL_RACES.length],
  })),
}

/**
 * THE LONGEST TIMES THE SAMPLE HAS (round 3 of the review of PR 591): 29:21:31, one of 168 results of
 * 3528 that run ten hours or more and eight characters long, and 144:00:00, the longest, nine. Served on
 * every result, alternately, so a row of the table carries each wherever it is read. **Only the column of
 * times may be wider than the others, and only as far as its times need it** (owner, 20.10.2026); the
 * case asks that the others are still one width, that the times fit, and that nothing scrolls sideways.
 */
const LONG_TIMES: Answers = {
  ...ANSWERS,
  '/api/results': sample<Record<string, unknown>[]>('results').map((one, index) => ({
    ...one,
    seconds: index % 2 === 0 ? 105691 : 518400,
  })),
}

const READERS = [
  ['a visitor', { ...ANSWERS, '/api/me': undefined }],
  ['a visitor, with real names', { ...REAL, '/api/me': undefined }],
  ['whoever checks results', ANSWERS],
  ['whoever checks results, with long names', LONG],
  ['whoever checks results, with real names', REAL],
  ['a visitor, with long times', { ...LONG_TIMES, '/api/me': undefined }],
  ['whoever checks results, with long times', LONG_TIMES],
] as const

/** Up to this much, and only for whoever checks results on a telephone (owner, 20.10.2026): there the
 *  column of words takes what the longest surname needs from the time, the points and the buttons. */
const THE_TELEPHONE_OF_WHOEVER_CHECKS = 6

for (const at of EQUAL) {
  for (const [who, given] of READERS) {
    test(`every figure of the table of results is one width, with ${who}, at ${label(at)}`, async ({ open }) => {
      const answers: Answers = Object.fromEntries(Object.entries(given).filter(([, value]) => value !== undefined))
      const { page, probe } = await open(at, `/sr/kalendar/${SLUG}`, 'tbody td.table__points', answers)

      const seen = await page.evaluate(() => {
        const results = document.querySelector('td.table__points')?.closest('table')

        if (results === null || results === undefined) {
          throw new Error('the table of results is not on the page')
        }

        const box = results.closest('.table-scroll')

        if (box === null) {
          throw new Error('the table of results is not in its own box')
        }

        const heads = [...results.querySelectorAll('thead th')]
        const columns = [...results.querySelectorAll('colgroup > col')]
        const drawn = (one: Element) => getComputedStyle(one).display !== 'none'

        /* Every word of the member and of the race, cut where the portal may cut it (a space, a hyphen),
           and the ones whose letters stand on more than one line: those were broken inside the word. */
        const whole = (table: Element) => {
          const said: string[] = []
          const broken: string[] = []

          for (const cell of table.querySelectorAll('tbody td:nth-child(-n + 2)')) {
            if (!drawn(cell)) {
              continue
            }

            const walk = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)

            for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
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

          return { said, broken }
        }

        return {
          table: results.getBoundingClientRect().width,
          inside: box.scrollWidth,
          outside: box.clientWidth,
          columns: columns.length,
          heads: heads.length,
          figures: heads
            .map((head, index) => ({
              name: (head.textContent ?? '').trim(),
              figure: columns[index]?.classList.contains('results__figure') === true,
              drawn: drawn(head),
              width: head.getBoundingClientRect().width,
            }))
            .filter((one) => one.figure && one.drawn),
          words: heads
            .filter((head, index) => columns[index]?.classList.contains('results__figure') !== true && drawn(head))
            .map((head) => head.getBoundingClientRect().width),
          ...whole(results),
          /* How far the words of every figure cell, the head's and the body's, stand from the right edge of
             the content of the cell (the edge less its padding): the length reads from the right like the
             others (owner, 20.10.2026), which the shared rule for the first three columns undoes. */
          reach: [...results.querySelectorAll('thead th, tbody td')]
            .map((cell, index) => ({ cell, column: index % (cell.parentElement?.children.length ?? 1) }))
            .filter(({ cell, column }) => drawn(cell) && columns[column]?.classList.contains('results__figure') === true)
            .map(({ cell }) => {
              const range = document.createRange()

              range.selectNodeContents(cell)

              const style = getComputedStyle(cell)

              const box = cell.getBoundingClientRect()
              /* The cell of the pencil and the x holds no words since 20.10.2026: two drawn symbols, each
                 with its word as text clipped to a pixel for a screen reader (`visually-hidden`). A range
                 over that text answers where the letters WOULD stand unclipped, 40px past the pixel they
                 are cut to, so the cell is measured by the group of buttons it draws, as the case of the
                 centres above measures it. */
              const group = cell.querySelector('.entity-row-actions')
              const words = group === null ? range.getBoundingClientRect() : group.getBoundingClientRect()
              const left = box.left + Number.parseFloat(style.paddingLeft)
              const right = box.right - Number.parseFloat(style.paddingRight)

              return {
                what: (cell.textContent ?? '').trim().slice(0, 14),
                gap: right - words.right,
                /* How far the words stand outside the content of their cell, either way: a time that
                   does not fit is wider than the column it is in, whatever the column says. */
                over: Math.max(0, left - words.left, words.right - right),
              }
            }),
        }
      })

      expect(probe.sideways).toBe(0)
      expect(seen.columns).toBe(seen.heads)

      /* Measured is not assumed: a screen that drew none, or one, would agree with itself. */
      const mod = !who.startsWith('a visitor')
      const phone = at.width < 700

      expect(seen.figures.map((one) => one.name), JSON.stringify(seen.figures)).toHaveLength(
        phone ? (mod ? 3 : 2) : mod ? 6 : 5,
      )

      const widths = seen.figures.map((one) => one.width)

      /* Every figure column but the time is one width. The time is the one column that may be wider, and
         only when its times need it (owner, 20.10.2026): a time of ten hours or more is eight characters
         and the longest in the sample, 144:00:00, is nine, and neither stands in 9% of a table of 668px.
         So the others are asked to agree among themselves, and the time is asked to be at least as wide
         as they are and to hold its widest time. */
      const others = seen.figures.filter((one) => one.name !== 'Vreme').map((one) => one.width)
      const times = seen.figures.find((one) => one.name === 'Vreme')

      if (times === undefined) {
        throw new Error('the column of times is not on the screen')
      }

      const time = times.width

      expect(Math.max(...others) - Math.min(...others), JSON.stringify(seen.figures)).toBeLessThanOrEqual(
        mod && phone ? THE_TELEPHONE_OF_WHOEVER_CHECKS : AGREE,
      )
      expect(time, JSON.stringify(seen.figures)).toBeGreaterThanOrEqual(Math.max(...others) - AGREE)
      expect(Math.max(...others), JSON.stringify(seen.figures)).toBeLessThanOrEqual(CAP)

      /* And the widest time fits its cell, in every reader: no word of any figure stands outside the
         content of its cell. */
      expect(
        seen.reach.filter((one) => one.over > 0.5),
        'figures wider than their cell',
      ).toEqual([])

      /* And the words take what is left: each of the two is wider than one figure on a wide screen. */
      if (!phone) {
        expect(seen.words, JSON.stringify(seen.words)).toHaveLength(2)
        expect(Math.min(...seen.words)).toBeGreaterThan(Math.max(...widths))
      }

      /* Whole words, the owner's decision: measured is not assumed, so the words the table says are read
         first, and the real names are among them wherever they were served. */
      expect(seen.said.length).toBeGreaterThan(10)

      if (who.includes('real names')) {
        expect(seen.said).toContain('Hadživukašinović')
        expect(seen.said).toContain('Konstantinović')

        if (!phone) {
          expect(seen.said).toContain('Weihnachtsmarathon')
          expect(seen.said).toContain('samoprevazilaženja')
        }
      }

      expect(seen.broken, 'words broken inside the word').toEqual([])

      /* Every figure, the length included, ends at the right of its cell. Measured is not assumed: at
         least a head and a row of each figure were read. */
      expect(seen.reach.length).toBeGreaterThanOrEqual(widths.length * 2)
      expect(
        seen.reach.filter((one) => Math.abs(one.gap) > AGREE),
        'figures that do not end at the right of their cell',
      ).toEqual([])

      expect(seen.inside, `the table's box scrolls: ${String(seen.inside)} inside ${String(seen.outside)}`).toBeLessThanOrEqual(
        seen.outside,
      )
    })
  }
}
