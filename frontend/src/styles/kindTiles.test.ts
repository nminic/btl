import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EVENT_KINDS } from '../data/types'
import { at } from '../test/at'
import { contrast } from '../test/contrast'
import { ruleFor } from '../test/stylesheet'

/* THE TILE OF EVERY KIND OF EVENT (owner, 14.11.2026, on the fourth kind: „Nebodovana trka u
 * kalendaru nema tačku dužine, samo oznaku na pločici").
 *
 * **Nothing here is a list of kinds.** Which kinds there are is read from `EVENT_KINDS`, the one list the form, the
 * dictionary and the legend are all held to (`i18n/keys.test.ts`), and what each of them has to carry is read out of
 * the sheets: a tile that paints its face, its ink and its edge from three tokens, a swatch in the legend made the
 * same way, and the three tokens in the portal's one palette (PDL „Portal ima samo tamnu temu; svetla se izbacuje",
 * 24.11.2026). A fifth kind arrives as a red case here on the day it is written.
 *
 * **What the colour owes, measured and not remembered** (WCAG 2.2): the ink on the face 4,5:1 as text (SC 1.4.3), and
 * the edge on the face 3:1 as a graphic (SC 1.4.11). The gold of a featured
 * tile is measured in `featuredTile.test.ts`. Colour is never the only thing that says which kind a tile is: the tile
 * carries the word for a screen reader (`pages/calendarUnscored.test.tsx`) and the legend names every kind in words
 * (SC 1.4.1).
 *
 * **The race is the tile every other tile is a variation of**: it takes no modifier class, so its tokens are the
 * default the tile reads and it is measured here like the others, but it has no rule of its own to look for.
 */

const FLOOR_TEXT = 4.5
const FLOOR_GRAPHIC = 3

const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')
const calendar = readFileSync(join(process.cwd(), 'src/pages/Calendar.css'), 'utf-8')

/** Every value a token is given in the sheet of tokens: one, and a second would be a second palette. */
const given = (name: string): string[] =>
  [...tokens.matchAll(new RegExp(`\\s${name}: ([^;]+);`, 'g'))].map((one) => at(one, 1).trim())

/** A token that is a colour, or the colour the step of a scale it points at is. Only the race points at a step. */
function colourOf(value: string): string {
  const named = value.match(/^var\((--[a-z0-9-]+)\)$/)

  return named === null ? value : at(given(at(named, 1)), 0)
}

const THEMES = ['the palette']

describe.each(EVENT_KINDS)('the tile of the kind „%s"', (kind) => {
  it('is painted from three tokens, and the palette gives each of them one value', () => {
    for (const part of ['ink', 'face', 'edge']) {
      expect(given(`--kind-${kind}-${part}`), `--kind-${kind}-${part}`).toHaveLength(1)
    }
  })

  it.each(THEMES.map((name, index) => [name, index] as const))('is legible in %s', (_theme, index) => {
    const ink = colourOf(at(given(`--kind-${kind}-ink`), index))
    const face = colourOf(at(given(`--kind-${kind}-face`), index))
    const edge = colourOf(at(given(`--kind-${kind}-edge`), index))

    expect(contrast(ink, face), `${kind}: the name on the tile`).toBeGreaterThanOrEqual(FLOOR_TEXT)
    expect(contrast(edge, face), `${kind}: the edge against the tile`).toBeGreaterThanOrEqual(FLOOR_GRAPHIC)
  })

  it('is told apart from every other kind by its edge', () => {
    for (const [index, theme] of THEMES.entries()) {
      const mine = colourOf(at(given(`--kind-${kind}-edge`), index))
      const others = EVENT_KINDS.filter((one) => one !== kind).map((one) =>
        colourOf(at(given(`--kind-${one}-edge`), index)),
      )

      expect(others, `${kind} shares its edge in ${theme}`).not.toContain(mine)
    }
  })

  it('is drawn by the sheet of the calendar from those three tokens, on the grid and in the legend', () => {
    /* The race is what the tile is without a modifier and what the swatch is without one. */
    const tile = kind === 'race' ? '.chip' : `.chip--${kind}`
    const swatch = kind === 'race' ? '.legend__tile' : `.legend__tile--${kind}`

    expect(ruleFor(calendar, swatch, 'Calendar.css').getPropertyValue('background')).toBe(
      `var(--kind-${kind}-face)`,
    )

    if (kind !== 'race') {
      const drawn = ruleFor(calendar, tile, 'Calendar.css')

      expect(drawn.getPropertyValue('background')).toBe(`var(--kind-${kind}-face)`)
      expect(drawn.getPropertyValue('color')).toBe(`var(--kind-${kind}-ink)`)
      expect(drawn.getPropertyValue('border-left-color')).toBe(`var(--kind-${kind}-edge)`)
    }
  })
})
