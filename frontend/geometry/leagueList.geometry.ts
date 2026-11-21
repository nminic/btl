import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, SLACK, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE CARDS OF THE COMPETITIONS STAND THREE TO A ROW ON A COMPUTER, TWO ON A TABLET AND ONE ON A
 * TELEPHONE, AND THE SHEET OF THE CHOSEN ONE STANDS UNDER THEM ACROSS THE WHOLE LIST.
 *
 * Owner, 21.11.2026 (PDL „Strana „Lige” se radi po predlogu B”), chosen between the ones offered:
 * „Kartica lige je trećina širine na računaru, polovina na tabletu, cela širina na telefonu; list
 * izabrane lige je preko cele širine (obara odluku od 07.09.2026 o boksu preko cele širine).” Until
 * that day this file held the opposite: every competition a box across the whole page, none beside
 * another.
 *
 * **Asked of Chrome, because a stylesheet read as text cannot answer it**: how many distinct columns
 * the cards stand in, that no two cards and nothing inside one card overlap, that the sheet starts and
 * ends where the showcase does and stands below it, and that the page never moves sideways.
 *
 * **At 200 per cent text the widths of the sheet are cut in `em`, so they move with the text**: at
 * 1280 the cards stand two to a row and at 768 one, which is the reflow WCAG 2.2 SC 1.4.4 and 1.4.10
 * ask for rather than three cards too narrow for their names. Both are measured, as is nothing
 * overlapping at either size.
 */

/** A day the sample's competition is drawn on, in the middle of its season. */
test.use({ theDay: '2027-03-01' })

const SAMPLE: Record<string, unknown>[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/test/mock/leagues.json', import.meta.url)), 'utf-8'),
)

const FIRST = SAMPLE.find((one) => one.season === 2027)

if (FIRST === undefined) {
  throw new Error('the served file has no competition in 2027')
}

/* Six competitions of one season, with names long and short, so a card that holds a long name is
   measured beside one that holds a short one. */
const NAMES = [
  'RunTrace liga 2027',
  'Trail liga Srbije',
  'Zimska liga Beograda',
  'Polumaratonska liga regiona',
  'Liga ultra staza Dinarida i Prokletija',
  'Vojvođanska liga ravnice „Đeram”',
]

const SIX = NAMES.map((name, index) => ({ ...FIRST, id: 900 + index, slug: `liga-${index}`, name }))

const WIDTHS: { at: At; columns: number }[] = [
  { at: { width: 360, text: 100 }, columns: 1 },
  { at: { width: 768, text: 100 }, columns: 2 },
  { at: { width: 1280, text: 100 }, columns: 3 },
  { at: { width: 360, text: 200 }, columns: 1 },
  { at: { width: 768, text: 200 }, columns: 1 },
  { at: { width: 1280, text: 200 }, columns: 2 },
]

type Box = { left: number; right: number; top: number; bottom: number }

const overlap = (one: Box, other: Box): boolean =>
  one.left < other.right - SLACK &&
  other.left < one.right - SLACK &&
  one.top < other.bottom - SLACK &&
  other.top < one.bottom - SLACK

for (const { at, columns } of WIDTHS) {
  test(`six competitions stand ${columns} to a row with the sheet under them, ${label(at)}`, async ({ open }) => {
    const answers: Answers = { '/api/leagues': SIX }
    const { page, probe } = await open(at, '/sr/lige', '.leagues__sheet', answers)

    const seen = await page.evaluate(() => {
      const showcase = document.querySelector('.leagues__showcase')
      const sheet = document.querySelector('.leagues__sheet')

      if (showcase === null || sheet === null) {
        return null
      }

      const box = (one: Element) => {
        const found = one.getBoundingClientRect()

        return { left: found.left, right: found.right, top: found.top, bottom: found.bottom }
      }

      return {
        showcase: box(showcase),
        sheet: box(sheet),
        tiles: [...showcase.querySelectorAll(':scope > li')].map((tile) => ({
          box: box(tile),
          /* What a card is read by: its sign, its name, its facts and the way to its table. */
          parts: [...tile.querySelectorAll(':scope > *')]
            .filter((part) => part.getBoundingClientRect().height > 0)
            .map(box),
        })),
        /* And the head of the sheet: its sign, its name, the pills and the golden way to the table. */
        head: [...sheet.querySelectorAll('.leagues__score > *, .leagues__pills > li')]
          .filter((part) => !part.classList.contains('leagues__pills'))
          .map(box),
        /* Each pill on one line, as wide as its words: the front page's tile is a size container, and
           in this row that once made every pill a column one letter wide with nothing overlapping. */
        pills: [...sheet.querySelectorAll('.score__pill')].map((pill) => {
          const found = pill.getBoundingClientRect()

          return { width: found.width, letter: parseFloat(getComputedStyle(pill).fontSize) }
        }),
      }
    })

    if (seen === null) {
      throw notMeasured('the screen drew no showcase or no sheet')
    }

    expect(seen.tiles.length, 'six competitions served, six cards').toBe(6)

    const lefts = new Set(seen.tiles.map((one) => Math.round(one.box.left)))

    expect(lefts.size, 'how many cards stand in one row').toBe(columns)

    for (const [index, tile] of seen.tiles.entries()) {
      expect(tile.box.left, `card ${index + 1} starts inside the showcase`).toBeGreaterThanOrEqual(seen.showcase.left - SLACK)
      expect(tile.box.right, `card ${index + 1} ends inside the showcase`).toBeLessThanOrEqual(seen.showcase.right + SLACK)

      for (const [other, then] of seen.tiles.entries()) {
        if (other > index) {
          expect(overlap(tile.box, then.box), `card ${index + 1} overlaps card ${other + 1}`).toBe(false)
        }
      }

      for (const [part, one] of tile.parts.entries()) {
        for (const [later, two] of tile.parts.entries()) {
          if (later > part) {
            expect(overlap(one, two), `two parts of card ${index + 1} overlap`).toBe(false)
          }
        }
      }
    }

    expect(seen.sheet.left, 'the sheet starts where the showcase starts').toBeCloseTo(seen.showcase.left, 0)
    expect(Math.abs(seen.sheet.right - seen.showcase.right), 'the sheet ends where the showcase ends').toBeLessThanOrEqual(SLACK)
    expect(seen.sheet.top, 'the sheet stands under the showcase').toBeGreaterThanOrEqual(seen.showcase.bottom - SLACK)

    for (const [part, one] of seen.head.entries()) {
      for (const [later, two] of seen.head.entries()) {
        if (later > part) {
          expect(overlap(one, two), 'two parts of the head of the sheet overlap').toBe(false)
        }
      }
    }

    expect(seen.pills.length, 'the sheet carries its three pills').toBe(3)

    for (const [index, pill] of seen.pills.entries()) {
      expect(pill.width, `pill ${index + 1} is wider than four letters`).toBeGreaterThan(4 * pill.letter)
    }

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)
  })
}

for (const at of [
  { width: 360, text: 100 },
  { width: 1280, text: 100 },
  { width: 1280, text: 200 },
] satisfies At[]) {
  test(`one competition is its sheet alone, across the whole list, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr/lige', '.leagues__sheet', { '/api/leagues': [{ ...FIRST, rules: 'Propozicije lige, napisane dovoljno dugo da strana bude duža od prozora. '.repeat(60) }] })

    const seen = await page.evaluate(() => {
      const sheet = document.querySelector('.leagues__sheet')
      const holder = sheet?.parentElement

      if (sheet === null || holder === null || holder === undefined) {
        return null
      }

      const inner = holder.getBoundingClientRect()
      const found = sheet.getBoundingClientRect()

      return {
        showcases: document.querySelectorAll('.leagues__showcase').length,
        sheet: { left: found.left, right: found.right },
        holder: {
          left: inner.left + parseFloat(getComputedStyle(holder).paddingLeft),
          right: inner.right - parseFloat(getComputedStyle(holder).paddingRight),
        },
      }
    })

    if (seen === null) {
      throw notMeasured('the screen drew no sheet')
    }

    expect(seen.showcases, 'one competition draws no showcase').toBe(0)
    expect(seen.sheet.left).toBeCloseTo(seen.holder.left, 0)
    expect(Math.abs(seen.sheet.right - seen.holder.right)).toBeLessThanOrEqual(SLACK)
    expect(probe.sideways).toBe(0)
  })
}
