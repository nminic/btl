import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/* The scale, and the thing that keeps it a scale.
 *
 * Space and corner radii were written as numbers where they were used. They
 * spread: thirty near values for space, nine for a corner. Nobody chose 0,35
 * over 0,4 over 0,45; they were each typed once, next to each other, and then
 * copied.
 *
 * Putting them on a grid is a morning's work. Keeping them there is this file:
 * without it the next hurried rule writes 0,45rem again and nothing says so.
 *
 * What this does not cover is written down rather than left to be discovered.
 * Sizes are not swept: about a hundred and forty widths and heights are still
 * written out, and several of them are on the same rhythm as the padding beside
 * them. That is the next pass, not this one, and saying so here is cheaper than
 * a reader assuming the portal is tidier than it is.
 */

const SRC = join(process.cwd(), 'src')

/** Every stylesheet under `src`, with its path relative to it. */
function stylesheets(dir = SRC, prefix = ''): { path: string; css: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return stylesheets(at, name)
    }

    /* Line endings normalised, because the value a declaration is written on
       becomes part of the key a value is allowed under, and git hands these
       files out with CRLF on Windows and LF elsewhere. Without this the guard
       passes or fails by how the working copy was checked out, which is a fact
       about a machine and not about the stylesheet. */
    return entry.name.endsWith('.css')
      ? [{ path: name, css: readFileSync(at, 'utf-8').replaceAll('\r\n', '\n') }]
      : []
  })
}

/* Both ways of writing the same thing. `inset-block-start` and `top` are one
   measurement, and a sweep that asks for a token from one and not the other
   makes the scale a matter of which spelling somebody reached for. */
const SPACING =
  /(?<![-\w])((?:padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left|scroll-margin)[a-z-]*)\s*:\s*([^;{}]+);/g

/* Every fixed number with a unit. Percentages and viewport units are left out
   on purpose: they are relative to something that moves, so they are not steps
   of a grid and putting them on one would mean nothing. */
const VALUE = /(-?\d*\.?\d+)(rem|px|em|ch)/g

/**
 * What may stay a number, keyed by where it is.
 *
 * Keyed on the rule and not on the value alone: keyed on the value, allowing
 * `7,5rem` once allows it everywhere, and the reason written beside it stops
 * being true the moment somebody uses it for something else.
 */
const ALLOWED = new Map([
  ['index.css | margin | -1px', 'a hairline pulled back over its own border'],
  [
    'pages/TopBoards.css | margin | -1px',
    'not a space: the recipe that takes a surname off the screen without taking it out of the page, written out because a container query switches whether it applies and cannot put a class on anything',
  ],
  ['components/DucatGallery.css | margin | -1px', 'a hairline pulled back over its own border'],
  ['app/Shell.css | left | -9999px', 'not a distance: the old way of putting a thing off the screen'],
  ['pages/Home.css | inset-inline-start | -0.2rem', 'a mark pulled out over the corner it sits on'],
  ['pages/Home.css | inset-block-start | -0.2rem', 'a mark pulled up over the corner it sits on'],
  [
    'pages/league/League.css | inset-inline-start | 7.5rem',
    'the second sticky column starts where the first one ends, so it is that column measured, not a step',
  ],
  [
    'pages/league/League.css | inset-inline-start | 11rem',
    'the same, at the width the wide layout gives that column',
  ],
  [
    'components/Markdown.css | padding | 0.05em 0.3em',
    'in em on purpose: the padding around code inside a sentence grows with the code, not with the page',
  ],
  [
    'components/ColumnChart.css | padding-block-start | 3.1rem',
    'the measured clearance that keeps the pause control off the tenth face, and kept only on the one chart that has a control',
  ],
  [
    'pages/admin/SectionNav.css | padding | 0.05rem var(--space-6)',
    'under the smallest step the grid has, on the tallest thing in its row',
  ],
  /* Four offsets that pull a thing back over the corner it sits on. Each is one
     more value nobody chose, and each is invisible; they are named here rather
     than swept because moving them is a decision about how far a counter hangs
     off an icon, which is not what this pass is. */
  ['app/Shell.css | top | -0.35rem', 'a counter pulled up over the icon it counts'],
  ['app/Shell.css | right | -0.35rem', 'the same, sideways'],
  ['app/Shell.css | right | -0.5rem', 'the same, on the wider one'],
  ['pages/Profile.css | right | 0.85rem', 'a mark set in from the corner of a card'],
  [
    'components/ColumnChart.css | inset-inline | -0.5rem',
    'the name over a bar reaches past it on both sides, because a name is wider than a bar',
  ],
  [
    'components/ColumnChart.css | padding | var(--space-10) var(--space-10)\n    max(var(--space-12), calc(var(--count-chars, 2) * 0.24rem + var(--space-6)))',
    'the step under the bars is half the circle that hangs into it, and the circle is as wide as the longest number in the chart, so this one is arithmetic and not a step off the scale',
  ],
])

describe('space and corners are chosen from the scale, not typed', () => {
  const sheets = stylesheets().filter((one) => one.path !== 'styles/tokens.css')

  it('reads every stylesheet in the portal', () => {
    /* Without this the checks below pass on an empty list, which is the shape
       every sweeping test fails in. */
    expect(sheets.length).toBeGreaterThan(30)
    expect(sheets.some((one) => one.path === 'pages/Home.css')).toBe(true)
    expect(sheets.some((one) => one.path === 'app/Shell.css')).toBe(true)
  })

  it('leaves no bare space value outside the ones named here', () => {
    const bare: string[] = []

    for (const sheet of sheets) {
      for (const rule of sheet.css.matchAll(SPACING)) {
        const property = rule[1] as string
        const value = (rule[2] as string).trim()
        /* The whole value, so a failure names what is actually written rather
           than the first number a reader of the regex happens to reach. */
        const key = `${sheet.path} | ${property} | ${value}`

        if (ALLOWED.has(key) || !VALUE.test(value)) {
          VALUE.lastIndex = 0
          continue
        }
        VALUE.lastIndex = 0

        /* A value is clean when every number in it came from a token. */
        if (value.replaceAll(/var\(--[a-z0-9-]+\)/g, '').match(VALUE) !== null) {
          bare.push(key)
        }
      }
    }

    expect(bare).toEqual([])
  })

  it('leaves no bare corner outside a circle and two measured ones', () => {
    const measured = new Set([
      'app/Shell.css | border-radius | 2.5px',
      'components/ColumnChart.css | border-radius | 2px 2px 0 0',
      /* The foot of a two-level bar, which is the foot of the bar: the same two
         pixels, the other way up. */
      'components/ColumnChart.css | border-radius | 0 0 2px 2px',
    ])
    const bare: string[] = []

    for (const sheet of sheets) {
      for (const rule of sheet.css.matchAll(/(?<![-\w])([a-z-]*radius[a-z-]*)\s*:\s*([^;{}]+);/g)) {
        const value = (rule[2] as string).trim()
        const key = `${sheet.path} | ${rule[1]} | ${value}`

        if (measured.has(key)) {
          continue
        }

        /* A circle is a shape and not a step, so 50% stays written out. */
        const left = value.replaceAll(/var\(--[a-z0-9-]+\)|50%|(?<![\d.])0(?![\d.])/g, '')

        if (left.match(VALUE) !== null) {
          bare.push(key)
        }
      }
    }

    expect(bare).toEqual([])
  })

  it('changes shape only at the widths listed here, each of which says why', () => {
    /* A custom property cannot be used in a media query, so these are the one
       thing here that cannot become a token. They are held instead.
     *
     * They also turned out not to be the drift the rest of this was: eleven
     * widths went to ten, because six of the eight moves changed a layout and
     * had to go back. Each width that is not one of the four the page uses
     * carries a comment where it is written saying what sets it.
     *
     * The pattern is deliberately loose about how the query is spelled: `@media
     * screen and (...)`, a second condition in the same query, and a missing
     * space all used to slip past a stricter one. */
    const widths: string[] = []

    for (const sheet of sheets) {
      /* Only `@media`. A container query asks the same question of a box rather
         than of the window, so its widths are a property of one component and
         not a place where the portal changes shape. */
      const queries = [...sheet.css.matchAll(/@media([^{]*)\{/g)].map((one) => one[1] ?? '')

      for (const query of queries.join(' ').matchAll(/\(\s*(?:min|max)-width\s*:\s*([\d.]+)([a-z]+)\s*\)/g)) {
        /* In pixels, always: a breakpoint in em moves with the reader's text
           size while every other width here does not. */
        expect(query[2], `${sheet.path} sets a breakpoint in ${query[2]}`).toBe('px')
        widths.push(query[1] as string)
      }
    }

    expect([...new Set(widths)].map(Number).sort((left, right) => left - right)).toEqual([
      // A telephone stops being a telephone. Its other half, so the two do not
      // both fire on the pixel where they meet.
      559.98, 560,
      // A narrow window, where a table gives up its columns. Same, and its half.
      620, 699.98, 700,
      // The wide layout, and the navigation stops folding away. 819 is its half.
      780, 819, 820,
      // Set by their own content, each said where it is written: the front page
      // at 860, the rights table and the Top liste at 900.
      860, 900, 1000,
    ])
  })
})
