import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* What the stylesheet of the entity screens has to say, read as rules rather
 * than as text.
 *
 * jsdom applies no stylesheet, so every rendered test on these screens sees a
 * control that looks exactly like every other one. The fault this file exists
 * for lived precisely there: a record that may no longer be opened was refused
 * by `aria-disabled` and still carried the pointer and lit up in the accent
 * under the mouse, because the only rules for that attribute in the portal are
 * written for the shared button and this control is not one.
 *
 * **Parsed, not searched.** The first version of this file read the text and cut
 * each rule at the first closing brace, and a review beat it twice over: the two
 * rules wrapped in `@media print`, so they apply to nothing, passed all four
 * tests; and `.entity-open:hover` rewritten as `.table .entity-open:hover`,
 * which outweighs the refusal in every administrative table, passed as well. A
 * guard that cannot tell a live rule from a dead one is a guard on the spelling.
 *
 * So the sheet is handed to the browser jsdom does have, and what comes back is
 * `cssRules`: a rule nested in a media query is a `CSSMediaRule` and not one of
 * these, and a rule added later shows up as another entry to be counted.
 */
const css = readFileSync(join(process.cwd(), 'src/pages/admin/Entity.css'), 'utf-8')

/** Every rule of the sheet that applies unconditionally, with its selector. A
 *  rule inside `@media` or `@supports` is not among them, which is the point. */
function unconditional(): { selector: string; style: CSSStyleDeclaration }[] {
  const tag = document.createElement('style')

  tag.textContent = css
  document.head.append(tag)

  const sheet = tag.sheet

  expect(sheet, 'jsdom did not parse Entity.css').not.toBeNull()

  const rules = [...(sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .map((rule) => ({ selector: rule.selectorText, style: rule.style }))

  tag.remove()

  return rules
}

/** The one rule written for exactly this selector, and a failure naming it where
 *  there is none. Read from the unconditional rules, so a rule that has been
 *  moved into a media query is missing rather than found. */
function ruleFor(selector: string): CSSStyleDeclaration {
  const found = unconditional().filter((rule) => rule.selector === selector)

  expect(found.length, `${selector} is not an unconditional rule of Entity.css`).toBe(1)

  const one = found[0]

  if (one === undefined) {
    throw new Error(`${selector} is not in Entity.css`)
  }

  return one.style
}


/** One rule exactly as it is written, between its brace and the next one.
 *
 * For the single question the parser cannot answer: whether a declaration shouts.
 * jsdom drops a `var()` value that carries `!important` rather than recording the
 * priority, so asking `getPropertyPriority` about these colours always answers
 * „no", including when every one of them shouts. Everything structural is still
 * read from `cssRules`; only this comes from the text. */
function written(selector: string): string {
  const at = css.indexOf(`${selector} {`)

  expect(at, `${selector} is not written in Entity.css`).toBeGreaterThan(-1)

  const open = css.indexOf('{', at)

  return css.slice(open + 1, css.indexOf('}', open))
}

describe('a record that may no longer be opened', () => {
  it('says so with the cursor, not only with an attribute', () => {
    /* The pointer is what a reader with a mouse reads first, and it is the one
       signal that survives on a control kept in the order of focus. */
    expect(ruleFor(".entity-open[aria-disabled='true']").cursor).toBe('not-allowed')
  })

  it('goes quiet rather than dim, so the focus ring keeps its strength', () => {
    /* Colours and never `opacity`, for the reason Home.css gives where the same
       rule is written for the shared button: opacity dims the focus ring with
       everything else, and a refused control is one somebody can still land on
       (WCAG 2.2 SC 1.4.11). */
    const refused = ruleFor(".entity-open[aria-disabled='true']")

    expect(refused.color).toBe('var(--text-muted)')
    expect(refused.borderColor).toBe('var(--border)')
    expect(refused.opacity).toBe('')
  })

  it('does not light up under the mouse, which is what said it was live', () => {
    const hovered = ruleFor(".entity-open[aria-disabled='true']:hover")

    expect(hovered.background).toBe('transparent')
    expect(hovered.borderColor).toBe('var(--border)')
    expect(hovered.color).toBe('var(--text-muted)')
  })

  it('is the last word on what that control does under the mouse', () => {
    /* Specificity is what makes the refusal win, and specificity is exactly what
       the first version of this test claimed to check and did not: it asserted
       that both selectors appear in the file, which says nothing about which one
       wins. A review then outweighed the refusal with `.table .entity-open:hover`
       and every test passed.
     *
       Counted instead of computed. Two rules in this sheet say what
       `.entity-open` does under the mouse, the plain one and the refusal, and the
       refusal is written more tightly than the plain one. A third would be
       somebody adding a hover somewhere in between, which is the change that
       needs reading, so it fails here and gets read. */
    const hovers = unconditional().filter(
      (rule) => rule.selector.includes('.entity-open') && rule.selector.includes(':hover'),
    )

    expect(hovers.map((rule) => rule.selector)).toEqual([
      ".entity-open[aria-disabled='true']:hover",
      '.entity-open:hover',
    ])
  })

  it('is not beaten by a plain hover shouting over it', () => {
    /* Specificity is one axis and `!important` is another, and the count above
       reads only the first. An author's `!important` beats an author's ordinary
       declaration whatever the selectors weigh, so three words added to the plain
       hover put the accent back on a control that refuses every press, and the
       count would not have moved: a review measured exactly that, and all four
       tests stayed green.
     *
       **Read from the text, and only this one thing is.** The obvious way to ask
       is `getPropertyPriority`, and it cannot answer here: jsdom drops a
       declaration whose value is a `var()` carrying `!important`, so it reports
       no priority for a rule that shouts every colour on this control. Measured,
       not assumed. The parser stays in charge of everything it does know, which
       is whether a rule is live and which rules there are; this one question goes
       to the source, where three words are three words.
     *
       Both sides are asked. The refusal is left ordinary on purpose: a stylesheet
       where both shout is one nobody can reason about, and the tighter selector
       is enough as long as nothing shouts. */
    for (const selector of ['.entity-open:hover', ".entity-open[aria-disabled='true']:hover"]) {
      expect(written(selector), `${selector} shouts, and no selector outweighs that`).not.toContain(
        '!important',
      )
    }
  })
})
