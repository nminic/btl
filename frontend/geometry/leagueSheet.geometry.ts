import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, SLACK, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE HEAD OF THE SHEET OF A COMPETITION AND THE TILES OF ITS EVENTS, AS CHROME DRAWS THEM.
 *
 * Owner, 21.11.2026, two decisions of the same evening (PDL „Glava lista lige: na desktopu sve u
 * jednom redu” and „„Događaji i trke” na listu lige: pločice u dve kolone”):
 *
 * - „na desktopu sve u jednom redu (znak, ime, tri statistike, ikonica za izmenu, dugme) … na telefonu
 *   ostaje raspored kao danas, a ikonica za izmenu stoji u gornjem redu uz naziv lige”;
 * - „pločice u dve kolone na računaru (jedna na telefonu) … u prvom redu stanje levo … i datum desno, u
 *   drugom naziv levo i dužine desno; oba reda su vertikalno poravnata (stanje i datum u istoj liniji,
 *   naziv i dužine u istoj liniji)”, and a dot and its tile lit together.
 *
 * **Asked of Chrome, because a stylesheet read as text cannot answer any of it**: which row a box stands
 * in is the grid's answer, and whether two words of two sizes share a line is the font's.
 *
 * **How „one line" is measured.** The state and the day are of one size, so the boxes of their glyphs
 * are compared whole: the same top and the same bottom. The name and a length are of two sizes, so what
 * is compared is where each sits: an empty inline box put at the end of each stands on its baseline,
 * which is the line the owner means by „u istoj liniji".
 */

/** A day in the middle of the sample's season, so the tiles hold all three states. */
test.use({ theDay: '2027-03-01' })

function sample(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'))
}

const SUPERADMIN = { role: 'superadmin', account: 41, membershipBasis: null }

const SERVED: Answers = {
  '/api/leagues': sample('leagues'),
  '/api/events': sample('events'),
  '/api/races': sample('races'),
}

type Box = { left: number; right: number; top: number; bottom: number }

/** Whether two boxes share some of their height, which is what standing in one row is. */
const sameRow = (one: Box, other: Box): boolean => one.top < other.bottom - SLACK && other.top < one.bottom - SLACK

const overlap = (one: Box, other: Box): boolean =>
  one.left < other.right - SLACK && other.left < one.right - SLACK && sameRow(one, other)

/** What the head is read by, each part by its own class, or nothing where the part is not drawn. */
async function head(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const box = (one: Element | null) => {
      if (one === null) {
        return null
      }

      const found = one.getBoundingClientRect()

      return { left: found.left, right: found.right, top: found.top, bottom: found.bottom }
    }
    const score = document.querySelector('.leagues__score')

    return score === null
      ? null
      : {
          mark: box(score.querySelector('.leagues__mark')),
          name: box(score.querySelector('.leagues__score-name')),
          pills: box(score.querySelector('.leagues__pills')),
          edit: box(score.querySelector('.leagues__edit')),
          cta: box(score.querySelector('.leagues__cta')),
        }
  })
}

for (const { at, oneRow } of [
  { at: { width: 360, text: 100 }, oneRow: false },
  { at: { width: 768, text: 100 }, oneRow: false },
  { at: { width: 1280, text: 100 }, oneRow: true },
  /* At twice the text the head has no room for one row, and gives it back as two. */
  { at: { width: 1280, text: 200 }, oneRow: false },
] satisfies { at: At; oneRow: boolean }[]) {
  test(`the head of the sheet with the pencil stands ${oneRow ? 'in one row' : 'as it did, the pencil beside the name'}, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr/lige?sezona=2027', '.leagues__edit', { ...SERVED, '/api/me': SUPERADMIN })
    const seen = await head(page)

    if (seen === null || seen.mark === null || seen.name === null || seen.pills === null || seen.edit === null || seen.cta === null) {
      throw notMeasured('the sheet drew no head, or a head without one of its five parts')
    }

    const parts = [seen.mark, seen.name, seen.pills, seen.edit, seen.cta]

    for (const [index, one] of parts.entries()) {
      for (const [later, two] of parts.entries()) {
        if (later > index) {
          expect(overlap(one, two), `parts ${index + 1} and ${later + 1} of the head overlap`).toBe(false)
        }
      }
    }

    /* The pencil is in the row of the name whichever shape the head takes, and ends inside the sheet. */
    expect(sameRow(seen.edit, seen.name), 'the pencil stands in the row of the name').toBe(true)
    expect(seen.edit.left, 'the pencil stands after the name').toBeGreaterThanOrEqual(seen.name.right - SLACK)

    if (oneRow) {
      for (const [index, one] of parts.entries()) {
        expect(sameRow(one, seen.name), `part ${index + 1} stands in the row of the name`).toBe(true)
      }

      /* „znak, ime, tri statistike, ikonica za izmenu, dugme”, in that order. */
      expect(parts.map((one) => one.left)).toEqual([...parts.map((one) => one.left)].sort((left, right) => left - right))
    } else {
      expect(seen.pills.top, 'the pills stand under the name').toBeGreaterThanOrEqual(seen.name.bottom - SLACK)
      expect(seen.pills.top, 'the pills stand under the pencil').toBeGreaterThanOrEqual(seen.edit.bottom - SLACK)
    }

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)
  })
}

test(`the head without the pencil keeps one row and its order, ${label({ width: 1280, text: 100 })}`, async ({ open }) => {
  const { page, probe } = await open({ width: 1280, text: 100 }, '/sr/lige?sezona=2027', '.leagues__cta', SERVED)
  const seen = await head(page)

  if (seen === null || seen.mark === null || seen.name === null || seen.pills === null || seen.cta === null) {
    throw notMeasured('the sheet drew no head, or a head without one of its four parts')
  }

  expect(seen.edit, 'a visitor is drawn no pencil').toBeNull()

  const parts = [seen.mark, seen.name, seen.pills, seen.cta]

  for (const one of parts) {
    expect(sameRow(one, seen.name)).toBe(true)
  }

  expect(parts.map((one) => one.left)).toEqual([...parts.map((one) => one.left)].sort((left, right) => left - right))
  expect(probe.sideways).toBe(0)
})

for (const { at, columns } of [
  { at: { width: 360, text: 100 }, columns: 1 },
  { at: { width: 768, text: 100 }, columns: 2 },
  { at: { width: 1280, text: 100 }, columns: 2 },
  { at: { width: 1280, text: 200 }, columns: 1 },
] satisfies { at: At; columns: number }[]) {
  test(`the tiles of the events stand ${columns} to a row, each with its two rows on one line, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr/lige?sezona=2027', '.leagues__event-tile', SERVED)

    const seen = await page.evaluate(() => {
      const glyphs = (element: Element | null) => {
        const text = element === null ? null : [...element.childNodes].find((one) => one.nodeType === Node.TEXT_NODE && one.textContent?.trim() !== '')
        const inside = text ?? element?.firstChild ?? null

        if (inside === null) {
          return null
        }

        const range = document.createRange()

        range.selectNodeContents(inside)

        const found = range.getBoundingClientRect()

        return { top: found.top, bottom: found.bottom }
      }
      /* An empty inline box at the end of what an element says stands on the baseline of its line. */
      const baseline = (element: Element | null) => {
        if (element === null) {
          return null
        }

        const mark = document.createElement('span')

        mark.style.display = 'inline-block'
        mark.style.inlineSize = '0'
        mark.style.blockSize = '0'
        element.append(mark)

        const at = mark.getBoundingClientRect().top

        mark.remove()

        return at
      }

      return [...document.querySelectorAll('.leagues__event-tile')].map((tile) => {
        const found = tile.getBoundingClientRect()
        const length = tile.querySelector('.leagues__event-lengths li')

        return {
          box: { left: found.left, right: found.right, top: found.top, bottom: found.bottom },
          state: glyphs(tile.querySelector('.leagues__event-state')),
          day: glyphs(tile.querySelector('time')),
          name: baseline(tile.querySelector('.leagues__event-mid > a')),
          length: baseline(length),
          lengthBox: length === null ? null : length.getBoundingClientRect().top,
          nameTop: tile.querySelector('.leagues__event-mid > a')?.getBoundingClientRect().top ?? null,
        }
      })
    })

    expect(seen.length, 'the eight events of the sample, eight tiles').toBe(8)
    expect(new Set(seen.map((one) => Math.round(one.box.left))).size, 'how many tiles stand in one row').toBe(columns)

    for (const [index, tile] of seen.entries()) {
      if (tile.state === null || tile.day === null || tile.name === null || tile.length === null) {
        throw notMeasured(`tile ${index + 1} has no state, day, name or length to read`)
      }

      /* „stanje i datum u istoj liniji”. */
      expect(Math.abs(tile.state.top - tile.day.top), `tile ${index + 1}: the state and the day start on one line`).toBeLessThanOrEqual(SLACK)
      expect(Math.abs(tile.state.bottom - tile.day.bottom), `tile ${index + 1}: the state and the day end on one line`).toBeLessThanOrEqual(SLACK)

      /* „naziv i dužine u istoj liniji”, where they stand beside each other: a length that has gone
         under a long name (360, four lengths) is on a line of its own, which the draft drew as well. */
      if (tile.lengthBox !== null && tile.nameTop !== null && tile.lengthBox < tile.nameTop + 8) {
        expect(Math.abs(tile.name - tile.length), `tile ${index + 1}: the name and the lengths stand on one baseline`).toBeLessThanOrEqual(SLACK)
      }

      for (const [other, then] of seen.entries()) {
        if (other > index) {
          expect(overlap(tile.box, then.box), `tile ${index + 1} overlaps tile ${other + 1}`).toBe(false)
        }
      }
    }

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)
  })
}

/* THE TEXT OF THE TILE OF THE NEXT EVENT STARTS WHERE THE TEXT OF EVERY OTHER TILE STARTS, AND ITS GOLD EDGE
 * IS STILL THERE (owner's PENDING, 22.11.2026, from the report of the author of PR 791: „zlatna leva ivica
 * od 4px pomera tekst 3px udesno u odnosu na ostale pločice").
 *
 * The gold edge is a border of 4px against the 1px of every other tile, so the same padding put the text of
 * that tile 3px further in. Measured 22.11.2026 before the change, in this file's sample: the state and the
 * name of the next tile 3px to the right of those of the tiles above and below it, at 360, 768 and 1280.
 *
 * **Compared with the tiles of the same column**, tile by tile, and not with a number written here: the
 * left edge of the state and the left edge of the name of every tile are held to the first tile's own, which
 * is not the next one, and a tolerance of half a pixel (the subpixel position of a box in a grid). **The
 * edge is measured too**, 4px and gold, so the text is not brought into line by taking the edge away.
 */
for (const at of [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
] satisfies At[]) {
  test(`the text of the next event's tile starts where the other tiles' text does, and keeps its gold edge, ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr/lige?sezona=2027', '.leagues__event-tile', SERVED)

    const seen = await page.evaluate(() =>
      [...document.querySelectorAll('.leagues__event-tile')].map((tile) => {
        const left = (element: Element | null) => element?.getBoundingClientRect().left ?? Number.NaN
        const edge = getComputedStyle(tile)

        return {
          next: tile.classList.contains('leagues__event-tile--next'),
          column: Math.round(tile.getBoundingClientRect().left),
          state: left(tile.querySelector('.leagues__event-state')),
          name: left(tile.querySelector('.leagues__event-mid > a')),
          edge: edge.borderInlineStartWidth,
          edgeColour: edge.borderInlineStartColor,
        }
      }),
    )
    const next = seen.filter((one) => one.next)

    expect(seen.length, 'the eight events of the sample, eight tiles').toBe(8)
    expect(next.length, 'one tile is the next event').toBe(1)

    const [theNext] = next
    const others = seen.filter((one) => !one.next && one.column === theNext?.column)

    expect(others.length, 'tiles of the next one\'s column to hold it against').toBeGreaterThan(0)

    for (const other of others) {
      expect(Math.abs((theNext?.state ?? Number.NaN) - other.state), 'the state starts on one line').toBeLessThanOrEqual(0.5)
      expect(Math.abs((theNext?.name ?? Number.NaN) - other.name), 'the name starts on one line').toBeLessThanOrEqual(0.5)
    }

    expect(theNext?.edge, 'the gold edge of the next tile is still 4px').toBe('4px')
    expect(theNext?.edgeColour, 'and it is gold, not the colour of the others').not.toBe(others[0]?.edgeColour)
    expect(others.every((one) => one.edge === '1px'), 'the other tiles keep their 1px edge').toBe(true)
  })
}

test(`a dot and the tile of its event light together, in both directions, ${label({ width: 1280, text: 100 })}`, async ({ open }) => {
  const { page } = await open({ width: 1280, text: 100 }, '/sr/lige?sezona=2027', '.leagues__event-tile', SERVED)

  /* The look of a tile and of the dot under it, read as the browser computes them: the class is the
     join between the screen and the sheet, and a light that is a class with no rule is no light. */
  const looks = () =>
    page.evaluate(() => ({
      tiles: [...document.querySelectorAll('.leagues__event-tile')].map((one) => {
        const style = getComputedStyle(one)

        return `${style.borderTopColor} ${style.boxShadow}`
      }),
      dots: [...document.querySelectorAll('.leagues__year:not(.leagues__year--mini) .leagues__dot')].map(
        (one) => getComputedStyle(one, '::before').transform,
      ),
    }))

  const before = await looks()

  expect(before.tiles).toHaveLength(8)
  expect(before.dots).toHaveLength(8)

  await page.locator('.leagues__year:not(.leagues__year--mini) .leagues__dot').nth(4).hover()

  const overDot = await looks()

  expect(overDot.tiles.map((one, index) => one !== before.tiles[index]), 'the tile of the fifth dot and no other').toEqual([false, false, false, false, true, false, false, false])
  expect(overDot.dots.map((one, index) => one !== before.dots[index]), 'the fifth dot and no other').toEqual([false, false, false, false, true, false, false, false])

  await page.mouse.move(1, 1)
  await page.locator('.leagues__event-tile').nth(6).hover()

  const overTile = await looks()

  expect(overTile.dots.map((one, index) => one !== before.dots[index]), 'the dot of the seventh tile and no other').toEqual([false, false, false, false, false, false, true, false])
  expect(overTile.tiles.map((one, index) => one !== before.tiles[index])).toEqual([false, false, false, false, false, false, true, false])
})
