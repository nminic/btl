import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
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
const ANSWERS: Answers = {
  ...everyAnswer(),
  '/api/competitors': (Array.isArray(MEMBERS) ? MEMBERS : []).map((one: Record<string, unknown>, index: number) => ({
    ...one,
    firstName: LONG_FIRST[index % LONG_FIRST.length],
    lastName: LONG_LAST[index % LONG_LAST.length],
  })),
}

/** Half a pixel: a box of a fraction of a pixel is the same box. */
const SAME = 0.5

const WIDTHS: At[] = [360, 560, 768, 860, 1024, 1280].map((width): At => ({ width, text: 100 }))

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
          who: (item.querySelector('.stand__name')?.textContent ?? '') + ' | ' + (item.querySelector('.stand__points')?.textContent ?? ''),
          nameLines: [...item.querySelectorAll('.stand__first, .stand__last')].map((one) => Math.round(one.getBoundingClientRect().height)),
          lines: [...item.querySelectorAll('.stand__first, .stand__last')].map((one) => lines(one)),
          fonts: [...item.querySelectorAll('.stand__first, .stand__last')].map((one) => Number.parseFloat(getComputedStyle(one).fontSize)),
          wider: [...item.querySelectorAll('.stand__first, .stand__last')].map(
            (one) => Math.round((one.scrollWidth - item.getBoundingClientRect().width) * 10) / 10,
          ),
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

      for (const row of board.rows) {
        expect(row.cut, 'a name of the list is wider than its cell').toBe(false)
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
