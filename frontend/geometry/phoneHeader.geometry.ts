import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { label, SLACK, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE HEADER OF A TELEPHONE, ASKED OF CHROME (owner, 16.11.2026, PDL „Pravilnik prelazi u podnožje, a Timovi
 * postaju treća kartica BTL tabela”): „na mobilnom želim da u prvom redu ide logo BTL sa tekstom i motoom, a
 * pored izbor jezika, a onda u donjem redu 7 ili 8 jednakih dugmića po širini ekrana gde se prikazuju simboli
 * za svaku od stavki (poslednja stavka je sličica ulogovanog korisnika, ukoliko postoji).”
 *
 * <p>What jsdom cannot answer: that the cells are one row, equally wide, across the whole column, that the
 * picture is the last of them on the screen and not only in the document, that each is a target of at least
 * 24px (WCAG 2.2 SC 2.5.8) and takes the press, that the first row holds the mark and the language without
 * breaking, and that from 700px up none of it is drawn and the words stand where they stood. The order of
 * the document, the names and the symbols are vitest's (`src/app/phoneHeader.test.tsx`).
 *
 * <p>The widths are the ones the owner's list and the review of PR 752 name for a telephone (320, 360, 375,
 * 414) and the last pixel under 700; the text runs from 100 to 200%, and at 200% a window of 1280px is read
 * as one of 640 by the query in `em`, so it gets the row as well (`app/phoneHeader.ts`).
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers. */
function everyAnswer(dir = MOCK, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(
    readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, unknown][] => {
      const at = join(dir, entry.name)

      if (entry.isDirectory()) {
        return Object.entries(everyAnswer(at, `${prefix}${entry.name}/`))
      }

      return entry.name.endsWith('.json')
        ? [[`/api/${prefix}${entry.name.slice(0, -'.json'.length)}`, JSON.parse(readFileSync(at, 'utf-8'))]]
        : []
    }),
  )
}

const SAMPLE = everyAnswer()

/** A member of the sample whose fee stands. */
const HIM = (() => {
  const all = SAMPLE['/api/competitors']

  return { ...(Array.isArray(all) ? all[0] : {}), active: true, membershipBasis: 'payment' }
})()

/** Who reads the header, what the server says about him, and the last cell of his row. */
const READERS: { who: string; answers: Answers; cells: number; last: (page: Page) => Locator }[] = [
  {
    who: 'a visitor',
    answers: SAMPLE,
    cells: 7,
    last: (page) => page.getByRole('link', { name: 'Učlani se' }),
  },
  {
    who: 'a member',
    answers: { ...SAMPLE, '/api/me': { role: 'competitor', account: 1, member: HIM, mailLanguage: 'sr' } },
    cells: 7,
    last: (page) => page.getByRole('button', { name: 'Otvori nalog' }),
  },
  {
    /* Somebody who registered and has not paid: a record with no member number, and no envelope. */
    who: 'somebody who has not paid',
    answers: {
      ...SAMPLE,
      '/api/me': { role: 'competitor', account: 4, member: { firstName: 'Tara', lastName: 'Stanić' }, mailLanguage: 'sr' },
    },
    cells: 6,
    last: (page) => page.getByRole('button', { name: 'Otvori moj meni' }),
  },
  {
    who: 'the administration',
    answers: { ...SAMPLE, '/api/me': { role: 'superadmin', account: 41, mailLanguage: 'sr' } },
    cells: 8,
    last: (page) => page.getByRole('button', { name: 'Otvori nalog' }),
  },
]

const ON_A_TELEPHONE: At[] = [
  { width: 320, text: 100 },
  { width: 360, text: 100 },
  { width: 375, text: 100 },
  { width: 414, text: 100 },
  { width: 699, text: 100 },
  { width: 360, text: 150 },
  { width: 360, text: 200 },
  { width: 1280, text: 200 },
]

/** The widths at which the first row is the mark, the name on one line, and the language. */
const NAME_ON_ONE_LINE = new Set(['360px, text 100%', '375px, text 100%', '414px, text 100%', '699px, text 100%'])

const ON_A_DESKTOP: At[] = [
  { width: 700, text: 100 },
  { width: 768, text: 100 },
  { width: 1024, text: 100 },
  { width: 1280, text: 100 },
]

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number }

const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((element) => {
    const { left, right, top, bottom, width, height } = element.getBoundingClientRect()

    return { left, right, top, bottom, width, height }
  })

/** The controls the header draws as cells, in the order the document has them: the links of the
 *  navigation, then the envelope and the picture, or the two links of a visitor. */
async function cellsOf(page: Page): Promise<Locator[]> {
  const navigation = page.getByRole('navigation', { name: 'Glavna navigacija' })
  const own = [
    page.getByRole('button', { name: /^Otvori poruke/ }),
    page.getByRole('button', { name: 'Otvori nalog' }),
    page.getByRole('button', { name: 'Otvori moj meni' }),
    page.getByRole('link', { name: 'Prijavi se' }),
    page.getByRole('link', { name: 'Učlani se' }),
  ]
  const drawn: Locator[] = []

  for (const one of own) {
    if ((await one.count()) > 0) {
      drawn.push(one)
    }
  }

  return [...(await navigation.getByRole('link').all()), ...drawn]
}

/** Whether the pointer at the middle of this control lands on it and not on something laid over it. */
async function takesThePress(control: Locator): Promise<boolean> {
  return control.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)

    return hit !== null && element.contains(hit)
  })
}

/** How many lines the first piece of text in an element is laid out on, read off the boxes the browser
 *  gives its lines. The first text node alone, so that the count of administration beside its word, which
 *  stands a little higher, is not read as a second line. */
async function linesOf(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const range = document.createRange()
    const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()

    range.selectNodeContents(text ?? element)

    return new Set([...range.getClientRects()].filter((one) => one.width > 1).map((one) => Math.round(one.top))).size
  })
}

for (const reader of READERS) {
  for (const at of ON_A_TELEPHONE) {
    test(`the row of ${reader.who} is ${reader.cells} equal cells across the column at ${label(at)}`, async ({ open }) => {
      const { page, probe } = await open(at, '/sr/kalendar', 'header .brand', reader.answers)

      await expect(reader.last(page)).toBeVisible()

      const cells = await cellsOf(page)
      const boxes = await Promise.all(cells.map(boxOf))
      /* The column the header is laid in: from where the mark begins to where the language ends, which is
         the gutter of the bar at each end (and the middle 1100px of a wider window). */
      const column = {
        left: (await boxOf(page.getByRole('link', { name: 'Naslovna strana' }))).left,
        right: (await boxOf(page.getByRole('button', { name: 'Jezik, SR' }))).right,
      }

      expect(probe.sideways).toBe(0)
      expect(probe.widened).toBe(0)
      expect(cells).toHaveLength(reader.cells)

      const widths = boxes.map((one) => one.width)
      const tops = boxes.map((one) => one.top)

      /* Equal, and in one row. */
      expect(Math.max(...widths) - Math.min(...widths), `the widths ${widths.join(', ')}`).toBeLessThanOrEqual(SLACK)
      expect(Math.max(...tops) - Math.min(...tops), `the tops ${tops.join(', ')}`).toBeLessThanOrEqual(SLACK)
      /* Across the column: from the gutter at the left to the gutter at the right. */
      expect(Math.abs((boxes[0]?.left ?? Number.NaN) - column.left)).toBeLessThanOrEqual(SLACK)
      expect(Math.abs((boxes.at(-1)?.right ?? Number.NaN) - column.right)).toBeLessThanOrEqual(SLACK)

      for (const [index, box] of boxes.entries()) {
        expect(box.width, `cell ${index} is a target of 24px at least`).toBeGreaterThanOrEqual(24)
        expect(box.height, `cell ${index} is a target of 24px at least`).toBeGreaterThanOrEqual(24)
        /* Left to right in the order of the document, so the last one read is the last one seen. */
        expect(box.left, `cell ${index} stands after the one before it`).toBeGreaterThan(boxes[index - 1]?.left ?? -1)
        expect(await takesThePress(cells[index] ?? page.locator('nothing')), `cell ${index} takes the press`).toBe(true)
      }

      /* The last cell on the screen is the picture of a signed in reader, and the gold link of a visitor. */
      const last = await boxOf(reader.last(page))

      expect(last.right).toBeCloseTo(boxes.at(-1)?.right ?? Number.NaN, 1)

      /* What each cell shows is drawn inside it: with the text at 200% a symbol grows until its cell is
         full and not past it. */
      const spilling = await page.evaluate(() =>
        [...document.querySelectorAll('header svg[data-symbol], header .inbox__glyph, header .account__btn > *')].flatMap((drawing) => {
          const cell = drawing.closest('a, button')
          const inner = drawing.getBoundingClientRect()
          const outer = cell?.getBoundingClientRect()

          return outer && (inner.left < outer.left - 0.5 || inner.right > outer.right + 0.5)
            ? [`${cell?.getAttribute('aria-label') ?? cell?.textContent ?? ''}: ${inner.width} in ${outer.width}`]
            : []
        }),
      )

      expect(spilling).toEqual([])
    })

    test(`the first row of ${reader.who} is the mark and the language, above the row, at ${label(at)}`, async ({ open }) => {
      const { page } = await open(at, '/sr/kalendar', 'header .brand', reader.answers)

      await expect(reader.last(page)).toBeVisible()

      const brand = await boxOf(page.getByRole('link', { name: 'Naslovna strana' }))
      const language = await boxOf(page.getByRole('button', { name: 'Jezik, SR' }))
      const first = await boxOf((await cellsOf(page))[0] ?? page.locator('nothing'))
      const width = await page.evaluate(() => document.documentElement.clientWidth)

      /* Beside each other, the language at the right edge of the column and inside it. */
      expect(language.left).toBeGreaterThanOrEqual(brand.right)
      expect(language.right).toBeLessThanOrEqual(width + SLACK)
      expect(language.top).toBeGreaterThanOrEqual(brand.top - SLACK)
      expect(language.bottom).toBeLessThanOrEqual(brand.bottom + SLACK)
      /* And the row of cells under both. */
      expect(first.top).toBeGreaterThanOrEqual(Math.max(brand.bottom, language.bottom) - SLACK)

      /* „Ime lige ostaje iste veličine” and stands on one line where the decision measured it would. */
      if (NAME_ON_ONE_LINE.has(label(at))) {
        expect(await linesOf(page.locator('.brand__name'))).toBe(1)
      }
    })
  }
}

/* THE FLAG AND THE CARET OF THE LANGUAGE BUTTON NEVER OVERLAP (owner, 23.11.2026: the room between them was taken
   back to make the caret of the dropdowns fit, „U redu”, on condition that they never overlap). Asked of the boxes:
   the right edge of the flag is at most the left edge of the caret box, and neither box holds the other. Measured:
   the drawn chevron is 2px from the flag at 100% text, 4px at 200%. Every width of a telephone. */
for (const width of [320, 360, 390, 414]) {
  for (const text of [100, 200] as const) {
    {
      const at: At = { width, text }

      test(`the flag and the caret of the language never overlap at ${label(at)}`, async ({ open }) => {
        const reader = READERS[0]

        if (reader === undefined) {
          throw new Error('the visitor is the first reader')
        }

        const { page } = await open(at, '/sr/kalendar', 'header .brand', reader.answers)
        const flag = await boxOf(page.locator('.lang__btnflag'))
        const caret = await boxOf(page.locator('.lang__caret'))

        expect(flag.width, 'the flag has no box').toBeGreaterThan(0)
        expect(caret.width, 'the caret has no box').toBeGreaterThan(0)
        expect(flag.right, 'the flag runs into the caret').toBeLessThanOrEqual(caret.left + SLACK)

        const holds = (outer: Box, inner: Box) =>
          outer.left <= inner.left && outer.right >= inner.right && outer.top <= inner.top && outer.bottom >= inner.bottom

        expect(holds(flag, caret) || holds(caret, flag), 'one box holds the other').toBe(false)
      })
    }
  }
}

for (const at of ON_A_DESKTOP) {
  test(`a desktop draws the words under the first row and no row of symbols at ${label(at)}`, async ({ open }) => {
    const reader = READERS[3]

    if (reader === undefined) {
      throw new Error('the administration is the fourth reader')
    }

    const { page, probe } = await open(at, '/sr/kalendar', 'header .brand', reader.answers)

    await expect(page.getByRole('link', { name: /^Administracija/ })).toBeVisible()

    expect(probe.sideways).toBe(0)

    const links = await page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('link').all()
    const envelope = await boxOf(page.getByRole('button', { name: /^Otvori poruke/ }))
    const picture = await boxOf(page.getByRole('button', { name: 'Otvori nalog' }))

    expect(links).toHaveLength(6)
    expect(await page.locator('header svg[data-symbol]').count(), 'symbols drawn on a desktop').toBe(0)

    for (const link of links) {
      const box = await boxOf(link)

      /* The envelope and the picture stand in the first row, above every word. */
      expect(box.top).toBeGreaterThanOrEqual(Math.max(envelope.bottom, picture.bottom) - SLACK)
      expect(await linesOf(link)).toBe(1)
    }
  })
}

/* ON A TABLET THE LANGUAGE, THE ENVELOPE AND THE PICTURE STAND IN THE ROW OF THE MARK (owner, 17.11.2026: „na
   tablet verziji izbor jezika, koverta i profilna slicica treba da ostanu u redu gde je logo, posto se dole
   reci ispisuju cele za navigaciju.”), or the language and the two links of a visitor, for every reader, at
   the widths of a tablet and at the first width of a desktop. In the row of the mark means level with it:
   each control's box and the mark's share a band of height, and every word of the navigation is below both.
   On QA the two development controls have a row of their own so that they do not take these with them
   (`app/Shell.tsx`; their place is vitest's, `app/phoneHeaderOnQa.test.tsx`, because this build has none). */
for (const at of [
  { width: 700, text: 100 },
  { width: 768, text: 100 },
  { width: 820, text: 100 },
  { width: 1024, text: 100 },
] satisfies At[]) {
  for (const reader of READERS) {
    test(`a tablet keeps the language and the controls of ${reader.who} in the row of the mark at ${label(at)}`, async ({ open }) => {
      const { page } = await open(at, '/sr/kalendar', 'header .brand', reader.answers)

      await expect(reader.last(page)).toBeVisible()

      const mark = await boxOf(page.locator('header .brand'))
      const words = await page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('link').all()
      /* The reader's own controls are what `cellsOf` finds after the words: the envelope and the picture,
         the picture alone, or the two links of a visitor. */
      const own = (await cellsOf(page)).slice(words.length)
      const controls = [page.getByRole('button', { name: 'Jezik, SR' }), ...own]

      expect(own.length, `the controls of ${reader.who}`).toBe(reader.who === 'somebody who has not paid' ? 1 : 2)

      for (const control of controls) {
        const box = await boxOf(control)
        const name = await control.evaluate((element) => element.getAttribute('aria-label') ?? element.textContent)

        expect(box.top < mark.bottom && mark.top < box.bottom, `${String(name)} is not in the row of the mark`).toBe(true)

        for (const word of words) {
          expect((await boxOf(word)).top, `${String(name)} is not above the words`).toBeGreaterThanOrEqual(box.bottom - SLACK)
        }
      }
    })
  }
}

/* The panels hang from the row (`app/Shell.css`, `.shell__cells`), so they keep to the column wherever the row
   is drawn: at 360px, where the row and the header are one box, and at 1280px with the text at 200%, where the
   column is the middle 1100px of the window and a panel hung from the header stood 82px past it
   (`scripts/header-panels-geometry.mjs`, 17.11.2026). */
for (const at of [
  { width: 360, text: 100 },
  { width: 1280, text: 200 },
] satisfies At[]) {
  test(`the panel of the picture opens under it and inside the column on a telephone at ${label(at)}`, async ({ open }) => {
    const reader = READERS[1]

    if (reader === undefined) {
      throw new Error('the member is the second reader')
    }

    const { page } = await open(at, '/sr/kalendar', 'header .brand', reader.answers)
    const button = page.getByRole('button', { name: 'Otvori nalog' })
    const column = {
      left: (await boxOf(page.getByRole('link', { name: 'Naslovna strana' }))).left,
      right: (await boxOf(page.getByRole('button', { name: 'Jezik, SR' }))).right,
    }

    await button.click()

    const panel = page.locator('#account-menu')

    await expect(panel).toBeVisible()

    const opened = await boxOf(panel)
    const under = await boxOf(button)

    expect(opened.top).toBeGreaterThanOrEqual(under.bottom)
    expect(opened.left).toBeGreaterThanOrEqual(column.left - SLACK)
    expect(opened.right).toBeLessThanOrEqual(column.right + SLACK)
    /* Its right edge is the right edge of the row, which is where the picture ends. */
    expect(Math.abs(opened.right - under.right)).toBeLessThanOrEqual(SLACK)
  })
}
