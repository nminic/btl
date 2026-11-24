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
 * of those are colours of the palette is read out of `styles/tokens.css`. A seventh length,
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

/** Every value a token is given in the sheet of tokens: one, since the portal has one
 *  palette (PDL „Portal ima samo tamnu temu; svetla se izbacuje", 24.11.2026). */
const given = (name: string) =>
  [...tokens.matchAll(new RegExp(`\\s${name}: ([^;]+);`, 'g'))].map((one) => at(one, 1).trim())

/** A token followed to the colour it ends in, through as many `var()` as it takes. */
function colour(name: string, seen: string[] = []): string {
  expect(seen, `${name} is defined in terms of itself`).not.toContain(name)

  const values = given(name)

  expect(values, `${name} should be declared exactly once`).toHaveLength(1)

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

/** Whether a token of the sheet of tokens ends in a colour, asked without failing: a size or
 *  a duration the tile reads is not a colour of the palette and is left out, not refused. */
function isAColour(name: string, seen: string[] = []): boolean {
  const value = given(name)[0]

  if (value === undefined || seen.includes(name)) {
    return false
  }

  const named = value.match(/^var\((--[a-z0-9-]+)\)$/)

  return named === null ? /^#[0-9a-f]{6}$/.test(value) : isAColour(must(named[1], 'the name inside var()'), [...seen, name])
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

/* Read by the tile, and a colour of the portal's palette: made for a near black card, and
   so the ones that would vanish into the gold. Until 24.11.2026 these were found as the
   tokens given a value per theme; with one theme, they are found as what they are. The
   featured set itself is what they are pointed at and is not among them. */
const flipping = [...new Set(readBy(tileRules).map((one) => one.token))].filter(
  (token) => !token.startsWith('--featured-') && isAColour(token),
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
  it('is gold, and every colour on it is given once', () => {
    /* One value each, so one measurement below answers for the tile. Every
       `--featured-*` token the file holds, read out of the file. */
    const names = [...new Set([...tokens.matchAll(/\s(--featured-[a-z0-9-]+):/g)].map((one) => at(one, 1)))]

    expect(names.length, 'no featured token found at all').toBeGreaterThan(0)
    for (const name of names) {
      colour(name)
    }

    expect(colour('--featured-face')).toBe(colour('--gold-300'))
  })

  it('points every colour of the palette the tile reads at one of its own', () => {
    /* The three tokens of each of the four kinds and the six lengths' today. Fewer means the parse
       found nothing, or that a kind has stopped being read by the tile, and the rest of this file
       measures an empty set. */
    expect(flipping.length, `found only ${flipping.join(', ')}`).toBeGreaterThanOrEqual(18)

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

  it('keeps each kind its own edge, a deeper one of the same kind', () => {
    /* Owner, 12.11.2026, the same evening: the edge of a featured tile keeps the colour
       of its kind, race, skup or trening. The edges of the palette vanish into the gold,
       so each kind has a deeper edge of its own here: the value the light theme gave that
       kind until 24.11.2026, written down as it was, because it is what the owner chose
       between and saw. Held by value, so a retuning is a decision somebody takes. Every
       kind edge the tile reads, by its name; four today. */
    const edges = flipping.filter((token) => /^--kind-[a-z]+-edge$/.test(token))

    expect(edges.length, `found only ${edges.join(', ')}`).toBeGreaterThanOrEqual(4)

    const drawn = Object.fromEntries(edges.map((token) => [token, colour(pointedAt(token))]))

    expect(drawn).toEqual({
      '--kind-race-edge': '#10459a',
      '--kind-gathering-edge': '#4a2790',
      '--kind-training-edge': '#0d626b',
      '--kind-unscored-edge': '#8f1b5f',
    })

    /* And four edges are four colours, so a tile whose kinds all share one edge fails. */
    expect(new Set(Object.values(drawn)).size, `the kinds share an edge`).toBe(edges.length)
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

    /* Four inks of text, one per kind; and four edges and six dots of graphic. */
    expect(measured.filter((one) => one.floor === FLOOR_TEXT)).toHaveLength(4)
    expect(measured.filter((one) => one.floor === FLOOR_GRAPHIC).length).toBeGreaterThanOrEqual(10)

    for (const one of measured) {
      expect(
        one.ratio,
        `${one.token} → ${one.to} is ${one.ratio.toFixed(2)}:1 on the gold, under ${one.floor}`,
      ).toBeGreaterThanOrEqual(one.floor)
    }
  })

  it('would have lost the dots of the palette without it', () => {
    /* Why the re-pointing exists at all, held as numbers so the reason does not drift
       away from the sheet: the palette's long dot on this gold, read off the sheet. */
    expect(contrast(colour('--length-long'), colour('--featured-face'))).toBeCloseTo(1.11, 2)
    /* And the palette's edge of a trening, the narrowest of the three kinds. */
    expect(contrast(colour('--kind-training-edge'), colour('--featured-face'))).toBeCloseTo(1.29, 2)
  })
})
