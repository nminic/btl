import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { THE_DAY_THE_SUITE_IS_READ_AS } from '../src/test/theDay.ts'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE FRONT PAGE AFTER THE FOUR ADDITIONS (owner, 20.11.2026, PDL „Četiri dodatka naslovne iz tuđeg nacrta"),
 * MEASURED IN CHROME AT 360, 768, 860, 1024 AND 1280.
 *
 * jsdom lays nothing out, so every sentence below is a measurement and not a reading of the stylesheet:
 *
 * - **the figures**: eight tiles, each one line high and all of one height (so none is in a second row), the
 *   points in the short shape where the tile is narrow and in the whole sentence where it is wide;
 * - **the filter by length**: six buttons in ONE row, of one height, none of them breaking its text, none of
 *   them wider than the card, and only the „km" gone where there is no room;
 * - **the podium**: the first in the middle and the highest, the second lower, the third lowest, with the
 *   first circle the largest, on both boards and at every width;
 * - **the list from the fourth place**: the number, the circle, the name, the category and the points in the
 *   same columns in all seven rows, whichever of the two shapes the board is drawn in;
 * - **the right column is a column of its own**: the calendar begins one gap under the figures and not
 *   where the boards end, and both columns end on one line;
 * - **no sideways scroll** at any of them.
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers (`/api/results/runners` from `results/runners.json`). */
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

/**
 * The longest surnames and first names a member of the league can reasonably carry, put on every member of the
 * sample (review, 21.11.2026: „Milovanović" and „Stamenkovska" broke inside the word at 860 and 1024), so the
 * podium is measured with the names that are hardest for a column of 62 to 93px.
 */
const LONG_LAST = ['Stamenkovska', 'Gvozdenović', 'Milovanović', 'Jovanovićević', 'Vukićević', 'Đorđevićka']
const LONG_FIRST = ['Aleksandar', 'Strahinja', 'Radoslava', 'Aleksandra', 'Ivona', 'Dragoslav']

const MEMBERS = everyAnswer()['/api/competitors']

/**
 * The first result of every member raised by 399.000 points (owner, 21.11.2026: the podium prints the BTL
 * points of the whole history while the league warms up, as the number alone, "399.999,99"), so the figure
 * the podium and the list have to hold is of that length and not the two-digit one of the sample.
 */
const RESULTS = everyAnswer()['/api/results']
const SEEN = new Set<unknown>()

const ANSWERS: Answers = {
  ...everyAnswer(),
  '/api/results': (Array.isArray(RESULTS) ? RESULTS : []).map((one: Record<string, unknown>) => {
    const first = !SEEN.has(one.memberNumber)

    SEEN.add(one.memberNumber)

    return first && typeof one.points === 'number' ? { ...one, points: one.points + 399000 } : one
  }),
  '/api/competitors': (Array.isArray(MEMBERS) ? MEMBERS : []).map((one: Record<string, unknown>, index: number) => ({
    ...one,
    firstName: LONG_FIRST[index % LONG_FIRST.length],
    lastName: LONG_LAST[index % LONG_LAST.length],
  })),
}

/** Half a pixel: a box of a fraction of a pixel is the same box. */
const SAME = 0.5

const WIDTHS: At[] = [360, 540, 560, 768, 860, 1024, 1280].map((width): At => ({ width, text: 100 }))

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number }

for (const at of WIDTHS) {
  test(`the front page keeps its figures, filter, podium and list in shape, at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr', '.top10 .stand', ANSWERS)

    const seen = await page.evaluate(() => {
      const box = (element: Element): Box => {
        const { top, bottom, left, right, width, height } = element.getBoundingClientRect()

        return { top, bottom, left, right, width, height }
      }

      /** The distinct lines of the words a person sees inside an element: the text that is not for a reader only. */
      const lines = (element: Element): number => {
        const tops = new Set<number>()
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)

        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const parent = node.parentElement

          if (
            parent === null ||
            parent.closest('.visually-hidden') !== null ||
            (node.textContent ?? '').trim() === '' ||
            getComputedStyle(parent).display === 'none'
          ) {
            continue
          }

          const range = document.createRange()

          range.selectNodeContents(node)

          for (const one of range.getClientRects()) {
            if (one.height > 0) {
              tops.add(Math.round(one.top))
            }
          }
        }

        return tops.size
      }

      const tiles = [...document.querySelectorAll('.scoreboard .score')].map((tile) => {
        const pill = must(tile.querySelector('.score__pill'))
        const full = tile.querySelector('.score__full')

        return {
          ...box(tile),
          lines: lines(pill),
          overflows: pill.scrollWidth > pill.clientWidth + 0.5,
          shape: full === null ? 'one' : getComputedStyle(full).display === 'none' ? 'short' : 'full',
          text: [...pill.childNodes]
            .flatMap((one) => (one instanceof HTMLElement && getComputedStyle(one).display === 'none' ? [] : [one.textContent ?? '']))
            .join('')
            .slice(0, 60),
        }
      })

      const figures = must(document.querySelector('.home__figures'))
      const next = must(document.querySelector('.home__next'))
      const card = must(next.querySelector('.card'))
      const seg = must(card.querySelector('.seg'))
      const cardInner = (() => {
        const style = getComputedStyle(card)

        return {
          left: card.getBoundingClientRect().left + Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth),
          right: card.getBoundingClientRect().right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth),
        }
      })()

      const buttons = [...seg.querySelectorAll('.seg__b')].map((one) => ({
        ...box(one),
        lines: lines(one),
        overflows: one.scrollWidth > one.clientWidth + 0.5,
        text: (one.textContent ?? '').trim().slice(0, 40),
        unit: (() => {
          const km = one.querySelector('.seg__km')

          return km === null ? 'none' : getComputedStyle(km).display === 'none' ? 'gone' : 'shown'
        })(),
      }))

      const boards = [...document.querySelectorAll('.top10')].map((board) => {
        const places = [...board.querySelectorAll('.stand__item')].map((item) => ({
          circle: box(must(item.querySelector('.portrait'))),
          step: box(must(item.querySelector('.stand__step'))),
          name: box(must(item.querySelector('.stand__name'))),
          /* A place nobody stands on has no figure to measure (the other day the podium is empty). */
          pointsLines: item.querySelector('.stand__points') === null ? 0 : lines(must(item.querySelector('.stand__points'))),
          pointsText: item.querySelector('.stand__points')?.textContent ?? '',
          pointsOver: (() => {
            const figure = item.querySelector('.stand__points')

            return figure === null
              ? 0
              : Math.round((box(figure).right - item.getBoundingClientRect().right) * 10) / 10
          })(),
          who: (item.querySelector('.stand__name')?.textContent ?? '') + ' | ' + (item.querySelector('.stand__points')?.textContent ?? ''),
          nameLines: [...item.querySelectorAll('.stand__first, .stand__last')].map((one) => Math.round(one.getBoundingClientRect().height)),
          lines: [...item.querySelectorAll('.stand__first, .stand__last')].map((one) => lines(one)),
          fonts: [...item.querySelectorAll('.stand__first, .stand__last')].map((one) => Number.parseFloat(getComputedStyle(one).fontSize)),
          wider: [...item.querySelectorAll('.stand__first, .stand__last')].map((one) => {
            const line = one.getBoundingClientRect()
            const column = item.getBoundingClientRect()

            return Math.round(Math.max(column.left - line.left, line.right - column.right) * 10) / 10
          }),
          first: box(item.querySelector('.stand__first') ?? must(item.querySelector('.stand__name'))),
          last: box(item.querySelector('.stand__last') ?? must(item.querySelector('.stand__name'))),
          item: box(item),
        }))

        const rows = [...board.querySelectorAll('.toprow')]
          .filter((row) => !row.classList.contains('toprow--empty'))
          .map((row) => ({
            row: box(row),
            no: box(must(row.querySelector('.no'))),
            circle: box(must(row.querySelector('.portrait'))),
            name: box(must(row.querySelector('.nm'))),
            category: box(must(row.querySelector('.kt'))),
            points: box(must(row.querySelector('.pt'))),
            cut: ((): boolean => {
              const name = must(row.querySelector('.nm'))

              return name.scrollWidth > name.clientWidth + 0.5
            })(),
          }))

        return { board: box(board), places, rows, category: rows.length > 0 && head(rows).category.top > head(rows).name.top + 2 }

        function head<T>(list: T[]): T {
          return must(list[0])
        }
      })

      function optional(value: Element | null): Box | null {
        return value === null ? null : box(value)
      }

      function must<T>(value: T | null | undefined): T {
        if (value === null || value === undefined) {
          throw new Error('something the front page draws is not there')
        }

        return value
      }

      return {
        tiles,
        buttons,
        seg: box(seg),
        cardInner,
        figures: box(figures),
        next: box(next),
        left: optional(document.querySelector('.home__colL')),
        right: optional(document.querySelector('.home__colR')),
        /* The boxes of the page as they are written and as they stand: on a phone the children of the grid, from
           two columns on the children of the two columns. */
        written: [...document.querySelectorAll('.home__split > *, .home__colL > *, .home__colR > *')].flatMap((one) => {
          const name = [...one.classList].find((each) => /^home__(boards|figures|chart|next|address|sponsor|calc)$/.test(each))

          return name === undefined ? [] : [{ name: name.slice('home__'.length), top: one.getBoundingClientRect().top, left: one.getBoundingClientRect().left }]
        }),
        boards,
      }
    })

    /* What is measured is there, or every loop below passes over nothing. */
    expect(seen.tiles).toHaveLength(8)
    expect(seen.buttons).toHaveLength(6)
    expect(seen.boards).toHaveLength(2)

    console.log(`MEASURED ${label(at)} ${JSON.stringify({
      tileHeights: [...new Set(seen.tiles.map((one) => Math.round(one.height * 10) / 10))],
      pointsShape: seen.tiles.at(-1)?.shape,
      pointsText: seen.tiles.at(-1)?.text,
      buttonTops: [...new Set(seen.buttons.map((one) => Math.round(one.top * 10) / 10))],
      buttonHeights: [...new Set(seen.buttons.map((one) => Math.round(one.height * 10) / 10))],
      units: seen.buttons.map((one) => one.unit).join(','),
      segInCard: [Math.round(seen.seg.left * 10) / 10, Math.round(seen.seg.right * 10) / 10, Math.round(seen.cardInner.left * 10) / 10, Math.round(seen.cardInner.right * 10) / 10],
      circleTops: seen.boards.map((one) => one.places.map((place) => Math.round(place.circle.top * 10) / 10)),
      circleSizes: seen.boards.map((one) => one.places.map((place) => Math.round(place.circle.width))),
      who: seen.boards.map((one) => one.places.map((place) => `${place.who} ${JSON.stringify(place.nameLines)} ${Math.round(place.name.height)}`)),
      categoryUnderName: seen.boards.map((one) => one.category),
      boardWidths: seen.boards.map((one) => Math.round(one.board.width * 10) / 10),
      nextMinusFigures: Math.round((seen.next.top - seen.figures.bottom) * 10) / 10,
      columnEnds: [Math.round((seen.left?.bottom ?? 0) * 10) / 10, Math.round((seen.right?.bottom ?? 0) * 10) / 10],
      nameFonts: seen.boards.map((one) => one.places.map((place) => place.fonts.map((font) => Math.round(font * 10) / 10))),
      nameWider: seen.boards.map((one) => one.places.map((place) => place.wider)),
    })}`)

    expect(probe.sideways).toBe(0)

    /* V1, the markup is the order it is seen in under 860px (ADL A7, owner, 21.11.2026: „Kod prati ekran"):
       the boxes in the order they are written are the boxes in the order of their tops, which is the order the
       focus and a screen reader go in. From 860px they are two columns and there is no one order of the eye. */
    if (at.width < 860) {
      expect(seen.left, 'a column of a wide page under 860px').toBeNull()
      expect(seen.written.map((one) => one.name)).toEqual(['boards', 'figures', 'chart', 'next', 'address', 'calc'])
      expect(
        seen.written.map((one) => one.name),
        'the order of the markup is not the order of the eye',
      ).toEqual([...seen.written].sort((a, b) => a.top - b.top).map((one) => one.name))
    }

    /* The figures: one line each, all one height, none of them wider than its pill. */
    for (const tile of seen.tiles) {
      expect(tile.lines, `${tile.text} stands in more than one line`).toBe(1)
      expect(tile.overflows, `${tile.text} is wider than its tile`).toBe(false)
    }

    expect(
      Math.max(...seen.tiles.map((one) => one.height)) - Math.min(...seen.tiles.map((one) => one.height)),
      'the tiles are not of one height',
    ).toBeLessThanOrEqual(SAME)

    /* The points are the one tile with two shapes, and what decides is the tile: the whole sentence where it
       is wide enough for it in one line, the short figure where it is not. Whichever is drawn, it is in one line
       (above), which is the whole of „nijedna pločica nema drugi red". */
    expect(['full', 'short']).toContain(seen.tiles.at(-1)?.shape)

    /* The filter: one row, one height, one line in each, none of them out of the card. */
    expect(
      Math.max(...seen.buttons.map((one) => one.top)) - Math.min(...seen.buttons.map((one) => one.top)),
      'the six buttons are not in one row',
    ).toBeLessThanOrEqual(SAME)
    expect(
      Math.max(...seen.buttons.map((one) => one.height)) - Math.min(...seen.buttons.map((one) => one.height)),
      'the six buttons are not of one height',
    ).toBeLessThanOrEqual(SAME)

    for (const one of seen.buttons) {
      expect(one.lines, `${one.text} breaks its text`).toBe(1)
      expect(one.overflows, `${one.text} is wider than its button`).toBe(false)
    }

    expect(seen.seg.left).toBeGreaterThanOrEqual(seen.cardInner.left - SAME)
    expect(seen.seg.right).toBeLessThanOrEqual(seen.cardInner.right + SAME)

    /* V3, where each stands from side to side: the first in the middle of its board, the second to the left of
       it and the third to the right. */
    for (const board of seen.boards) {
      const [first, second, third] = board.places
      const centre = (one: Box | undefined) => ((one?.left ?? 0) + (one?.right ?? 0)) / 2
      const middle = (board.board.left + board.board.right) / 2

      expect(Math.abs(centre(first?.circle) - middle), 'the first is not in the middle').toBeLessThanOrEqual(1)
      expect(centre(second?.circle), 'the second is not left of the first').toBeLessThan(centre(first?.circle) - 10)
      expect(centre(third?.circle), 'the third is not right of the first').toBeGreaterThan(centre(first?.circle) + 10)
    }

    /* V2, the names: two lines each, the first name over the surname, never broken, in a letter that is not
       under the floor, and still inside the column it is in. */
    for (const board of seen.boards) {
      for (const place of board.places) {
        if (place.lines.length === 0) {
          continue // an empty place has no name to measure
        }

        expect(place.lines, `a name is not in one line each: ${place.who}`).toEqual([1, 1])
        expect(place.last.top, 'the surname is not under the first name').toBeGreaterThan(place.first.top)

        for (const wider of place.wider) {
          expect(wider, `a name is wider than its column: ${place.who}`).toBeLessThanOrEqual(SAME)
        }

        for (const font of place.fonts) {
          expect(font, `a name is set under the floor: ${place.who}`).toBeGreaterThanOrEqual(10.4 - 0.1)
        }
      }
    }

    /* The podium: the first highest, then the second, then the third, the first the largest, and the same
       on both boards. */
    for (const board of seen.boards) {
      const [first, second, third] = board.places

      expect(board.places).toHaveLength(3)

      /* The figure of the podium is the number and no letter after it (owner, 21.11.2026): one line, not wider than its place. */
      for (const place of board.places.filter((one) => one.pointsText !== '')) {
        expect(place.pointsText, 'the podium prints something besides the number').toMatch(/^\d[\d.,]*,\d\d$/)
        expect(place.pointsLines, `the points break into lines: ${place.who}`).toBe(1)
        expect(place.pointsOver, `the points are wider than their place: ${place.who}`).toBeLessThanOrEqual(SAME)
      }
      expect(first?.circle.top, 'the first is not above the second').toBeLessThan((second?.circle.top ?? 0) - 1)
      expect(second?.circle.top, 'the second is not above the third').toBeLessThan((third?.circle.top ?? 0) - 1)
      expect(first?.circle.width).toBeGreaterThan((second?.circle.width ?? 0) + 1)
      expect(second?.circle.width).toBe(third?.circle.width)
      /* The block of the name has one height for all three places, so the step decides how high a circle stands. */
      expect(Math.abs((first?.name.height ?? 0) - (second?.name.height ?? 0))).toBeLessThanOrEqual(7)
      expect(second?.name.height).toBe(third?.name.height)
    }

    expect(seen.boards[1]?.places.map((one) => Math.round(one.circle.top - (seen.boards[1]?.board.top ?? 0)))).toEqual(
      seen.boards[0]?.places.map((one) => Math.round(one.circle.top - (seen.boards[0]?.board.top ?? 0))),
    )

    /* The list: every column on one vertical line in all the rows. A board with nobody on it from the fourth
       place (the day the sample is read on decides) has no row, and nothing to measure. */
    for (const board of seen.boards) {
      const column = (name: 'no' | 'circle' | 'name' | 'category' | 'points', edge: 'left' | 'right') =>
        board.rows.map((row) => Math.round(row[name][edge] * 10) / 10)
      const level = (values: number[]) => Math.max(...values) - Math.min(...values)

      expect(level(column('no', 'right')), 'the numbers do not end on one line').toBeLessThanOrEqual(SAME)
      expect(level(column('circle', 'left')), 'the circles do not start on one line').toBeLessThanOrEqual(SAME)
      expect(level(column('name', 'left')), 'the names do not start on one line').toBeLessThanOrEqual(SAME)
      expect(level(column('category', 'left')), 'the categories do not start on one line').toBeLessThanOrEqual(SAME)
      expect(level(column('points', 'right')), 'the points do not end on one line').toBeLessThanOrEqual(SAME)

      /* The category stands under the name on every width, in the name's own column (owner, 21.11.2026), and the
         row is no taller than the 2.75rem it always was (44px, and a pixel of border), so the two boards stay one
         height and the two lines stand inside the height of the circle's row. */
      for (const row of board.rows) {
        expect(row.category.top, 'the category is not under the name').toBeGreaterThanOrEqual(row.name.bottom - SAME)
        expect(Math.abs(row.category.left - row.name.left), 'the category does not start where the name does').toBeLessThanOrEqual(SAME)
        expect(row.cut, 'a name of the list is cut').toBe(false)

      }
    }

    /* The right column, from two columns on: its calendar begins one gap under the figures, and the two
       columns end on one line. */
    if (at.width >= 860) {
      /* V5, the left column from the top: the boards, then the turning chart, then the address (PDL P24). */
      const left = seen.written.filter((one) => ['boards', 'chart', 'address'].includes(one.name)).sort((a, b) => a.top - b.top)

      expect(left.map((one) => one.name)).toEqual(['boards', 'chart', 'address'])
      expect(seen.left, 'no left column').not.toBeNull()
      expect(seen.right, 'no right column').not.toBeNull()
      expect(seen.next.top - seen.figures.bottom, 'the calendar does not begin under the figures').toBeGreaterThan(15)
      expect(seen.next.top - seen.figures.bottom).toBeLessThan(25)
      expect(Math.abs((seen.left?.bottom ?? 0) - (seen.right?.bottom ?? 0)), 'the two columns do not end on one line').toBeLessThanOrEqual(1)
    }
  })
}

/**
 * **THE LONGEST NAMES THE SAMPLE HAS, AT 100, 125 AND 200 PER CENT OF TEXT** (review, 21.11.2026: „Hadžiahmetović"
 * stuck out 4,9px of a column at 560 and 860, „Karađorđević-Obrenović" 30px, and at 125 per cent of text names stuck
 * out at 360, 768 and 1280 as well).
 *
 * Owner, 21.11.2026, „Tri tačke na granici": the letter is made smaller down to the floor, and a name that does not
 * fit even there ends in three dots (`overflow: hidden`, `text-overflow: ellipsis`), the first name and the
 * surname alike, with the whole name in the `title` of the line and in the link over it. He added that he would
 * get the long surnames, double ones for instance, solved in the data.
 *
 * **The names are the sample's own and not a list written here**: the six longest surnames and the six longest first
 * names of `src/test/mock/competitors.json` (the longest of them is a double one), put on the first six members.
 * What is held at every width and every size of text: nothing of a line is outside its column, the whole name is in
 * its `title`, and the link over it says it.
 */
const SAMPLE = Array.isArray(MEMBERS) ? MEMBERS.map((one: Record<string, unknown>) => ({ first: String(one.firstName), last: String(one.lastName) })) : []
const longest = (names: string[]) => [...new Set(names)].sort((a, b) => b.length - a.length).slice(0, 6)
const FIRST_OF_THE_SAMPLE = longest(SAMPLE.map((one) => one.first))
const LAST_OF_THE_SAMPLE = longest(SAMPLE.map((one) => one.last))

const SAMPLE_NAMES: Answers = {
  ...everyAnswer(),
  '/api/competitors': (Array.isArray(MEMBERS) ? MEMBERS : []).map((one: Record<string, unknown>, index: number) => ({
    ...one,
    firstName: FIRST_OF_THE_SAMPLE[index % FIRST_OF_THE_SAMPLE.length],
    lastName: LAST_OF_THE_SAMPLE[index % LAST_OF_THE_SAMPLE.length],
  })),
}

const TEXTS: At['text'][] = [100, 125, 200]
const ALL_TEXTS: At['text'][] = [100, 125, 150, 175, 200]
const BOTH_TEXTS: At['text'][] = [100, 200]

/**
 * THE FIGURE OF THE PODIUM STANDS IN ITS COLUMN AT EVERY TEXT SIZE, IN BOTH LANGUAGES (owner, 21.11.2026, review of
 * PR 768, WCAG 1.4.4 Resize text): the floor of the letter is in `rem`, so at 200% a figure like 399.999,99
 * no longer fits a column of 60px, and a figure kept on one line spilled 14px out of its column and over the
 * next one. What is measured is the text a person sees (the rectangles of its range, since a box that
 * overflows does not make its element wider): inside its own column, clear of the figure beside it and of
 * every circle, and cut by nothing.
 */
for (const width of [360, 540, 768, 1280]) {
  for (const text of ALL_TEXTS) {
    for (const language of ['sr', 'en']) {
      const here: At = { width, text }

      test(`the figures of the podium stay in their columns, at ${label(here)}, in ${language}`, async ({ open, theDay }) => {
        test.skip(theDay !== THE_DAY_THE_SUITE_IS_READ_AS, 'no figure stands on the podium on this day')

        const { page } = await open(here, `/${language}`, '.top10 .stand', ANSWERS)

        const seen = await page.evaluate(() =>
          [...document.querySelectorAll('.top10')].map((board) => {
            const items = [...board.querySelectorAll('.stand__item')]
            const rectsOf = (element: Element) => {
              const range = document.createRange()

              range.selectNodeContents(element)

              return [...range.getClientRects()].filter((one) => one.width > 0)
            }
            const circles = [...board.querySelectorAll('.stand .portrait')].map((one) => one.getBoundingClientRect())

            return items.map((item, index) => {
              const figure = item.querySelector('.stand__points')
              const column = item.getBoundingClientRect()
              const rects = figure === null ? [] : rectsOf(figure)

              return {
                index,
                text: figure?.textContent ?? '',
                over: Math.max(0, ...rects.map((one) => Math.max(column.left - one.left, one.right - column.right))),
                rects: rects.map((one) => ({ left: one.left, right: one.right, top: one.top, bottom: one.bottom })),
                circles: circles.map((one) => ({ left: one.left, right: one.right, top: one.top, bottom: one.bottom })),
              }
            })
          }),
        )

        const meets = (
          a: { left: number; right: number; top: number; bottom: number },
          b: { left: number; right: number; top: number; bottom: number },
        ) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > SAME && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > SAME

        for (const board of seen) {
          for (const place of board.filter((one) => one.text !== '')) {
            expect(place.over, `the figure sticks out of its column: ${place.text}`).toBeLessThanOrEqual(SAME)

            for (const rect of place.rects) {
              for (const circle of place.circles) {
                expect(meets(rect, circle), `the figure runs into a circle: ${place.text}`).toBe(false)
              }

              for (const other of board.filter((one) => one.index !== place.index)) {
                for (const beside of other.rects) {
                  expect(meets(rect, beside), `the figure runs into the one beside it: ${place.text}`).toBe(false)
                }
              }
            }
          }
        }
      })
    }
  }
}

for (const width of [360, 540, 560, 768, 860, 1024, 1280]) {
  for (const text of TEXTS) {
    const here: At = { width, text }

    test(`the longest names of the sample stay inside their columns, at ${label(here)}`, async ({ open, theDay }) => {
      /* The places are held for members who have not raced only until 1.1.2027 (PDL P14, owner 17.10.2026); on the
         other day the podium of the sample is empty and has no name to measure. */
      test.skip(theDay !== THE_DAY_THE_SUITE_IS_READ_AS, 'no name stands on the podium on this day')

      const { page } = await open(here, '/sr', '.top10 .stand', SAMPLE_NAMES)

      const seen = await page.evaluate(() =>
        [...document.querySelectorAll('.stand__item')].flatMap((item) => {
          const column = item.getBoundingClientRect()
          const link = item.querySelector('.top10__face')

          return [...item.querySelectorAll('.stand__first, .stand__last')].map((line) => {
            const box = line.getBoundingClientRect()

            return {
              text: line.textContent ?? '',
              title: line.getAttribute('title') ?? '',
              link: link?.getAttribute('aria-label') ?? '',
              outLeft: Math.round((column.left - box.left) * 10) / 10,
              outRight: Math.round((box.right - column.right) * 10) / 10,
              cut: line.scrollWidth > line.clientWidth + 0.5,
              font: Number.parseFloat(getComputedStyle(line).fontSize),
              floor: 0.65 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
              overflow: getComputedStyle(line).overflow,
              dots: getComputedStyle(line).textOverflow,
            }
          })
        }),
      )

      expect(seen).toHaveLength(12)
      expect(LAST_OF_THE_SAMPLE.some((one) => one.includes('-')), 'the sample has no double surname').toBe(true)

      console.log(`NAMES ${label(here)} cut ${String(seen.filter((one) => one.cut).length)} of ${String(seen.length)} smallest ${String(Math.min(...seen.map((one) => one.font)))} outLeft ${String(Math.max(...seen.map((one) => one.outLeft)))} outRight ${String(Math.max(...seen.map((one) => one.outRight)))} cutOnes ${seen.filter((one) => one.cut).map((one) => one.text).join(',')}`)

      for (const line of seen) {
        expect(line.outLeft, `${line.text} sticks out of its column on the left`).toBeLessThanOrEqual(SAME)
        expect(line.outRight, `${line.text} sticks out of its column on the right`).toBeLessThanOrEqual(SAME)
        expect(line.title, `${line.text} has not its whole name in the title`).toBe(line.text)
        expect(line.link, `the link over ${line.text} does not say it`).toContain(line.text)

        /* What does not fit is cut by its own line and ends in three dots, and only after the letter has gone
           down to the floor: a line that is cut in a letter above the floor was not made small enough. */
        if (line.cut) {
          expect(line.overflow, `${line.text} is cut and not clipped by its line`).toBe('hidden')
          expect(line.dots, `${line.text} is cut and does not end in three dots`).toBe('ellipsis')
          expect(line.font, `${line.text} is cut above the floor`).toBeLessThanOrEqual(line.floor + 0.1)
        }
      }
    })
  }
}

/**
 * **WHAT WAS TYPED IN THE CALCULATOR AND WHERE THE CURSOR WAS SURVIVE THE WIDTH OF TWO COLUMNS** (review,
 * 21.11.2026: on 1280, 10, 100 and 50 typed and the focus in „Spust", then 768: the boxes empty and the focus on
 * the body). Owner, 21.11.2026: only a chosen length and the chart go back to their beginning.
 */
test('the calculator keeps its values and the focus across the width of two columns', async ({ open }) => {
  const { page } = await open({ width: 1280, text: 100 }, '/sr', '.top10 .stand', ANSWERS)

  await page.getByLabel('Dužina (km)').fill('10')
  await page.getByLabel('Uspon (m)').fill('100')
  await page.getByLabel('Spust (m)').fill('50')
  await page.getByLabel('Spust (m)').focus()

  await page.setViewportSize({ width: 768, height: 900 })
  await page.locator('.home__colL').waitFor({ state: 'detached' })

  const seen = await page.evaluate(() => {
    const here = document.activeElement

    return {
      values: ['Dužina (km)', 'Uspon (m)', 'Spust (m)'].map((name) => {
        const input = [...document.querySelectorAll('.home__calc input')].find(
          (one) => one instanceof HTMLInputElement && one.labels?.[0]?.textContent === name,
        )

        return input instanceof HTMLInputElement ? input.value : null
      }),
      focus: here instanceof HTMLInputElement ? (here.labels?.[0]?.textContent ?? '') : (here?.tagName ?? ''),
    }
  })

  expect(seen.values).toEqual(['10', '100', '50'])
  expect(seen.focus).toBe('Spust (m)')
})

test('the focus in a widget that is written again goes back to the same button of it', async ({ open }) => {
  const { page } = await open({ width: 1280, text: 100 }, '/sr', '.top10 .stand', ANSWERS)

  await page.getByRole('button', { name: /^Ultra/ }).click()
  await page.setViewportSize({ width: 768, height: 900 })
  await page.locator('.home__colL').waitFor({ state: 'detached' })

  const focus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? '',
    text: document.activeElement?.textContent ?? '',
  }))

  expect(focus.tag).toBe('BUTTON')
  expect(focus.text).toContain('Ultra')
})

/**
 * **THE FOCUS GOES BACK TO WHAT IT WAS ON, OR TO THE HEADING OF ITS WIDGET, NEVER TO ANOTHER LINK** (review,
 * 21.11.2026), in Chrome: „Ultra" chosen on 1280, the focus on „Ceo kalendar" or on a race only „Ultra" shows,
 * then 768, where the filter is back at „Sve". The place in the list used to be kept, and it was another race.
 */
test('the focus on „Ceo kalendar" stays on it when the filter goes back to „Sve"', async ({ open }) => {
  const { page } = await open({ width: 1280, text: 100 }, '/sr', '.top10 .stand', ANSWERS)

  await page.locator('.home__next').getByRole('button', { name: /^Ultra/ }).click()
  await page.locator('.home__next').getByRole('link', { name: 'Ceo kalendar' }).focus()
  await page.setViewportSize({ width: 768, height: 900 })
  await page.locator('.home__colL').waitFor({ state: 'detached' })

  const seen = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? '',
    text: (document.activeElement?.textContent ?? '').trim(),
  }))

  /* The link carries its word twice (the one drawn and the one that is read, or the icon and the one that is read), so its text is not the word alone. */
  expect(seen.tag).toBe('A')
  expect(seen.text).toContain('Ceo kalendar')
})

test('the focus on a race only „Ultra" shows goes to the heading of the calendar, and to no other race', async ({
  open,
  theDay,
}) => {
  /* The calendar of the sample is read as of the day, and on the other one every race under „Ultra" is also among
     the nine of „Sve", so there is no race that only „Ultra" shows. */
  test.skip(theDay !== THE_DAY_THE_SUITE_IS_READ_AS, 'no race is only under Ultra on this day')

  const { page } = await open({ width: 1280, text: 100 }, '/sr', '.top10 .stand', ANSWERS)
  const names = () => page.locator('.home__next .extract__name a').allTextContents()

  const underAll = await names()

  await page.locator('.home__next').getByRole('button', { name: /^Ultra/ }).click()

  const only = (await names()).find((one) => !underAll.includes(one))

  expect(only, 'every race under „Ultra" is under „Sve" as well').toBeDefined()

  await page.locator('.home__next .extract__name a', { hasText: only ?? '' }).first().focus()
  await page.setViewportSize({ width: 768, height: 900 })
  await page.locator('.home__colL').waitFor({ state: 'detached' })

  expect(await names()).not.toContain(only)

  const seen = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? '',
    text: (document.activeElement?.textContent ?? '').trim(),
  }))

  expect(seen).toEqual({ tag: 'H2', text: 'Priprema, pozor, SAD!' })
})

/**
 * THE LIST FROM THE FOURTH PLACE AT EVERY WIDTH, EVERY TEXT SIZE AND IN BOTH LANGUAGES (owner, 21.11.2026: the
 * category under the name on every width): nothing in a row overlaps anything else, the points do not leave
 * their column, and the page does not move sideways. A name that does not fit ends in three dots, so it is
 * measured by the box it is drawn in, and the figure by the text a person sees.
 */
for (const width of [360, 560, 768, 860, 1024, 1280]) {
  for (const text of ALL_TEXTS) {
    for (const language of ['sr', 'en']) {
      const here: At = { width, text }

      test(`the list of the board has nothing on anything, at ${label(here)}, in ${language}`, async ({ open, theDay }) => {
        test.skip(theDay !== THE_DAY_THE_SUITE_IS_READ_AS, 'no row stands in the list on this day')

        const { page } = await open(here, `/${language}`, '.top10 .stand', ANSWERS)

        const rows = await page.evaluate(() =>
          [...document.querySelectorAll('.toprow:not(.toprow--empty)')].map((row) => {
            const rect = (element: Element) => {
              const { left, right, top, bottom } = element.getBoundingClientRect()

              return { left, right, top, bottom }
            }
            const figure = must(row.querySelector('.pt'))
            const range = document.createRange()

            range.selectNodeContents(figure)

            const text = [...range.getClientRects()].filter((one) => one.width > 0)

            function must<T>(value: T | null): T {
              if (value === null) {
                throw new Error('something the list draws is not there')
              }

              return value
            }

            const nameBox = must(row.querySelector('.nm'))

            return {
              text: figure.textContent ?? '',
              nameCut: nameBox.scrollWidth - nameBox.clientWidth,
              row: rect(row),
              parts: {
                no: rect(must(row.querySelector('.no'))),
                circle: rect(must(row.querySelector('.portrait'))),
                name: rect(must(row.querySelector('.nm'))),
                category: rect(must(row.querySelector('.kt'))),
                figure: text.length === 0 ? rect(figure) : { left: Math.min(...text.map((one) => one.left)), right: Math.max(...text.map((one) => one.right)), top: Math.min(...text.map((one) => one.top)), bottom: Math.max(...text.map((one) => one.bottom)) },
              },
              figureOver: Math.max(0, ...text.map((one) => one.right - figure.getBoundingClientRect().right), ...text.map((one) => figure.getBoundingClientRect().left - one.left)),
            }
          }),
        )

        expect(rows.length, 'the list has no rows to measure').toBeGreaterThan(0)
        /* The list's own contribution to a sideways scroll, and not the page's: at 360px and 175% the decorative
           background of the route (`.race-page`, PR 760 and 767) is wider than the window, which is not this list
           and is reported apart. */
        const spill = await page.evaluate(() =>
          [...document.querySelectorAll('.toprows')].map((list) => ({
            scrolls: list.scrollWidth - list.clientWidth,
            beyond: list.getBoundingClientRect().right - document.documentElement.clientWidth,
          })),
        )

        for (const one of spill) {
          expect(one.scrolls, 'a list scrolls sideways inside itself').toBeLessThanOrEqual(SAME)
          expect(one.beyond, 'a list is wider than the window').toBeLessThanOrEqual(SAME)
        }


        type Rect = { left: number; right: number; top: number; bottom: number }

        const meets = (a: Rect, b: Rect) =>
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > SAME && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > SAME

        for (const row of rows) {
          const { no, circle, name, category, figure } = row.parts
          const pairs: [string, Rect, Rect][] = [
            ['the name and the category', name, category],
            ['the name and the points', name, figure],
            ['the category and the points', category, figure],
            ['the circle and the name', circle, name],
            ['the circle and the category', circle, category],
            ['the number and the circle', no, circle],
          ]

          for (const [what, one, other] of pairs) {
            expect(meets(one, other), `${what} are on each other: ${row.text}`).toBe(false)
          }

          expect(row.nameCut, `a name of the list is cut: ${row.text}`).toBeLessThanOrEqual(SAME)
          expect(figure.left, `the points leave the row on the left: ${row.text}`).toBeGreaterThanOrEqual(row.row.left - SAME)
          expect(figure.right, `the points leave the row on the right: ${row.text}`).toBeLessThanOrEqual(row.row.right + SAME)
          expect(row.figureOver, `the points stick out of their own column: ${row.text}`).toBeLessThanOrEqual(SAME)
        }
      })
    }
  }
}

/**
 * THE FIGURE ON THE PODIUM IS THE SHAPE OF THE FIGURE IN THE LIST (owner, 21.11.2026: "Nema mi smisla da za
 * najbolja 3 bude manji font poena nego za 4-10 mesto u tabeli ispod gde su veliki beli brojevi"): the same
 * weight and the same colour always, and the same size wherever the figure fits its column without being set
 * smaller. The letter goes down only as the way out of a narrow column, and then never under the floor of the
 * names (0,65rem). Measured as the browser computes it, since the two rules read three shared properties and
 * a rule that stopped reading one of them would not be seen in the stylesheet by a case that reads the text.
 */
for (const width of [768, 1280]) {
  test(`the figure of the podium has the shape of the figure of the list, at ${label({ width, text: 100 })}`, async ({ open, theDay }) => {
    test.skip(theDay !== THE_DAY_THE_SUITE_IS_READ_AS, 'no figure stands on the podium on this day')

    const { page } = await open({ width, text: 100 }, '/sr', '.top10 .stand', ANSWERS)

    const seen = await page.evaluate(() => {
      const shape = (element: Element) => {
        const style = getComputedStyle(element)

        return { size: Number.parseFloat(style.fontSize), weight: style.fontWeight, color: style.color }
      }

      return {
        podium: [...document.querySelectorAll('.stand__points')].map(shape),
        list: [...document.querySelectorAll('.toprows .pt')].slice(0, 1).map(shape),
        root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      }
    })

    const list = seen.list[0]

    expect(list, 'the list has no figure to measure').toBeDefined()
    expect(seen.podium.length).toBeGreaterThan(0)

    for (const place of seen.podium) {
      expect(place.weight, 'the podium figure is not as heavy as the list one').toBe(list?.weight)
      expect(place.color, 'the podium figure is not the colour of the list one').toBe(list?.color)
      expect(place.size, 'the podium figure is larger than the list one').toBeLessThanOrEqual((list?.size ?? 0) + 0.05)
      expect(place.size, 'the podium figure is under the floor').toBeGreaterThanOrEqual(0.65 * seen.root - 0.05)
    }

    // At least one figure of the podium fits its column and is the very size of the list's.
    expect(
      seen.podium.some((place) => Math.abs(place.size - (list?.size ?? 0)) <= 0.05),
      'no figure of the podium is the size of the list one: it is set smaller everywhere',
    ).toBe(true)
  })
}

/**
 * THE RING OF FOCUS OF A NAME IN THE LIST IS DRAWN WHOLE (WCAG 2.4.7, review of PR 768): a link is focused from the
 * keyboard, and its ring (`index.css`, the outline and its offset) grown round the link must lie inside the box of
 * every ancestor that clips what is drawn outside it. A name in a box that hides its overflow had a ring cut to a
 * thin line, and at 860px no ring at all.
 */
for (const width of [360, 560, 768, 860, 1024, 1280]) {
  for (const text of BOTH_TEXTS) {
    test(`the ring of focus of the names of the list is not clipped, at ${label({ width, text })}`, async ({ open, theDay }) => {
      test.skip(theDay !== THE_DAY_THE_SUITE_IS_READ_AS, 'no row stands in the list on this day')

      const { page } = await open({ width, text }, '/sr', '.top10 .stand', ANSWERS)

      await page.keyboard.press('Tab')

      const seen = await page.evaluate(() => {
        const links = [...document.querySelectorAll('.toprows .nm a')]

        return links.map((link) => {
          if (link instanceof HTMLElement) {
            link.focus()
          }

          const style = getComputedStyle(link)
          const grow = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset)
          const box = link.getBoundingClientRect()
          const ring = { left: box.left - grow, right: box.right + grow, top: box.top - grow, bottom: box.bottom + grow }
          let cut = 0

          for (let up = link.parentElement; up !== null && up !== document.documentElement; up = up.parentElement) {
            const own = getComputedStyle(up)

            if (own.overflowX !== 'visible' || own.overflowY !== 'visible') {
              const clip = up.getBoundingClientRect()

              cut = Math.max(cut, clip.left - ring.left, ring.right - clip.right, clip.top - ring.top, ring.bottom - clip.bottom)
            }
          }

          return { name: link.textContent ?? '', cut, ringWidth: Number.parseFloat(style.outlineWidth), focused: document.activeElement === link }
        })
      })

      expect(seen.length, 'the list has no name to focus').toBeGreaterThan(0)

      for (const one of seen) {
        expect(one.focused, `${one.name} cannot be focused`).toBe(true)
        expect(one.ringWidth, `${one.name} has no ring of focus`).toBeGreaterThan(0)
        expect(one.cut, `the ring of focus of ${one.name} is clipped`).toBeLessThanOrEqual(SAME)
      }
    })
  }
}

/**
 * WHERE THE NAME FITS, THE ROW IS THE 44px IT ALWAYS WAS (owner, 21.11.2026: a name is never cut, and where it does not
 * fit it wraps and the row grows): with the names of the portal, at the three widths where they stand in one line at the
 * browser's own text size, a row of the list is the 2.75rem and a pixel of border, and the two boards are one height.
 */
for (const width of [768, 1024, 1280]) {
  test(`a row of the list is one row high where the name fits, at ${label({ width, text: 100 })}`, async ({ open, theDay }) => {
    test.skip(theDay !== THE_DAY_THE_SUITE_IS_READ_AS, 'no row stands in the list on this day')

    const { page } = await open({ width, text: 100 }, '/sr', '.top10 .stand', everyAnswer())

    const seen = await page.evaluate(() => ({
      rows: [...document.querySelectorAll('.toprow:not(.toprow--empty)')].map((row) => Math.round(row.getBoundingClientRect().height * 10) / 10),
      boards: [...document.querySelectorAll('.top10')].map((board) => Math.round(board.getBoundingClientRect().height * 10) / 10),
    }))

    expect(seen.rows.length).toBeGreaterThan(0)

    for (const height of seen.rows) {
      expect(height, 'a row of the list is taller than it was').toBeLessThanOrEqual(45)
    }

    expect(Math.max(...seen.boards) - Math.min(...seen.boards), 'the two boards are not one height').toBeLessThanOrEqual(SAME)
  })
}

/**
 * **THE WAY TO THE CALENDAR IS IN THE ROW OF THE TITLE, AND THE FILTER IS HALF WAY BETWEEN THE TITLE AND THE
 * FIRST RACE** (owner, 21.11.2026, PDL „Filter po dužini u „Priprema, pozor, SAD!"”), in Chrome at 360, 768, 1024
 * and 1280, in both languages, at 100, 125 and 200 per cent of text:
 *
 * - the link is inside the card and does not touch the title;
 * - it is on the right wherever it ends up, and at 100 per cent it is in the same row as the title (in a larger text
 *   it may go under it, which is the point of the row wrapping);
 * - what stands above the filter (from the row of the title) is what stands under it (to the first race), to a
 *   pixel;
 * - no sideways scroll.
 */
const CALENDAR_AT: At[] = [360, 768, 860, 900, 940, 960, 1024, 1280].flatMap((width) => TEXTS.map((text): At => ({ width, text })))

for (const language of ['sr', 'en'] as const) {
  for (const at of CALENDAR_AT) {
    test(`the link to the calendar is in the row of the title, and the filter is half way, in ${language} at ${label(at)}`, async ({ open }) => {
      const { page, probe } = await open(at, `/${language}`, '.top10 .stand', ANSWERS)

      const seen = await page.evaluate(() => {
        const box = (element: Element | Range) => {
          const { top, bottom, left, right } = element.getBoundingClientRect()

          return { top, bottom, left, right }
        }

        const must = <T,>(value: T | null): T => {
          if (value === null) {
            throw new Error('something the calendar draws is not there')
          }

          return value
        }

        const card = must(document.querySelector('.home__next .card'))
        const style = getComputedStyle(card)
        const outer = card.getBoundingClientRect()

        return {
          card: {
            left: outer.left + Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth),
            right: outer.right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth),
          },
          head: box(must(card.querySelector('.card__head'))),
          title: box(must(card.querySelector('.card__title'))),
          link: box(must(card.querySelector('.card__head-link'))),
          text: must(card.querySelector('.card__head-link')).textContent,
          seg: box(must(card.querySelector('.seg'))),
          first: box(must(card.querySelector('.extract__row'))),
          /* The TEXT of the first race, not the frame of its row (owner, 21.11.2026, after the review of PR 770:
             „jednako do teksta prve trke, ne do okvira njenog reda"): the range of the words of its name. */
          firstText: (() => {
            const range = document.createRange()

            range.selectNodeContents(must(card.querySelector('.extract__row .extract__name a')))

            return box(range)
          })(),
          icon: getComputedStyle(must(card.querySelector('.card__head-icon'))).display !== 'none',
          word: getComputedStyle(must(card.querySelector('.card__head-word'))).display !== 'none',
          name: card.querySelector('.card__head-link')?.textContent ?? '',
          rows: card.querySelectorAll('.extract__row').length,
          list: box(must(card.querySelector('.extract'))),
          last: box([...card.querySelectorAll('.extract__row')].at(-1) ?? card),
        }
      })

      console.log(`CALENDAR ${language} ${label(at)} ${JSON.stringify({
        text: seen.text,
        sameRow: seen.link.top < seen.title.bottom && seen.link.bottom > seen.title.top,
        reserve: Math.round((seen.card.right - seen.link.right) * 10) / 10,
        above: Math.round((seen.seg.top - seen.head.bottom) * 10) / 10,
        below: Math.round((seen.firstText.top - seen.seg.bottom) * 10) / 10,
        icon: seen.icon,
        word: seen.word,
        size: [Math.round((seen.link.right - seen.link.left) * 10) / 10, Math.round((seen.link.bottom - seen.link.top) * 10) / 10],
        need: Math.round((seen.card.right - seen.card.left) * 10) / 10,
        rows: seen.rows,
        spare: Math.round((seen.list.bottom - seen.last.bottom) * 10) / 10,
      })}`)

      /* What a reader hears is the word, in both of the shapes (the icon is drawn and says nothing). */
      expect(seen.name).toContain(language === 'sr' ? 'Ceo kalendar' : 'Full calendar')
      expect(seen.icon, 'the word and the icon are both drawn, or neither').not.toBe(seen.word)

      /* The card decides, not the window and not the language: the word where it fits at the reader's own text
         (from 1024px, in Serbian too) and the icon under it, 860 to 960. */
      if (at.text === 100 && at.width >= 1024) {
        expect(seen.word, 'a wide card draws the icon and not the word').toBe(true)
      }

      if (at.text === 100 && at.width >= 860 && at.width < 1024) {
        expect(seen.icon, 'a narrow card draws the word and not the icon').toBe(true)
      }

      /* The icon is a target of 24 by 24 at least (WCAG 2.2 SC 2.5.8). */
      if (seen.icon) {
        expect(seen.link.right - seen.link.left, 'the icon is narrower than 24px').toBeGreaterThanOrEqual(24 - SAME)
        expect(seen.link.bottom - seen.link.top, 'the icon is lower than 24px').toBeGreaterThanOrEqual(24 - SAME)
      }

      expect(seen.link.left, 'the link is outside the card on the left').toBeGreaterThanOrEqual(seen.card.left - SAME)
      expect(seen.link.right, 'the link is outside the card on the right').toBeLessThanOrEqual(seen.card.right + SAME)
      expect(Math.abs(seen.link.right - seen.card.right), 'the link is not on the right').toBeLessThanOrEqual(1)

      const sameRow = seen.link.top < seen.title.bottom && seen.link.bottom > seen.title.top

      if (sameRow) {
        expect(seen.link.left, 'the link touches the title').toBeGreaterThanOrEqual(seen.title.right - SAME)
      } else {
        expect(seen.link.top, 'the link overlaps the title').toBeGreaterThanOrEqual(seen.title.bottom - SAME)
      }

      if (at.text === 100) {
        expect(sameRow, 'the link is not in the row of the title').toBe(true)
      }

      /* A pixel at the reader's own text, and as many pixels as the text is times larger at a larger one (the scale
         is in rem, so the rooms grow with the text), and half a pixel more: the steps of the scale are even and the
         text of a race stands 1px (this machine) or 2px (the Chrome of the pipeline) in from the frame of its row, so
         16 and 15, or 16 and 17, is as near as it comes. Frame of the row: 11px off; room as it was: 5px. */
      expect(
        Math.abs(seen.seg.top - seen.head.bottom - (seen.firstText.top - seen.seg.bottom)),
        'the room above the filter is not the room under it, to the text of the first race',
      ).toBeLessThanOrEqual(at.text / 100 + 0.5)
      /* At the reader's own text the page never moves sideways. At 200% on 360px the decorative background of the
         page (`.race-page`, measured: 18px) is wider than the window on one of the two days and is not this card's,
         so there the card is held to its own box above (the link inside it) and not the page to a scroll. */
      if (at.text === 100) {
        expect(probe.sideways).toBe(0)
      }
    })
  }
}
