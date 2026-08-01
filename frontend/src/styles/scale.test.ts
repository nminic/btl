import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/* The scale, and the thing that keeps it a scale.
 *
 * Space, corner radii and the widths at which the portal changes shape were all
 * written as numbers where they were used. They spread: thirty near values for
 * space, ten for a corner, eleven widths. Nobody chose 0,35 over 0,4 over 0,45;
 * they were each typed once, next to each other, and then copied.
 *
 * Putting them on a scale is a morning's work. Keeping them there is this file:
 * without it the next hurried rule writes 0,45rem again and nothing says so.
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

    return entry.name.endsWith('.css') ? [{ path: name, css: readFileSync(at, 'utf-8') }] : []
  })
}

const SPACING = /(?<![-\w])((?:padding|margin|gap|row-gap|column-gap|inset)[a-z-]*)\s*:\s*([^;{}]+);/g

/* What is allowed to stay a number, and why. Each one is a measurement of a
   thing rather than a step of a rhythm, or a value the scale has no business
   holding. */
const ALLOWED = new Map([
  ['-1px', 'a hairline pulled back over its own border'],
  ['-0.2rem', 'a control pulled back over the padding around it'],
  ['7.5rem', 'the size of a portrait'],
  ['11rem', 'the width of a column of names'],
  ['0', 'nothing is nothing on any scale'],
  /* In em on purpose: the padding around a piece of code inside a sentence has
     to grow with the code, not with the page. */
  ['0.05em', 'the padding around inline code, in its own text size'],
  ['0.3em', 'the padding around inline code, in its own text size'],
])

describe('space and corners are chosen from the scale, not typed', () => {
  const sheets = stylesheets().filter((one) => one.path !== 'styles/tokens.css')

  it('reads every stylesheet in the portal', () => {
    /* Without this the two below pass on an empty list, which is the shape every
       sweeping test fails in. */
    expect(sheets.length).toBeGreaterThan(25)
    expect(sheets.some((one) => one.path === 'pages/Home.css')).toBe(true)
  })

  it('leaves no bare space value outside the ones named here', () => {
    const bare: string[] = []

    for (const sheet of sheets) {
      for (const rule of sheet.css.matchAll(SPACING)) {
        for (const [, value] of (rule[2] ?? '').matchAll(/(?<![\w(])(-?\d*\.?\d+(?:rem|px|em))/g)) {
          if (value !== undefined && !ALLOWED.has(value)) {
            bare.push(`${sheet.path}: ${rule[1]}: ${value}`)
          }
        }
      }
    }

    expect(bare).toEqual([])
  })

  it('leaves no bare corner outside a circle', () => {
    const bare: string[] = []

    for (const sheet of sheets) {
      for (const rule of sheet.css.matchAll(/(?<![-\w])([a-z-]*radius[a-z-]*)\s*:\s*([^;{}]+);/g)) {
        /* A circle is a shape and not a step, so 50% stays written out. */
        const value = (rule[2] ?? '').replaceAll('50%', '')

        for (const [, found] of value.matchAll(/(?<![\w(])(\d*\.?\d+(?:rem|px|em))/g)) {
          if (found !== undefined && found !== '0') {
            bare.push(`${sheet.path}: ${rule[1]}: ${found}`)
          }
        }
      }
    }

    expect(bare).toEqual([])
  })

  it('changes shape at the widths the token file lists, and at two named others', () => {
    /* A custom property cannot be used in a media query, so these are the one
       thing here that cannot become a token. The set is held instead: four
       widths for the page, and two screens whose own content sets theirs, each
       of which says so where it is written. */
    const widths = new Set<string>()

    for (const sheet of sheets) {
      for (const query of sheet.css.matchAll(/@media \(m[ai][nx]-width: (\d+)px\)/g)) {
        widths.add(query[1] as string)
      }
    }

    expect([...widths].map(Number).sort((left, right) => left - right)).toEqual([
      560,
      700,
      // The other half of 820, for the rules that stop where the wide layout starts.
      819,
      820,
      // The front page: ten faces stop fitting the chart's column below this.
      860,
      // The moderator's rights table, which is sixteen columns wide.
      900,
      1000,
    ])
  })
})
