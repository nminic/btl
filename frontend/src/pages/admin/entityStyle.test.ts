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
 * **Six generations of this file were each beaten by the fault it was written
 * for.** Reading the text and cutting each rule at the first closing brace passed
 * two rules wrapped in `@media print`, which apply to nothing, and passed
 * `.entity-open:hover` rewritten as `.table .entity-open:hover`, which outweighs
 * the refusal in every administrative table. Reading structure from the parser and
 * importance from a loose search over the raw file was beaten three more ways: a
 * `}` inside a comment cut the body short, a comment above the rule joined the
 * group compared against the selector, and a copy of the rule inside `@media`
 * counted as a second one. Then the same rule written as `& .entity-open:hover`
 * nested inside `.table { … }` passed everything, because jsdom does not
 * understand nesting and Vite lowers it into a plain descendant selector, so the
 * fault shipped.
 *
 * **What this one does.** Structure comes from the parser: which rules there are,
 * which of them apply unconditionally, and how many say the same thing. Importance
 * comes from an exact scan of the sheet, and it can be exact because the sheet is
 * refused unless it is flat (`refuseNesting`) and the scan then works with the
 * comments removed, the at-rule blocks stepped over and the strings respected.
 * The parser is not asked about importance at all, because it cannot answer: it
 * drops the priority of a declaration whose value is a `var()`, and it drops it
 * again for a `background` shorthand whatever the value. Both measured.
 *
 * A guard that cannot tell a live rule from a dead one is a guard on the spelling,
 * and a guard nobody has broken on purpose is a guess. So every one of the six
 * ways above is a case in `describe('the guard over that stylesheet')`.
 */
const ENTITY_CSS = join(process.cwd(), 'src/pages/admin/Entity.css')

/**
 * A sheet as the browser receives it, with `@import` resolved into it.
 *
 * jsdom fetches nothing, so an imported sheet is a sheet this file cannot see.
 * `Entity.css` imports the shared table, which is where a hover for a control
 * inside a table would most naturally be written, and the fault this file exists
 * for came back once already through exactly such a selector.
 *
 * All three ways CSS spells an import, not only the one this repo happens to use
 * today: written for `'…'` alone, the other two left the import sitting in the
 * text, the sheet around it parsed perfectly well, and the imported rules simply
 * did not exist here. Nothing enforces the quoting style, so the only thing
 * holding it was habit.
 */
function sheetText(path: string): string {
  return readFileSync(path, 'utf-8').replace(
    /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;/g,
    (_whole, target) => sheetText(resolve(dirname(path), String(target))),
  )
}

/** The sheet with its comments gone, which is where two of the six faults lived:
 *  a `}` inside a comment ended a rule early, and a comment above a rule joined
 *  the selector in front of it. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Refuses a sheet written in a way the parser here cannot see.
 *
 * jsdom does not understand CSS nesting: a hover written as `& .entity-open:hover`
 * inside `.table { … }` disappears without a trace, so the parser answers with
 * `.table` alone and every count in this file goes on being right about a sheet
 * that no longer says what it used to. Vite lowers that nesting into a plain
 * descendant selector, so the rule reaches the browser and applies. A review
 * measured exactly that: the accent back on a refused control in every
 * administrative table, whole suite green.
 *
 * Nesting is not guessed at, it is refused. `@media`, `@supports` and `@layer`
 * already fail loudly of their own accord, because a rule inside them is not a
 * `CSSStyleRule`; this is the same answer for the one form that was silent.
 */
function refuseNesting(text: string): void {
  const plain = withoutComments(text)
  let depth = 0
  let inAtRule = false

  for (const [index, letter] of [...plain].entries()) {
    if (letter === '{') {
      if (depth === 1 && !inAtRule) {
        throw new Error(
          `nested CSS at character ${index}: this guard reads the sheet through jsdom, which drops a nested rule, so it cannot answer for a sheet written this way`,
        )
      }

      if (depth === 0) {
        inAtRule = /@[a-z-]+[^{}]*$/i.test(plain.slice(0, index))
      }

      depth += 1
    } else if (letter === '}') {
      depth -= 1
    }
  }
}

/** Every rule of the sheet that applies unconditionally, with its selector. A
 *  rule inside `@media` or `@supports` is not among them, which is the point. */
function unconditional(text = css): { selector: string; style: CSSStyleDeclaration }[] {
  refuseNesting(text)

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
 * The body of every top-level rule of a flat sheet, with its selector.
 *
 * Written by hand because the parser cannot answer the one question below, and it
 * can be exact: the comments are gone, an at-rule block is stepped over rather
 * than entered, a quote is respected so a `}` inside `content: "}"` ends nothing,
 * and the sheet is flat because `refuseNesting` has refused it otherwise.
 */
function flatRules(text: string): { selector: string; body: string }[] {
  const plain = withoutComments(text)
  const rules: { selector: string; body: string }[] = []
  let opened = 0
  let quote = ''
  let depth = 0

  for (const [index, letter] of [...plain].entries()) {
    if (quote !== '') {
      quote = letter === quote ? '' : quote
    } else if (letter === '"' || letter === "'") {
      quote = letter
    } else if (letter === '{') {
      opened = depth === 0 ? index : opened
      depth += 1
    } else if (letter === '}') {
      depth -= 1

      /* An at-rule holds rules and not declarations, so its own body is not one,
         and what is inside it is deliberately not read: it does not apply
         unconditionally, which is what every question here is about. */
      const selector = (plain.slice(0, opened).split(/[{}]/).pop() ?? '').trim()

      if (depth === 0 && !selector.startsWith('@')) {
        rules.push({ selector, body: plain.slice(opened + 1, index) })
      }
    }
  }

  return rules
}

/**
 * Whether any declaration of a rule shouts, read off the sheet as it is written.
 *
 * The parser cannot be asked. It drops the priority of a declaration whose value
 * is a `var()`, which is every colour on this control; handed the same rule with
 * the value replaced by `inherit`, so that nothing could be invalid, it drops the
 * priority of a `background` shorthand as well. Both measured with a probe:
 * `color: var(--x) !important` came back as „", and `background: inherit
 * !important` came back as „" on all nine longhands and on the shorthand.
 *
 * So this one question goes to the text, where three words are three words. It is
 * safe there in a way it was not before: the body comes from `flatRules`, which is
 * exact for a flat sheet, and a sheet that is not flat is refused.
 */
function shouting(selector: string, text = css): boolean {
  const bodies = flatRules(text).filter((rule) => rule.selector === selector)

  /* The same rule the parser sees, and once. Two mechanisms reading one sheet are
     two chances to be right about different things; this ties them together, so a
     selector this scanner cannot find is a failure rather than a quiet „no". */
  expect(bodies.length, `${selector} is not written once in the sheet`).toBe(1)

  /* Read as the cascade reads it: the keyword takes any case, and white space or
     a comment may stand between the bang and the word. */
  return /!\s*important/i.test(must(bodies[0], `telo pravila ${selector}`).body)
}

const css = sheetText(ENTITY_CSS)

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
      expect(shouting(selector), `${selector} shouts, and no selector outweighs that`).toBe(false)
    }
  })
})

describe('the guard over that stylesheet', () => {
  /* Written because the guard above is the whole protection for something jsdom
     cannot show, and it has been beaten six times by the fault it was written for.
     Every one of those six is a case here, so a seventh way has to be new. Broken
     on purpose: what a guard does on a correct sheet says nothing. */
  const REFUSAL = ".entity-open[aria-disabled='true']:hover { color: var(--text-muted); }"

  function fails(what: () => unknown): boolean {
    try {
      what()

      return false
    } catch {
      return true
    }
  }

  it.each([
    ['a colour', 'color: var(--accent) !important'],
    ['a shorthand', 'background: var(--surface-hover) !important'],
    ['a length, where a colour would be nonsense', 'padding: var(--space-4) !important'],
    ['a custom property inside a function', 'background: rgb(var(--channels) / 80%) !important'],
    ['one nested in a fallback', 'color: var(--a, var(--b)) !important'],
    ['odd spacing and shouting in capitals', 'color: var(--accent) ! IMPORTANT'],
  ])('hears a shout in %s', (_case, declaration) => {
    /* Six shapes, because two designs before this one could hear some and not
       others. Asking the parser after replacing each `var(...)` with a colour lost
       the length and the one inside a function: the value became nonsense for the
       property, so the declaration was dropped and the answer came back „silent".
       Replacing the whole value with `inherit` fixed those three and lost the
       `background` shorthand instead, which jsdom strips the priority from whatever
       the value is. Measured, both times. */
    expect(shouting('.entity-open:hover', `.entity-open:hover { ${declaration}; }`)).toBe(true)
  })

  it('says nothing shouts where nothing does', () => {
    expect(shouting('.entity-open:hover', '.entity-open:hover { background: var(--x); }')).toBe(
      false,
    )
  })

  it('is not silenced by a brace in a comment, or misled by one above the rule', () => {
    const awkward = `/* a hover, with a } in the comment */
      .entity-open:hover {
        /* why: because } */
        background: var(--surface-hover) !important;
      }`

    expect(shouting('.entity-open:hover', awkward)).toBe(true)
  })

  it('is not ended early by a brace inside a string', () => {
    const quoted = `.entity-open:hover {
        content: "}";
        color: var(--accent) !important;
      }`

    expect(shouting('.entity-open:hover', quoted)).toBe(true)
  })

  it('refuses a sheet whose rules are nested, rather than reading half of it', () => {
    /* The sixth way, and the only one that was silent. Vite lowers this into
       `.table .entity-open:hover`, so it applies in every administrative table;
       jsdom drops it, so every count here would have gone on passing. */
    const nested = '.table { & .entity-open:hover { background: var(--accent); } }'

    expect(fails(() => unconditional(nested))).toBe(true)
    // And a flat sheet is not refused, so the refusal cannot be „always".
    expect(fails(() => unconditional(REFUSAL))).toBe(false)
    // An at-rule is a second level of braces too, and is not nesting.
    expect(fails(() => unconditional(`@media print { ${REFUSAL} }`))).toBe(false)
  })

  it('does not accept a rule that only applies inside a media query', () => {
    const dead = `@media print { ${REFUSAL} }`

    expect(fails(() => ruleFor(".entity-open[aria-disabled='true']:hover", dead))).toBe(true)
    // And a live copy beside the dead one is one rule, not two.
    expect(ruleFor(".entity-open[aria-disabled='true']:hover", `${dead} ${REFUSAL}`).color).toBe(
      'var(--text-muted)',
    )
    /* Nor is a shout inside a dead rule counted against the live one: what is in an
       at-rule does not apply unconditionally, which is what is being asked. */
    expect(
      shouting(
        '.entity-open:hover',
        '@media print { .entity-open:hover { color: red !important; } } .entity-open:hover { color: var(--x); }',
      ),
    ).toBe(false)
  })

  it.each([
    ['single quotes, as this repo writes them', "@import '../../styles/table.css';"],
    ['double quotes', '@import "../../styles/table.css";'],
    ['url()', '@import url("../../styles/table.css");'],
  ])('resolves an import written with %s', (_case, written) => {
    /* jsdom fetches nothing, so an unresolved import is a sheet this file cannot
       see: the rules are absent and every count passes over less than it thinks.
       Written for one quoting style, the other two were silent. Measured through
       the same resolver, on a sheet whose import is rewritten into each form. */
    const rewritten = readFileSync(ENTITY_CSS, 'utf-8').replace(
      /@import\s+(?:url\(\s*)?['"][^'"]+['"]\s*\)?\s*;/,
      written,
    )
    const resolved = rewritten.replace(
      /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;/g,
      (_whole, target) => sheetText(resolve(dirname(ENTITY_CSS), String(target))),
    )

    expect(unconditional(resolved).map((rule) => rule.selector)).toContain('.table tbody tr:hover')
  })

  it('reads the shared table, which the real sheet imports', () => {
    /* Measured against the real file rather than a fixture: a selector that exists
       only in the imported sheet is among the rules this guard counts. */
    expect(unconditional().map((rule) => rule.selector)).toContain('.table tbody tr:hover')
    expect(readFileSync(ENTITY_CSS, 'utf-8')).toMatch(
      /@import\s+['"]\.\.\/\.\.\/styles\/table\.css['"]/,
    )
  })
})
