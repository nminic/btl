import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../../test/at'

/**
 * What the refusal on the entity screens declares, and nothing about who wins.
 *
 * jsdom applies no stylesheet, so every rendered test on these screens sees a control
 * that looks exactly like every other one. The fault this file was written for lived
 * there: a record that may no longer be opened was refused by `aria-disabled` and
 * still carried the pointer and lit up in the accent under the mouse, because the
 * only rules for that attribute in the portal are written for the shared button and
 * this control is not one.
 *
 * **Nine rounds of review, twenty-five high findings, and the lesson is about the
 * question rather than the answers.** Every version of this file tried to decide
 * whether the refusal *wins*, and each was right about the axis it knew and blind to
 * the next: comments and `@media print` in the text; nesting, which jsdom drops and
 * Vite ships; another file, capitals, an attribute selector, an escaped letter; a
 * rule with no `:hover` at all; weight taken from the wrong part of a group;
 * `:active` and `:focus`; the resting state; shorthands and longhands;
 * pseudo-elements; layers; a custom property redefined on an ancestor; `all: revert`;
 * a shout added to a rule already permitted; an at-statement inside a block hiding
 * everything after it; and, unanswerable in principle, an inline style, which no
 * stylesheet can outweigh and which left the whole suite green.
 *
 * **Who wins is a question for a browser, and it is not asked here.** The ninth review
 * measured it in headless Chrome, which is the only oracle that is not another
 * reimplementation of the cascade. Until such a check exists in this repo, the
 * appearance of the refused control is verified on QA by looking at it, and this file
 * does not pretend otherwise.
 *
 * **What is left is what jsdom can answer exactly:** that the refusal is written, that
 * it applies unconditionally, and that it declares what it is meant to declare. That
 * is worth keeping, because it is what was missing on the day the fault shipped:
 * there was no such rule at all.
 */
const css = readFileSync(join(process.cwd(), 'src/pages/admin/Entity.css'), 'utf-8')

/** Every rule of the sheet that applies unconditionally, with its selector. A rule
 *  inside `@media` or `@supports` is not among them, which is the point: a refusal
 *  that stops at a screen width is not a refusal. */
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
 *  there is none. */
function ruleFor(selector: string): CSSStyleDeclaration {
  const found = unconditional().filter((rule) => rule.selector === selector)

  expect(found.length, `${selector} is not an unconditional rule of Entity.css`).toBe(1)

  return must(found[0], `the rule ${selector}`).style
}

describe('a record that may no longer be opened', () => {
  it('says so with the cursor, not only with an attribute', () => {
    /* The pointer is what a reader with a mouse reads first, and it is the one signal
       that survives on a control kept in the order of focus. */
    expect(ruleFor(".entity-open[aria-disabled='true']").cursor).toBe('not-allowed')
  })

  it('goes quiet rather than dim, so the focus ring keeps its strength', () => {
    /* Colours and never `opacity`, for the reason Home.css gives where the same rule
       is written for the shared button: opacity dims the focus ring with everything
       else, and a refused control is one somebody can still land on (WCAG 2.2 SC
       1.4.11). */
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

  it('is written more tightly than the plain hover it has to beat', () => {
    /* Not a claim about the cascade, which this file no longer makes: only that both
       rules exist, that both apply unconditionally, and that the refusal names the
       attribute the plain hover does not. Whether it wins is checked in a browser. */
    const hovers = unconditional()
      .map((rule) => rule.selector)
      .filter((selector) => selector.includes('.entity-open') && selector.includes(':hover'))

    expect(hovers).toEqual([".entity-open[aria-disabled='true']:hover", '.entity-open:hover'])
  })

  it('says out loud what it does not guarantee', () => {
    /* A guard believed to cover more than it does is worse than none, and this one was
       believed for nine rounds. The sentence is in the file, and this test is what
       keeps it there. */
    const guard = readFileSync(join(process.cwd(), 'src/pages/admin/entityStyle.test.ts'), 'utf-8')

    expect(guard).toContain('Who wins is a question for a browser, and it is not asked here')
  })
})
