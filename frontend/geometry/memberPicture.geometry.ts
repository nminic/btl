import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/*
 * EVERY CIRCLE SHOWS THE SQUARE THE MEMBER CHOSE, AND THE SAME ONE.
 *
 * Owner, 23.11.2026, of member 000039 on production: „Zašto se drugačije seče i prikazuje u malom i
 * velikom krugu?????" and „Veliki krug je rezprezentativan, tako treba da bude svuda." The card drew
 * the small picture the server had cut; the profile drew the original and cut it in the browser,
 * inside a box that was not square, so it showed a wider frame, lower down. Every unit test was
 * green, because jsdom lays nothing out and the arithmetic of the cut is right for a square box.
 *
 * So this asks the pixels. Each picture is a grid of cells of one colour each, every cell its own
 * colour, and the square a record chooses is worked out here the way the SERVER cuts it
 * (`SmallPicture.java`: the side is `size` of the shorter edge, and `x` and `y` are shares of the
 * room left over on each axis). A circle shows the right square when the cells at five points
 * inside it are the cells that square holds there, and the wrong one shows other cells.
 *
 * WHICH CIRCLES: every picture of the two members on the screen, found in the DOM by its address and
 * not by a class or a component, so a screen that draws the picture some other way is measured with
 * the rest. Both ways of drawing are on these screens: the profile asks for the original (owner,
 * 23.10.2026, „original ostaje za profil"), and the cards draw the small one, or the original when
 * the small one does not load (the second member, whose small address answers no picture).
 *
 * WHICH PICTURES, and the axes are counted rather than guessed: one taller than it is wide, which is
 * the shape that broke, and one wider than it is high, so the other axis is read too. Neither square
 * is in the middle on either axis, so a circle that ignored the crop and drew the middle of the
 * picture would show other cells, and the profile circle that broke showed other cells too.
 */

test.use({ theDay: '2027-03-01' })

const MOCK = new URL('../src/test/mock/', import.meta.url)
const file = (name: string): unknown => JSON.parse(readFileSync(new URL(name, MOCK), 'utf-8'))

const CELL = 40

type Picture = { columns: number; rows: number; crop: { x: number; y: number; size: number } }

/* Taller than wide: the square is a little left of the middle and well under it. */
const TALL: Picture = { columns: 10, rows: 16, crop: { x: 0.25, y: 0.7, size: 0.6 } }
/* Wider than high: right of the middle and above it. */
const WIDE: Picture = { columns: 16, rows: 10, crop: { x: 0.7, y: 0.25, size: 0.6 } }

/* Every cell its own colour, fifteen steps apart on red by the column and on green by the row. */
const colourOf = (column: number, row: number) => ({ r: 15 + 15 * column, g: 15 + 15 * row, b: 128 })

/* The square, as the server cuts it out of the picture (`SmallPicture.java`), in pixels. */
function square(picture: Picture): { left: number; top: number; side: number } {
  const width = picture.columns * CELL
  const height = picture.rows * CELL
  const side = picture.crop.size * Math.min(width, height)

  return { left: picture.crop.x * (width - side), top: picture.crop.y * (height - side), side }
}

function svg(picture: Picture, viewBox: string, width: number, height: number): string {
  const cells: string[] = []

  for (let column = 0; column < picture.columns; column += 1) {
    for (let row = 0; row < picture.rows; row += 1) {
      const { r, g, b } = colourOf(column, row)
      cells.push(`<rect x="${column * CELL}" y="${row * CELL}" width="${CELL}" height="${CELL}" fill="rgb(${r},${g},${b})"/>`)
    }
  }

  const drawn = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" shape-rendering="crispEdges">${cells.join('')}</svg>`

  return `data:image/svg+xml,${encodeURIComponent(drawn)}`
}

const originalOf = (picture: Picture) =>
  svg(picture, `0 0 ${picture.columns * CELL} ${picture.rows * CELL}`, picture.columns * CELL, picture.rows * CELL)

/* The small picture the server would send: the square alone, already cut, as a square. */
function smallOf(picture: Picture): string {
  const { left, top, side } = square(picture)

  return svg(picture, `${left} ${top} ${side} ${side}`, 240, 240)
}

/* Five points inside the circle, as shares of its box: the four quarters and one off the middle. Each
   falls on the middle of a cell for both pictures, so a circle a pixel off still reads the cell. */
const POINTS = [
  { across: 0.25, down: 0.25 },
  { across: 0.75, down: 0.25 },
  { across: 0.25, down: 0.75 },
  { across: 0.75, down: 0.75 },
  { across: 2.5 / 6, down: 3.5 / 6 },
]

function expectedAt(picture: Picture, point: { across: number; down: number }) {
  const { left, top, side } = square(picture)

  return colourOf(Math.floor((left + point.across * side) / CELL), Math.floor((top + point.down * side) / CELL))
}

type Row = Record<string, unknown> & { memberNumber: string; active: boolean }

const isRow = (one: unknown): one is Row =>
  typeof one === 'object' &&
  one !== null &&
  typeof Reflect.get(one, 'memberNumber') === 'string' &&
  typeof Reflect.get(one, 'active') === 'boolean'

const LISTED = (() => {
  const all = file('competitors.json')

  return Array.isArray(all) ? all.filter(isRow) : []
})()

/* Two members who are on the list and show their profile, so both screens draw them. */
const [FIRST, SECOND] = LISTED.filter((one) => one.active && one.profileHidden !== true)

const MEMBERS = [
  { row: FIRST, picture: TALL, original: originalOf(TALL), small: smallOf(TALL) },
  /* The small address answers the portal itself and not a picture, so the card falls back to the
     original and cuts it, which is the second way of drawing on the same screen. */
  { row: SECOND, picture: WIDE, original: originalOf(WIDE), small: '/no-small-picture-here.svg' },
]

const ANSWERS: Answers = {
  '/api/competitors': LISTED.map((one) => {
    const drawn = MEMBERS.find((member) => member.row?.memberNumber === one.memberNumber)

    return drawn === undefined
      ? { ...one, photo: null, smallPhoto: null, crop: null }
      : { ...one, photo: drawn.original, smallPhoto: drawn.small, crop: drawn.picture.crop }
  }),
  '/api/teams': file('teams.json'),
  '/api/pairs': [],
  '/api/results': file('results.json'),
  '/api/unscored-results': file('unscored-results.json'),
  '/api/frozen-seasons': [],
}

type Read = { colour: { r: number; g: number; b: number }; at: { across: number; down: number } }[]

/* Every picture of these two members on the screen, by its address, with the five colours its circle
   shows. Brought into view one by one and waited for, because the circles in a list load lazily. */
async function circlesOf(page: Page): Promise<{ member: number; how: string; read: Read }[]> {
  const found: { member: number; how: string; read: Read }[] = []

  for (const [index, member] of MEMBERS.entries()) {
    const addresses = [member.original, member.small]
    const pictures = page.locator('img').filter({ visible: true })
    const count = await pictures.count()

    for (let one = 0; one < count; one += 1) {
      const picture = pictures.nth(one)
      const src = await picture.getAttribute('src')

      if (src === null || !addresses.includes(src)) {
        continue
      }

      await picture.scrollIntoViewIfNeeded()
      /* Loaded, and loaded as a picture: the small address that answers no picture is replaced by
         the original, and a circle read before that is a circle of nothing. */
      await expect
        .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 10_000 })
        .toBe(true)
      const how = (await picture.getAttribute('src')) === member.small ? 'the small picture' : 'the original'
      const circle = picture.locator('xpath=..')
      const box = await circle.evaluate((element) => ({
        left: element.clientLeft,
        top: element.clientTop,
        width: element.clientWidth,
        height: element.clientHeight,
      }))
      const shot = (await circle.screenshot({ animations: 'disabled' })).toString('base64')
      const read = await page.evaluate(
        async ({ shot, box, points }) => {
          const blob = await (await fetch(`data:image/png;base64,${shot}`)).blob()
          const bitmap = await createImageBitmap(blob)
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          const pen = canvas.getContext('2d')

          if (pen === null) {
            return []
          }

          pen.drawImage(bitmap, 0, 0)

          return points.map((at) => {
            const [r = 0, g = 0, b = 0] = pen.getImageData(
              Math.floor(box.left + at.across * box.width),
              Math.floor(box.top + at.down * box.height),
              1,
              1,
            ).data

            return { colour: { r, g, b }, at }
          })
        },
        { shot, box, points: POINTS },
      )

      if (read.length !== POINTS.length || box.width < 16) {
        throw notMeasured(`a circle of member ${member.row?.memberNumber ?? '?'} was ${box.width}px and gave ${read.length} colours`)
      }

      found.push({ member: index, how, read })
    }
  }

  return found
}

function showsTheSquare(circle: { member: number; how: string; read: Read }, where: string): void {
  const member = MEMBERS[circle.member]

  if (member === undefined) {
    throw notMeasured('a circle of a member the case does not draw')
  }

  for (const { colour, at } of circle.read) {
    const wanted = expectedAt(member.picture, at)
    const off = Math.max(Math.abs(colour.r - wanted.r), Math.abs(colour.g - wanted.g), Math.abs(colour.b - wanted.b))

    expect(
      off,
      `${where}: the circle of member ${member.row?.memberNumber ?? '?'}, drawn from ${circle.how}, shows ` +
        `rgb(${colour.r},${colour.g},${colour.b}) at ${at.across.toFixed(2)}, ${at.down.toFixed(2)} where the square ` +
        `the record chose holds rgb(${wanted.r},${wanted.g},${wanted.b})`,
    ).toBeLessThanOrEqual(6)
  }
}

const WIDTHS = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
] satisfies At[]

for (const at of WIDTHS) {
  test(`the profile cuts the original to the square the record chose, a tall and a wide picture alike, ${label(at)}`, async ({ open }) => {
    if (FIRST === undefined || SECOND === undefined) {
      throw notMeasured('the generated list has fewer than two members who show their profile')
    }

    for (const [index, member] of MEMBERS.entries()) {
      const { page, probe } = await open(at, `/sr/takmicar/${member.row?.memberNumber ?? ''}`, '.profile__head .crop-fitted img', ANSWERS)
      const circles = await circlesOf(page)
      const head = circles.filter((one) => one.member === index)

      if (head.length === 0 || !head.some((one) => one.how === 'the original')) {
        throw notMeasured(`the profile of member ${member.row?.memberNumber ?? '?'} drew no circle from the original`)
      }

      for (const circle of circles) {
        showsTheSquare(circle, `the profile of ${member.row?.memberNumber ?? '?'}`)
      }

      expect(probe.sideways).toBe(0)
    }
  })

  test(`the cards show the same square, from the small picture and from the original it falls back to, ${label(at)}`, async ({ open }) => {
    if (FIRST === undefined || SECOND === undefined) {
      throw notMeasured('the generated list has fewer than two members who show their profile')
    }

    const { page, probe } = await open(at, '/sr/takmicari', '.cards .card .portrait', ANSWERS)
    const circles = await circlesOf(page)

    /* Both ways of drawing, or this is not the comparison it says it is. */
    if (!circles.some((one) => one.how === 'the small picture') || !circles.some((one) => one.how === 'the original')) {
      throw notMeasured(`the cards drew ${circles.map((one) => one.how).join(', ') || 'no picture'}, not both ways`)
    }

    for (const circle of circles) {
      showsTheSquare(circle, 'the cards')
    }

    expect(probe.sideways).toBe(0)
  })
}
