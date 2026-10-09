import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { BtlEvent, Race, RaceCategory } from '../src/data/types.ts'
import { SLACK, label, notMeasured, settle, test } from './support/harness.ts'
import type { At } from './support/harness.ts'

/**
 * WHERE A BAR ACROSS SEVERAL DAYS OF THE MONTH STANDS, ASKED OF CHROME (PDL P35, ADL A63).
 *
 * Round 5 of PR 345 left three things written down as boundaries rather than guards, because
 * jsdom lays nothing out and the package had no browser: `pages/calendarStyle.test.ts` holds what
 * the stylesheet SAYS about each of them, and these three ask where it then LANDS.
 *
 * 1. **The name of a bar stops at the end of its own bar, and a press inside the next tile opens
 *    THAT tile's event** (owner, 22.09.2026: „Ime pocinje na levom kraju trake i sme da tece preko
 *    narednih dana, ali se zaustavlja tamo gde pocinju tacke, sa trotackom ako je predugo"; ADL
 *    A63's own example: „klik 20px unutar pločice susednog događaja vodi na njen događaj").
 *    Measured on 22.09.2026 before the bound: a name of 120 characters ended 282,67px past its
 *    bar, and a press 20px inside an unrelated tile opened the wrong event. With one day too many
 *    in the arithmetic the name still went 8,94px into that tile and took presses at 2 and 5px
 *    (`btl-produkt/PENDING.md`, round 5), which is why all three points are pressed.
 * 2. **No day of the month is out of reach**, at either size of text (ADL A26, 22.09.2026: the
 *    cut a month was given to hold a long name took whole Sundays off the screen with the page
 *    scroll at nought).
 * 3. **The dots stand at the far right end of the run** (owner, 22.09.2026: „tacke skroz na desnom
 *    kraju iste"), whatever sheet a rule about them is written in; the vitest guard reads the
 *    calendar's own sheet only, and says so.
 *
 * **The month is written here and not taken from the served file**, so every record a claim is
 * about is one this file names: a bar of two days with the longest name the form allows
 * (`forms/definitions/admin-dogadjaj.form.json`), an unrelated event two days after it in the same
 * row, a bar of three days whose name fits it, a bar that crosses a week (the Sunday closes one run
 * and the Monday opens the next) and a bar of four days. Every event is entered under the 1st,
 * a day none of its races is run on, as `pages/calendarScale.test.tsx` does: the range is derived
 * from the races, and an event entered on its first race would let either source draw it.
 *
 * **Widths on either side of the one the month becomes a grid at** (`(min-width: 48.75em)`,
 * `pages/Calendar.css`): 779 and 780 at the browser's own text, 1559 and 1560 at 200%, because a
 * query in `em` moves with the reader's letters (ADL A34) and a reader at 200% sees one column of
 * days up to 1559px. Asserted rather than assumed: every case says first which of the two
 * arrangements it is reading.
 *
 * **Relations, never pixels.** The portal names no font of its own, so Windows draws it in Segoe
 * UI and the runner in whatever its fonts stand in with; a number measured here would be a claim
 * about this machine. Every assertion compares two boxes the same page drew.
 */

const MONTH = '2026-10'
const CALENDAR = `/sr/kalendar?mesec=${MONTH}`

/** The longest name the form for an event lets anybody type, read off the form itself. */
function longestNameTheFormTakes(): number {
  const form: unknown = JSON.parse(
    readFileSync(fileURLToPath(new URL('../src/forms/definitions/admin-dogadjaj.form.json', import.meta.url)), 'utf-8'),
  )
  const fields: unknown[] =
    typeof form === 'object' && form !== null && 'fields' in form && Array.isArray(form.fields) ? form.fields : []

  for (const field of fields) {
    if (
      typeof field === 'object' &&
      field !== null &&
      'name' in field &&
      field.name === 'name' &&
      'maxLength' in field &&
      typeof field.maxLength === 'number'
    ) {
      return field.maxLength
    }
  }

  throw notMeasured('the form for an event no longer says how long a name may be')
}

const LONGEST = longestNameTheFormTakes()

const anEvent = (id: number, slug: string, name: string): BtlEvent => ({
  id,
  slug,
  name,
  date: `${MONTH}-01`,
  city: 'Novi Sad',
  country: 'RS',
  kind: 'race',
  featured: false,
  description: '',
  link: '',
  copiedFrom: null,
})

const aRace = (id: number, eventId: number, day: number, category: RaceCategory = 'short'): Race => ({
  id,
  eventId,
  name: 'Trka',
  renamed: false,
  kind: 'length',
  limitSeconds: 0,
  date: `${MONTH}-${String(day).padStart(2, '0')}`,
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  category,
})

/* 1 October 2026 is a Thursday, so the rows run Monday 5 to Sunday 11, 12 to 18, 19 to 25. */
const LONG = anEvent(
  1,
  'dugo-ime',
  'Medjunarodni ultramaraton Fruskom gorom od Petrovaradina preko Strazilova i Crvenog cota do Dunava i nazad, '
    .repeat(3)
    .slice(0, LONGEST),
)
const NEXT = anEvent(2, 'komsija', 'Komsijska trka')
const FITS = anEvent(3, 'staje', 'Jesenji kros 2026')
const ACROSS = anEvent(4, 'preko-vikenda', 'Vikend trka')
const FOUR = anEvent(5, 'cetiri-dana', 'Cetvorodnevna')

const ANSWERS = {
  '/api/events': [LONG, NEXT, FITS, ACROSS, FOUR],
  '/api/races': [
    /* Monday and Tuesday: a bar of two days, ending on the 6th. */
    aRace(11, 1, 5),
    aRace(12, 1, 6, 'half'),
    /* Thursday: two days after the bar ends, in the same row. */
    aRace(21, 2, 8),
    /* Monday to Wednesday of the next row: a bar its name fits in. */
    aRace(31, 3, 12),
    aRace(32, 3, 13),
    aRace(33, 3, 14),
    /* Saturday to Tuesday: the Sunday closes a run and the Monday opens the next. */
    aRace(41, 4, 17),
    aRace(42, 4, 18),
    aRace(43, 4, 19),
    aRace(44, 4, 20),
    /* Wednesday to Saturday: four days in one row, three lengths. */
    aRace(51, 5, 21),
    aRace(52, 5, 22, 'half'),
    aRace(53, 5, 23, 'marathon'),
    aRace(54, 5, 24),
  ],
}

/** Where a tile of this event leads. */
const addressOf = (event: BtlEvent) => `/sr/kalendar/${event.slug}`

const NEXT_ADDRESS = addressOf(NEXT)

/** Only the calendar with these records draws this, so it is what every visit waits for. */
const READY = `.calendar__grid a[href="${NEXT_ADDRESS}"]`

/** Where the month is a grid of seven columns, and the bars run across their days. */
const GRID: At[] = [
  { width: 780, text: 100 },
  { width: 1024, text: 100 },
  { width: 1440, text: 100 },
  { width: 1560, text: 200 },
  { width: 1920, text: 200 },
  { width: 1024, text: 100, theme: 'dark' },
]

/** Where the days stand in one column, and every piece of a bar is a tile of its own. */
const STACKED: At[] = [
  { width: 779, text: 100 },
  { width: 360, text: 100 },
  { width: 1559, text: 200 },
  { width: 1440, text: 200 },
]

/** How many columns the month is drawn in. */
const columns = () => {
  const grid = document.querySelector('.calendar__grid')

  return grid === null ? 0 : getComputedStyle(grid).gridTemplateColumns.split(' ').length
}

/** The boxes the first claim compares, read off the page in one go. */
const theBars = ({ long, fits, next }: { long: string; fits: string; next: string }) => {
  const box = (one: Element) => {
    const found = one.getBoundingClientRect()

    return { left: found.left, right: found.right, top: found.top, bottom: found.bottom }
  }
  /* The run a bar opens: its pieces in the order of the days, from the one that opens it to the
     first one that does not run on. */
  const run = (slug: string) => {
    const pieces = [...document.querySelectorAll(`.calendar__grid a.chip--scale[href$="/kalendar/${slug}"]`)]
    const opens = pieces.findIndex((one) => !one.classList.contains('chip--continues'))
    const ends = pieces.findIndex((one, at) => at >= opens && !one.classList.contains('chip--runs-on'))

    return opens < 0 || ends < 0 ? [] : pieces.slice(opens, ends + 1)
  }
  const longRun = run(long)
  const fitsRun = run(fits)
  const opening = longRun[0]
  const second = longRun[1]
  const end = longRun.at(-1)
  const name = opening?.querySelector('.chip__name')
  const dots = end?.querySelector('.chip__lengths')
  const fitsFirst = fitsRun[0]
  const fitsName = fitsFirst?.querySelector('.chip__name')
  const nextTile = document.querySelector(`.calendar__grid a[href="${next}"]`)

  if (
    opening === undefined ||
    second === undefined ||
    name === null ||
    name === undefined ||
    dots === null ||
    dots === undefined ||
    fitsFirst === undefined ||
    fitsRun.length < 2 ||
    fitsName === null ||
    fitsName === undefined ||
    nextTile === null
  ) {
    return null
  }

  return {
    opening: box(opening),
    second: box(second),
    name: { ...box(name), scrollWidth: name.scrollWidth },
    dots: box(dots),
    fitsFirst: box(fitsFirst),
    fitsName: { ...box(fitsName), scrollWidth: fitsName.scrollWidth, clientWidth: fitsName.clientWidth },
    next: box(nextTile),
  }
}

/** What a press at this point would land on: the address of the link under it, and whether it is
 *  the name the bar opening with `long` draws. */
const whatIsAt = ({ x, y, long }: { x: number; y: number; long: string }) => {
  const hit = document.elementFromPoint(x, y)
  const opening = [...document.querySelectorAll(`.calendar__grid a.chip--scale[href$="/kalendar/${long}"]`)].find(
    (one) => !one.classList.contains('chip--continues'),
  )
  const name = opening?.querySelector('.chip__name') ?? null

  return {
    address: hit?.closest('a')?.getAttribute('href') ?? null,
    onTheName: hit !== null && name !== null && name.contains(hit),
    what: hit === null ? 'nothing' : `${hit.tagName.toLowerCase()}.${[...hit.classList].join('.')}`,
  }
}

/** A point `inside` pixels into the next tile, at the height of its middle, with what stands
 *  there. The tile is scrolled to first, by the page: at 200% text its row can be under the fold,
 *  and a point off the screen hits nothing. */
async function pointInsideTheNextTile(page: Page, inside: number) {
  await page.locator(READY).scrollIntoViewIfNeeded()

  const tile = await page.locator(READY).boundingBox()

  if (tile === null) {
    throw notMeasured('the next tile was drawn and has no box')
  }

  const point = { x: tile.x + inside, y: tile.y + tile.height / 2 }

  return { ...point, ...(await page.evaluate(whatIsAt, { ...point, long: LONG.slug })) }
}

for (const at of GRID) {
  test(`a bar's name stops before its dots and over its own pieces, and a press 2, 5 and 20px inside the next tile opens that tile, ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, CALENDAR, READY, ANSWERS)

    expect(await page.evaluate(columns), 'the month is a grid of seven columns at this width').toBe(7)

    /* The row with the bar and the tile on the screen, so every point read below can be hit. */
    await page.locator(READY).scrollIntoViewIfNeeded()

    const seen = await page.evaluate(theBars, { long: LONG.slug, fits: FITS.slug, next: NEXT_ADDRESS })

    if (seen === null) {
      throw notMeasured('the month did not draw the bars these records make')
    }

    /* The setting can show the fault, or nothing below measures it: the tile is in the same row as
       the bar, and the name, were nothing to stop it, would run past the tile's left edge. */
    expect(Math.abs(seen.next.top - seen.opening.top), 'the next tile stands in the row of the bar').toBeLessThan(1)
    expect(
      seen.name.left + seen.name.scrollWidth,
      'the whole name, unstopped, would reach 20px into the next tile',
    ).toBeGreaterThan(seen.next.left + 20)

    expect(seen.name.right, 'the name stops where the dots of its own bar begin').toBeLessThanOrEqual(
      seen.dots.left + SLACK,
    )

    expect(seen.fitsName.scrollWidth, 'a name that fits its bar is not cut').toBeLessThanOrEqual(seen.fitsName.clientWidth)
    expect(seen.fitsName.right, 'and it runs on past its first day').toBeGreaterThan(seen.fitsFirst.right)

    /* Over its own pieces and not under them: a point of the name inside the second day is the
       name, and not the ground of the piece drawn after it. */
    expect(seen.name.right, 'the name reaches into the second day of its bar').toBeGreaterThan(seen.second.left + 2)

    const over = await page.evaluate(whatIsAt, {
      x: seen.second.left + Math.min(10, (seen.name.right - seen.second.left) / 2),
      y: (seen.name.top + seen.name.bottom) / 2,
      long: LONG.slug,
    })

    expect(over.onTheName, `the name is drawn over its own second day, and there stands ${over.what}`).toBe(true)

    /* What is at the point first, so a press that would open the wrong event fails on that and not
       on a wait; then the press itself, by the mouse, which is the reader's outcome. */
    for (const inside of [2, 5, 20]) {
      const under = await pointInsideTheNextTile(page, inside)

      expect(under.address, `${inside}px inside the next tile is that tile, and there stands ${under.what}`).toBe(
        NEXT_ADDRESS,
      )

      await page.mouse.click(under.x, under.y)
      await page.waitForURL(`**${NEXT_ADDRESS}`, { timeout: 10_000 })
      await page.goBack()
      await settle(page, READY)
    }
  })
}

for (const at of STACKED) {
  test(`below the grid every piece of a bar is a tile of its own and keeps its name inside it, ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, CALENDAR, READY, ANSWERS)

    expect(await page.evaluate(columns), 'the days stand in one column at this width').toBe(1)

    const tiles = await page.evaluate((long) => {
      return [...document.querySelectorAll(`.calendar__grid a.chip--scale[href$="/kalendar/${long}"]`)].map((one) => {
        const piece = one.getBoundingClientRect()
        const style = getComputedStyle(one)
        const name = one.querySelector('.chip__name')?.getBoundingClientRect()

        return {
          inside: piece.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight),
          name: name === undefined ? null : name.right,
        }
      })
    }, LONG.slug)

    expect(tiles.length, 'the bar of two days is two tiles').toBe(2)

    for (const [index, tile] of tiles.entries()) {
      expect(tile.name, `the tile of day ${index + 1} draws its name`).not.toBeNull()
      expect(
        tile.name ?? Number.POSITIVE_INFINITY,
        `the name of day ${index + 1} stays inside its own tile`,
      ).toBeLessThanOrEqual(tile.inside + SLACK)
    }

    for (const inside of [2, 5, 20]) {
      const under = await pointInsideTheNextTile(page, inside)

      expect(under.address, `${inside}px inside the next tile is that tile, and there stands ${under.what}`).toBe(
        NEXT_ADDRESS,
      )
    }
  })
}

/** Days the page cannot be scrolled to, by their number: after the PAGE is scrolled to a day,
 *  and only the page, both the middle of its number and a point just inside its right edge at the
 *  same height have to be on the screen and be the day. A box a reader cannot scroll does not
 *  count, which is why the day is never scrolled into view itself: that would scroll a box with
 *  `overflow: hidden` too, and a reader cannot. */
const daysOutOfReach = () => {
  const root = document.documentElement
  const out: string[] = []
  const days = [...document.querySelectorAll('.calendar__grid .day')]

  for (const day of days) {
    const number = day.querySelector('.day__number')
    const before = day.getBoundingClientRect()

    scrollTo(before.left + before.width / 2 + scrollX - innerWidth / 2, before.top + scrollY - innerHeight / 3)

    const box = day.getBoundingClientRect()
    const mark = number?.getBoundingClientRect()
    const y = mark === undefined ? box.top + 4 : mark.top + mark.height / 2
    const points = [mark === undefined ? box.left + 4 : mark.left + mark.width / 2, box.right - 4]
    const reached = points.every((x) => {
      const hit = x >= 0 && x <= root.clientWidth && y >= 0 && y <= innerHeight ? document.elementFromPoint(x, y) : null

      return hit !== null && day.contains(hit)
    })

    if (!reached) {
      out.push(number?.firstChild?.textContent?.trim() ?? '?')
    }
  }

  scrollTo(0, 0)

  return { days: days.length, out }
}

for (const at of [
  ...[360, 390, 768, 779, 780, 1024, 1440].map((width): At => ({ width, text: 100 })),
  ...[360, 1440, 1560, 1920].map((width): At => ({ width, text: 200 })),
  { width: 1560, text: 200, theme: 'dark' } satisfies At,
]) {
  test(`no day of the month is out of reach${at.text === 100 ? ', and the page does not move sideways' : ''}, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, CALENDAR, READY, ANSWERS)
    const reach = await page.evaluate(daysOutOfReach)

    expect(reach.days, 'every day of October is drawn').toBe(31)
    expect(reach.out, 'days the page cannot be scrolled to').toEqual([])

    /* At the reader's own text the page never moves sideways (WCAG 2.2 SC 1.4.10, ADL A7). At 200%
       the floor under a day may make it move (`PDL.md` P24), so there only the reach is held. */
    if (at.text === 100) {
      expect(probe.sideways, 'the page scrolls sideways').toBe(0)
      expect(probe.widened, 'the page was made wider than the screen').toBe(0)
    }
  })
}

for (const at of GRID) {
  test(`the dots of every run stand against the right end of its last piece, ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, CALENDAR, READY, ANSWERS)
    const ends = await page.evaluate(() =>
      [...document.querySelectorAll('.calendar__grid a.chip--scale.chip--continues:not(.chip--runs-on)')].map((piece) => {
        const box = piece.getBoundingClientRect()
        const style = getComputedStyle(piece)
        const dots = piece.querySelector('.chip__lengths')?.getBoundingClientRect()
        const day = piece.closest('.day')?.querySelector('.day__number')?.firstChild?.textContent?.trim() ?? '?'

        return {
          which: `${piece.getAttribute('href') ?? '?'} on the ${day}.`,
          inside: box.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight),
          dots: dots === undefined ? null : { left: dots.left, right: dots.right },
        }
      }),
    )

    /* Five runs end in this month: the bar of two days, the bar its name fits, both halves of the
       bar across the week, and the bar of four days. */
    expect(ends.map((one) => one.which).sort(), 'the runs that end in this month').toEqual(
      [
        `${addressOf(LONG)} on the 6.`,
        `${addressOf(FITS)} on the 14.`,
        `${addressOf(ACROSS)} on the 18.`,
        `${addressOf(ACROSS)} on the 20.`,
        `${addressOf(FOUR)} on the 24.`,
      ].sort(),
    )

    for (const end of ends) {
      expect(end.dots, `the run ending ${end.which} draws its dots`).not.toBeNull()
      expect(
        Math.abs(end.inside - (end.dots?.right ?? Number.NEGATIVE_INFINITY)),
        `the dots of the run ending ${end.which} stand against its right end`,
      ).toBeLessThanOrEqual(1)
      expect((end.dots?.right ?? 0) - (end.dots?.left ?? 0), `the dots of the run ending ${end.which} are drawn`).toBeGreaterThan(0)
    }
  })
}
