import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { must } from '../../test/at'

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
 * **Parsed, not searched, and now for both questions.** Four generations of this
 * file were each beaten by the fault they were written for. Reading the text and
 * cutting each rule at the first closing brace passed two rules wrapped in
 * `@media print`, which apply to nothing, and passed `.entity-open:hover`
 * rewritten as `.table .entity-open:hover`, which outweighs the refusal in every
 * administrative table. Reading structure from the parser and importance from a
 * regular expression over the text was then beaten three more ways: a `}` inside
 * a comment cut the body short and silenced the check, a comment above the rule
 * joined the group the selector was compared against, and a copy of the rule
 * inside `@media` counted as a second one.
 *
 * So everything comes from the parser, and the one thing the parser could not
 * answer is asked in a way it can (`shouting` below). A guard that cannot tell a
 * live rule from a dead one is a guard on the spelling, and a guard nobody has
 * broken on purpose is a guess.
 */
const ENTITY_CSS = join(process.cwd(), 'src/pages/admin/Entity.css')

/**
 * A sheet as the browser receives it, with `@import` resolved into it.
 *
 * jsdom fetches nothing, so an imported sheet is a sheet this file cannot see.
 * `Entity.css` imports the shared table, which is where a hover for a control
 * inside a table would most naturally be written, and the fault this file exists
 * for came back once already through exactly such a selector.
 */
function sheetText(path: string): string {
  return readFileSync(path, 'utf-8').replace(/@import\s+'([^']+)'\s*;/g, (_whole, target) =>
    sheetText(resolve(dirname(path), String(target))),
  )
}

const css = sheetText(ENTITY_CSS)

/** Every rule of the sheet that applies unconditionally, with its selector. A
 *  rule inside `@media` or `@supports` is not among them, which is the point. */
function unconditional(text = css): { selector: string; style: CSSStyleDeclaration }[] {
  const tag = document.createElement('style')

  tag.textContent = text
  document.head.append(tag)

  const sheet = tag.sheet

  expect(sheet, 'jsdom did not parse the sheet').not.toBeNull()

  const rules = [...(sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .map((rule) => ({ selector: rule.selectorText, style: rule.style }))

  tag.remove()

  return rules
}

/** The one rule written for exactly this selector, and a failure naming it where
 *  there is none. Read from the unconditional rules, so a rule that has been
 *  moved into a media query is missing rather than found. */
function ruleFor(selector: string, text = css): CSSStyleDeclaration {
  const found = unconditional(text).filter((rule) => rule.selector === selector)

  expect(found.length, `${selector} is not an unconditional rule of the sheet`).toBe(1)

  return must(found[0], `pravilo ${selector}`).style
}

/**
 * Which declarations of a rule shout, asked of the parser like everything else.
 *
 * The obvious way is `getPropertyPriority`, and on this sheet it answers „no" to
 * every colour on this control even when every one of them shouts: jsdom drops a
 * declaration whose value is a `var()` carrying `!important` rather than recording
 * the priority. Measured with a probe, not assumed: `color: red !important` comes
 * back as „important", `background: var(--x) !important` comes back as „".
 *
 * So the sheet is handed over once more with every `var(...)` replaced by a plain
 * colour. What is being read is the priority; the colour is read from the sheet
 * itself, by `ruleFor`, and is not touched here.
 */
function shouting(selector: string, text = css): string[] {
  const style = ruleFor(selector, withoutVars(text))

  return Array.from({ length: style.length }, (_unused, index) => style.item(index)).filter(
    (property) => style.getPropertyPriority(property) === 'important',
  )
}

/** Every `var(...)` of a sheet replaced by a plain colour, innermost first, so a
 *  fallback written as `var(--a, var(--b))` goes too. Each pass is strictly
 *  shorter than the one before it, so this ends. */
function withoutVars(text: string): string {
  let plain = text
  let next = plain.replace(/var\([^()]*\)/g, 'red')

  while (next !== plain) {
    plain = next
    next = plain.replace(/var\([^()]*\)/g, 'red')
  }

  return plain
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
       needs reading, so it fails here and gets read. The count is over the sheet
       with its imports in it, so the third one cannot arrive through the shared
       table either. */
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
       Both sides are asked. The refusal is left ordinary on purpose: a stylesheet
       where both shout is one nobody can reason about, and the tighter selector
       is enough as long as nothing shouts. */
    for (const selector of ['.entity-open:hover', ".entity-open[aria-disabled='true']:hover"]) {
      expect(shouting(selector), `${selector} shouts, and no selector outweighs that`).toEqual([])
    }
  })
})

describe('the guard over that stylesheet', () => {
  /* Written because the guard above is the whole protection for something jsdom
     cannot show, and it has been beaten five times by the fault it was written
     for. Every fault that beat it is a case here, so the sixth way has to be new.
     Broken on purpose: what a guard does on a correct sheet says nothing. */
  const REFUSAL = ".entity-open[aria-disabled='true']:hover { color: var(--text-muted); }"

  function fails(what: () => unknown): boolean {
    try {
      what()

      return false
    } catch {
      return true
    }
  }

  it('hears a shout that carries a var(), which the parser alone does not', () => {
    const shouted = '.entity-open:hover { background: var(--surface-hover) !important; }'

    // The measurement the whole design of `shouting` rests on: asked directly,
    // jsdom answers nothing at all for this declaration.
    expect(ruleFor('.entity-open:hover', shouted).getPropertyPriority('background')).toBe('')
    /* Longhands, because `background` is a shorthand and the parser hands back
       what it expands into. The test above asks for nothing at all, so the shape
       of the list never matters there; here it has to be something. */
    expect(shouting('.entity-open:hover', shouted)).toContain('background-color')
  })

  it('hears it through a comment, a brace inside that comment, and odd spacing', () => {
    /* The three ways the text was read wrong. A `}` in a comment ended the rule
       early and the guard fell silent; a comment above the rule was compared
       against the selector and the rule went missing; `! IMPORTANT` is the same
       word to the cascade and a different string to a search. */
    const awkward = `/* a hover, with a } in the comment */
      .entity-open:hover {
        /* why: because } */
        background: var(--surface-hover) ! IMPORTANT;
      }`

    expect(shouting('.entity-open:hover', awkward)).toContain('background-color')
  })

  it('says nothing shouts where nothing does', () => {
    expect(shouting('.entity-open:hover', '.entity-open:hover { background: var(--x); }')).toEqual(
      [],
    )
  })

  it('does not accept a rule that only applies inside a media query', () => {
    const dead = `@media print { ${REFUSAL} }`

    expect(fails(() => ruleFor(".entity-open[aria-disabled='true']:hover", dead))).toBe(true)
    // And a live copy beside the dead one is one rule, not two.
    expect(ruleFor(".entity-open[aria-disabled='true']:hover", `${dead} ${REFUSAL}`).color).toBe(
      'var(--text-muted)',
    )
  })

  it('reads a rule that arrives through @import, as the browser does', () => {
    /* `Entity.css` imports the shared table, and a hover for a control inside a
       table is exactly what would be written there. Measured against the real
       file: a selector that exists only in the imported sheet is among the rules
       this guard counts. */
    const selectors = unconditional().map((rule) => rule.selector)

    expect(selectors).toContain('.table tbody tr:hover')
    expect(readFileSync(ENTITY_CSS, 'utf-8')).toContain("@import '../../styles/table.css';")
  })
})
