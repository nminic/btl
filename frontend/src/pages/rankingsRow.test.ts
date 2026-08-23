import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The row the filters stand in, held in the stylesheet where it is decided.
 *
 * jsdom computes no layout, so nothing that renders this screen can say whether
 * two fields are side by side or one under the other. What can be said is
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
 * The last of them, not the first. Three of these selectors were written twice
 * until 23.08.2026, once inside a media query for the telephone and once for
 * every width, and the query stood first in the sheet: asked for the first, this
 * read the telephone's rules and reported that the row is not a row. The query
 * went out with the season, which is the only thing it existed to move, and the
 * last is still the one the browser obeys.
 */
function bodyOf(selector: string): string {
  const at = SHEET.lastIndexOf(`${selector} {`)

  expect(at, `${selector} is not in the sheet`).toBeGreaterThan(-1)

  return SHEET.slice(at, SHEET.indexOf('}', at))
}

describe('the row the filters stand in', () => {
  it('lays them out in a row, names above controls', () => {
    /* The categories alone (owner, 23.08.2026). The season stood in front of
       them from 11.08.2026 and has gone up beside the name of the screen, and
       there was a search box at the end of the row until 31.07.2026. What the
       row is built out of has not changed with either. */
    const row = bodyOf('.rankings__filters')

    expect(row).toContain('display: flex')
    /* Aligned at the top and not at the foot: each field is a name over a
       control, and aligned at the foot a field with a taller control pushes its
       own name up, so the two names read as two heights. */
    expect(row).toContain('align-items: start')
  })

  it('lets the chips give way rather than push the row', () => {
    /* The chips are as wide as the chips until the row runs out, and then they
       shrink and scroll inside themselves: unshrinkable, ten of them pushed the
       page sideways and the row's own scroll never engaged.

       This asked one more thing of a search box that took whatever was left of
       the row, until the box went (owner, 31.07.2026). The rule outlived it by
       a commit, and a review found the pair: a stylesheet block that no element
       on the portal wears, held in place by a test that made it look wanted. A
       guard over something that is not drawn is worse than no guard, because
       whoever comes to tidy the sheet has to delete the test to do it. */
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
       top and the bottom of the row and the two controls shared neither. */
    expect(bodyOf('.rankings__field--categories .rankings__categories')).toContain(
      'min-height: 2.5rem',
    )
  })
})
