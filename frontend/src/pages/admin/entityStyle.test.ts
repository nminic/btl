import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* What the stylesheet of the entity screens has to say, read as text.
 *
 * jsdom applies no stylesheet, so every rendered test on these screens sees a
 * control that looks exactly like every other one. The fault this file exists
 * for lived precisely there: a record that may no longer be opened was refused
 * by `aria-disabled` and still carried the pointer and the accent on hover, so
 * it looked like a live control that simply did nothing when pressed. A review
 * measured it on 16.08.2026: the only rules for `[aria-disabled='true']` in the
 * whole portal are written for `.button`, and this control is not one.
 */
const css = readFileSync(join(process.cwd(), 'src/pages/admin/Entity.css'), 'utf-8')

/** What is inside one rule and nothing after it, counted by braces. So a
 *  property named in a later rule cannot be read as belonging to this one. */
function inside(selector: string): string {
  const at = css.indexOf(`${selector} {`)

  expect(at, `${selector} is not in Entity.css`).toBeGreaterThan(-1)

  const open = css.indexOf('{', at)
  const shut = css.indexOf('}', open)

  return css.slice(open + 1, shut)
}

describe('a record that may no longer be opened', () => {
  it('says so with the cursor, not only with an attribute', () => {
    /* The pointer is what a reader with a mouse reads first, and it is the one
       signal that survives on a control kept in the order of focus. */
    expect(inside(".entity-open[aria-disabled='true']")).toContain('cursor: not-allowed')
  })

  it('goes quiet rather than dim, so the focus ring keeps its strength', () => {
    /* Colours and never `opacity`, for the reason Home.css gives where the same
       rule is written for the shared button: opacity dims the focus ring with
       everything else, and a refused control is one somebody can still land on
       (WCAG 2.2 SC 1.4.11). */
    const refused = inside(".entity-open[aria-disabled='true']")

    expect(refused).toContain('color: var(--text-muted)')
    expect(refused).toContain('border-color: var(--border)')
    expect(refused).not.toContain('opacity')
  })

  it('does not light up under the mouse, which is what said it was live', () => {
    /* `.entity-open:hover` paints the accent on the border and the text. Left to
       it, a control that refuses every press answered the mouse as though it
       would take one. */
    const hovered = inside(".entity-open[aria-disabled='true']:hover")

    expect(hovered).toContain('background: transparent')
    expect(hovered).toContain('border-color: var(--border)')
    expect(hovered).toContain('color: var(--text-muted)')
  })

  it('is written more tightly than the rule it has to beat', () => {
    /* Specificity and not order: the attribute selector is one class heavier
       than `.entity-open:hover`, so it wins wherever it stands in the file. Held
       because moving these rules is the kind of tidying that quietly undoes
       them. */
    expect(css.indexOf(".entity-open[aria-disabled='true']")).toBeGreaterThan(-1)
    expect(css).toContain('.entity-open:hover')
  })
})
