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

  it('lets the categories give way rather than push the row, and draws them with the segmented control', () => {
    /* The categories are `components/Segmented` (owner, 21.11.2026), as wide as its buttons ask and from the left,
       wrapping where the room runs out. The field may go below the width its content asks for, which is what lets
       the wrapping happen; the old chip row scrolled inside itself, and nothing here does. */
    const field = bodyOf('.rankings__field--categories')

    expect(field).toContain('flex: 0 1 auto')
    expect(field).toContain('min-inline-size: 0')
    expect(SHEET).not.toContain('.rankings__categories')
    expect(SHEET).not.toContain('.rankings__category')
    expect(readFileSync(join(process.cwd(), 'src/components/Segmented.css'), 'utf-8')).toMatch(
      /\.seg--fit \{\s*inline-size: fit-content;\s*max-inline-size: 100%;/,
    )
  })
})
