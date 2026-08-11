import { readFileSync } from 'node:fs'
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

  it('gives the width that is left to the search, and none of it to the rest', () => {
    /* "Ime, prezime ili članski broj" has to fit inside the box it is written
       in, and the other two are as wide as what they hold. */
    expect(bodyOf('.rankings__field--search')).toContain('flex: 1 1')
    expect(bodyOf('.rankings__field--categories')).toContain('flex: 0 0 auto')
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
       mechanism: without it the season cannot leave the row it is written in. */
    const phone = SHEET.slice(SHEET.indexOf('@media (max-width: 559.98px)'))
    const upTo = phone.slice(0, phone.indexOf('@media', 1))

    expect(upTo).toContain('display: contents')
    expect(upTo).toContain('grid-template-columns: auto 1fr')
    /* Aligned at the foot here, because the season carries a name above it and
       the gender does not: what makes them one row is that they end together. */
    expect(upTo).toContain('align-items: end')
  })

  it('keeps the heading a box of its own, which display: contents would take away', () => {
    const phone = SHEET.slice(SHEET.indexOf('@media (max-width: 559.98px)'))
    const heading = phone.slice(phone.indexOf('.rankings--tooled > h1 {'))

    expect(heading.slice(0, heading.indexOf('}'))).toContain('display: block')
  })
})
