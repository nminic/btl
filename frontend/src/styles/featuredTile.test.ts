import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { at, must } from '../test/at'
import { contrast } from '../test/contrast'
import { everyRule, ruleFor } from '../test/stylesheet'

/* THE GOLD TILE OF A FEATURED EVENT, AND WHAT CAN BE READ ON IT.
 *
 * Owner, 12.11.2026: „Kad su istaknuti događaji prikazani u kalendaru, neka cela
 * pločica bude zlatna, a onda prilagodi ostale boje elemenata unutar nje tako da budu
 * vidljivi." The second half is the one no screen test sees: jsdom computes no custom
 * property and paints nothing, so a dot that vanishes into the gold leaves every case
 * green. The arithmetic is done here, over the text of the sheets, the way
 * `goldBand.test.ts` does it for the band.
 *
 * **Nothing here is a list.** Which colours the tile has to answer for is read out of
 * the rules that draw a tile (every rule of `pages/Calendar.css` whose selector names
 * `.chip`, and every rule of `styles/table.css` that draws a `.length-dot`), and which
 * of those flip with the theme is read out of `styles/tokens.css`. A seventh length,
 * a fourth kind or a new colour on the tile is therefore asked about on the day it is
 * written, rather than on the day somebody remembers this file.
 */

const FLOOR_TEXT = 4.5
const FLOOR_GRAPHIC = 3

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf-8')
}

const tokens = read('src/styles/tokens.css')
const calendar = read('src/pages/Calendar.css')
const table = read('src/styles/table.css')

/** Every value a token is given, in the order the file gives them: the light theme,
 *  then the dark one the system asks for, then the dark one the switch sets. */
const given = (name: string) =>
  [...tokens.matchAll(new RegExp(`\\s${name}: ([^;]+);`, 'g'))].map((one) => at(one, 1).trim())

/** A token followed to the colour it ends in, through as many `var()` as it takes. */
function colour(name: string, seen: string[] = []): string {
  expect(seen, `${name} is defined in terms of itself`).not.toContain(name)

  const values = given(name)

  expect(values, `${name} should be declared exactly once, so it does not flip`).toHaveLength(1)

  const value = at(values, 0)
  const named = value.match(/^var\((--[a-z0-9-]+)\)$/)

  if (named === null) {
    expect(value, `${name} is not a colour`).toMatch(/^#[0-9a-f]{6}$/)
    return value
  }

  return colour(must(named[1], 'the name inside var()'), [...seen, name])
}

/** What a rule declares, as the parser kept it, and every token its values read. */
function readBy(rules: CSSStyleRule[]): { property: string; token: string }[] {
  return rules.flatMap((rule) =>
    [...rule.style].flatMap((property) =>
      [...rule.style.getPropertyValue(property).matchAll(/var\((--[a-z0-9-]+)\)/g)].map((one) => ({
        property,
        token: at(one, 1),
      })),
    ),
  )
}

/** The value the light theme gives a token, followed to a colour. A token with one value
 *  has one, and it answers here as well. */
function lightColour(name: string, seen: string[] = []): string {
  expect(seen, `${name} is defined in terms of itself`).not.toContain(name)

  const value = must(given(name)[0], `${name} has no value`)
  const named = value.match(/^var\((--[a-z0-9-]+)\)$/)

  return named === null ? value : lightColour(must(named[1], 'the name inside var()'), [...seen, name])
}

/* The rules that draw a tile and what is on it. `.chip--featured` itself is left out,
   because it is the rule being measured and not one of the rules it answers for. */
const chipRules = everyRule(calendar, 'Calendar.css').filter(
  (rule) => rule.selectorText.includes('.chip') && rule.selectorText !== '.chip--featured',
)
const tileRules = [
  ...chipRules,
  ...everyRule(table, 'table.css').filter((rule) => rule.selectorText.includes('.length-dot')),
]

/* What the tile itself is painted with: read by a `background` of a rule that draws the
   tile, and not of a dot on it. Only these may be the gold; anything else pointed at the
   gold is a part of the tile that has vanished into it. */
const grounds = new Set(
  readBy(chipRules)
    .filter((one) => one.property.startsWith('background'))
    .map((one) => one.token),
)

/* Read by the tile, and given a value per theme. Those are the ones that would come
   out of the gold in one theme or the other. */
const flipping = [...new Set(readBy(tileRules).map((one) => one.token))].filter(
  (token) => given(token).length > 1,
)

/* Read by a `color` declaration somewhere on the tile, which makes it ink on text. */
const inks = new Set(
  readBy(tileRules)
    .filter((one) => one.property === 'color')
    .map((one) => one.token),
)

const featured = () => ruleFor(calendar, '.chip--featured', 'Calendar.css')

/** What `.chip--featured` points a token at, by the name of the token it points to. */
function pointedAt(token: string): string {
  const value = featured().getPropertyValue(token).trim()
  const named = value.match(/^var\((--featured-[a-z0-9-]+)\)$/)

  expect(named, `.chip--featured leaves ${token} to the theme (${value || 'not set'})`).not.toBeNull()

  return must(named?.[1], `what ${token} is pointed at`)
}

describe('the gold tile of a featured event', () => {
  it('is gold in both themes alike', () => {
    /* One value each, so the tile is the same block of gold on both themes and one
       measurement below answers for both. Every `--featured-*` token the file holds,
       read out of the file. */
    const names = [...new Set([...tokens.matchAll(/\s(--featured-[a-z0-9-]+):/g)].map((one) => at(one, 1)))]

    expect(names.length, 'no featured token found at all').toBeGreaterThan(0)
    for (const name of names) {
      colour(name)
    }

    expect(colour('--featured-face')).toBe(colour('--gold-300'))
  })

  it('points every colour the tile reads that flips with the theme at one that does not', () => {
    /* The kind's three and the six lengths' today. Fewer means the parse found
       nothing and the rest of this file measures an empty set. */
    expect(flipping.length, `found only ${flipping.join(', ')}`).toBeGreaterThanOrEqual(9)

    for (const token of flipping) {
      pointedAt(token)
    }
  })

  it('makes the ground gold and nothing else', () => {
    /* The face of each kind is pointed at the gold, which is what makes the tile gold.
       Anything else pointed there, an edge or a dot, would be measured against itself
       below and quietly left out, so it is refused here instead. */
    expect(grounds.size, 'no ground found on the tile').toBeGreaterThanOrEqual(3)

    for (const token of flipping) {
      expect(
        pointedAt(token) === '--featured-face',
        `${token} is ${grounds.has(token) ? 'a ground and is not gold' : 'not a ground and is gold'}`,
      ).toBe(grounds.has(token))
    }
  })

  it('keeps each kind its own edge, the one the light theme gives it', () => {
    /* Owner, 12.11.2026, the same evening: the edge of a featured tile keeps the colour
       of its kind, race, skup or trening. The light theme's, because the gold under it
       does not flip and the dark theme's edges vanish into it. Every kind edge the tile
       reads, by its name; three today. */
    const edges = flipping.filter((token) => /^--kind-[a-z]+-edge$/.test(token))

    expect(edges.length, `found only ${edges.join(', ')}`).toBeGreaterThanOrEqual(3)

    const drawn = edges.map((token) => colour(pointedAt(token)))

    for (const [index, token] of edges.entries()) {
      expect(drawn[index], `${token} on a featured tile is not its own light edge`).toBe(lightColour(token))
    }

    /* And three edges are three colours, so a tile whose kinds all share one edge fails
       even if that one edge happened to be somebody's light value. */
    expect(new Set(drawn).size, `the kinds share an edge: ${drawn.join(', ')}`).toBe(edges.length)
  })

  it('carries every colour on it at the contrast its job owes, against the gold', () => {
    const face = colour('--featured-face')
    const measured = flipping
      .map((token) => ({ token, to: pointedAt(token) }))
      /* The ground itself is the thing everything else is measured against, and the case
         above holds that only the ground is pointed at it. */
      .filter((one) => !grounds.has(one.token))
      .map((one) => {
        const floor = inks.has(one.token) ? FLOOR_TEXT : FLOOR_GRAPHIC
        const ratio = contrast(colour(one.to), face)

        return { ...one, floor, ratio }
      })

    /* Three inks of text, one per kind; and three edges and six dots of graphic. */
    expect(measured.filter((one) => one.floor === FLOOR_TEXT)).toHaveLength(3)
    expect(measured.filter((one) => one.floor === FLOOR_GRAPHIC).length).toBeGreaterThanOrEqual(9)

    for (const one of measured) {
      expect(
        one.ratio,
        `${one.token} → ${one.to} is ${one.ratio.toFixed(2)}:1 on the gold, under ${one.floor}`,
      ).toBeGreaterThanOrEqual(one.floor)
    }
  })

  it('would have lost the dots of the dark theme without it', () => {
    /* Why the re-pointing exists at all, held as numbers so the reason does not drift
       away from the sheet. The dark theme's long dot on this gold, and the light
       theme's marathon dot, which clears 3:1 by seven hundredths. */
    expect(contrast('#e3c04a', '#f0c94a')).toBeCloseTo(1.11, 2)
    expect(contrast('#b8531a', '#f0c94a')).toBeCloseTo(3.07, 2)
    /* And the dark theme's edge of a trening, the narrowest of the three kinds. */
    expect(contrast('#62c3ce', '#f0c94a')).toBeCloseTo(1.29, 2)
  })
})
