import { readFileSync } from 'node:fs'
import { must } from '../test/at'
import { join } from 'node:path'

/**
 * The row the filters stand in, held in the stylesheet where it is decided.
 *
 * jsdom computes no layout, so nothing that renders this screen can say whether
 * three fields are side by side or one under the other. What can be said is
 * that the rules the arrangement is built out of are still there, and each of
 * them is one the owner asked for by name.
 *
 * Read off the text, the way the other stylesheet guards on this portal are
 * (styles/hooks.test.ts, styles/scale.test.ts). Comments are blanked first, so
 * a rule described in prose is never mistaken for a rule that is written.
 */

const SHEET = blanked(readFileSync(join(process.cwd(), 'src/pages/Rankings.css'), 'utf-8'))

/** The sheet with its comments taken out. */
function blanked(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** One rule's body inside the telephone's media query, by its selector. */
function phoneRule(selector: string): string {
  const phone = SHEET.slice(SHEET.indexOf('@media (max-width: 559.98px)'))
  const at = phone.indexOf(`${selector} {`)

  expect(at, `${selector} is not in the telephone's rules`).toBeGreaterThan(-1)

  return phone.slice(at, phone.indexOf('}', at))
}

/**
 * One rule's body, by its selector.
 *
 * The last of them, not the first: three of these selectors are written twice,
 * once inside the telephone's media query and once for every width, and the
 * media query stands first in the sheet. Asked for the first, this read the
 * telephone's rules and reported that the row is not a row.
 */
function bodyOf(selector: string): string {
  const at = SHEET.lastIndexOf(`${selector} {`)

  expect(at, `${selector} is not in the sheet`).toBeGreaterThan(-1)

  return SHEET.slice(at, SHEET.indexOf('}', at))
}

describe('the row the three filters stand in', () => {
  it('lays them out in a row, names above controls', () => {
    /* Season, then categories, then search (owner, 11.08.2026). */
    const row = bodyOf('.rankings__filters')

    expect(row).toContain('display: flex')
    /* Aligned at the top and not at the foot: each field is a name over a
       control, and aligned at the foot a field with a taller control pushes its
       own name up, so the three names read as three heights. */
    expect(row).toContain('align-items: start')
  })

  it('gives the width that is left to the search, and lets the chips give way', () => {
    /* "Ime, prezime ili članski broj" has to fit inside the box it is written
       in. The chips are as wide as the chips until the row runs out, and then
       they shrink and scroll inside themselves: unshrinkable, ten of them
       pushed the page sideways and the row's own scroll never engaged. */
    expect(bodyOf('.rankings__field--search')).toContain('flex: 1 1')

    const chips = bodyOf('.rankings__field--categories')

    expect(chips).toContain('flex: 0 1 auto')
    expect(chips).toContain('min-inline-size: 0')
  })

  it('lets the chips scroll inside themselves rather than pushing the page', () => {
    /* The other half of the pair: `min-inline-size: 0` lets the field shrink,
       and this is what the shrinking is for. Without it a season with ten
       categories pushes the page sideways at 560px, which is the fault the
       shrinking was written to fix. */
    /* Read out of the rule that declares it, not the last rule of that name:
       the chip row is written twice, once for the row it stands in and once for
       itself, and `bodyOf` answers with the later. */
    const rows = SHEET.slice(SHEET.indexOf('.rankings__categories {'))

    expect(rows.slice(0, rows.indexOf('}'))).toContain('overflow-x: auto')
  })

  it('stands the categories as tall as the controls beside them', () => {
    /* The chips are shorter than a select, so without this they sat between the
       top and the bottom of the row and the three controls shared neither. */
    expect(bodyOf('.rankings__field--categories .rankings__categories')).toContain(
      'min-height: 2.5rem',
    )
  })

  it('puts the gender beside the season on a telephone, and nowhere else', () => {
    /* Under 560px they are one row under the name of the screen (owner,
       11.08.2026); above it the gender belongs with the name of the screen and
       the season with the filters. What lets a grandchild stand in that grid is
       `display: contents` on the row of filters, and that is the whole of the
       mechanism: without it the season cannot leave the row it is written in.

       Read out of the rules that own the declarations rather than out of the
       whole media query: asked of the query as one string, a `display: grid`
       moved to any rule at all inside it still passed, which is a guard that
       holds a word rather than a layout. */
    const container = phoneRule('.rankings--tooled:has(> .rankings__filters)')

    expect(container).toContain('display: grid')
    /* Both tracks bounded at nought, because a track is otherwise at least as
       wide as its content asks for: at 200% text the two gender buttons stopped
       fitting and the page scrolled sideways (WCAG 2.2 SC 1.4.4, 1.4.10). */
    expect(container).toContain('grid-template-columns: minmax(0, auto) minmax(0, 1fr)')
    expect(container).toContain('column-gap')
    /* Both gaps: `display: contents` throws the row's own away with its box, so
       without the second the three rows of filters touch. */
    expect(container).toContain('row-gap')
    /* Aligned at the foot, because the season carries a name above it and the
       gender does not: what makes them one row is that they end together. */
    expect(container).toContain('align-items: end')

    expect(
      phoneRule('.rankings--tooled:has(> .rankings__filters) > .rankings__filters'),
    ).toContain('display: contents')
  })

  it('scopes every one of those rules to this screen', () => {
    /* `rankings--tooled` is eight screens. A rule inside this query that names
       only the shared class is a rule that reaches all eight, and "inert on the
       other seven" is a thing that stays true only until one of them grows a
       row of filters. */
    const phone = SHEET.slice(SHEET.indexOf('@media (max-width: 559.98px)'))
    const query = phone.slice(0, phone.lastIndexOf('}'))
    const loose = [...query.matchAll(/^ {2}(\.[^{]+)\{/gm)]
      .map((one) => must(one[1], 'the selector the match found').trim())
      .filter((one) => !one.includes(':has(> .rankings__filters)'))

    expect(loose).toEqual([])
  })
})
