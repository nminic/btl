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
 * Every style rule of a sheet, with the at-rule that guards it where there is one.
 *
 * One scanner, because two of them over one text is two chances to be right about
 * different things, and a review found them disagreeing: one respected quotes and
 * the other did not. This one walks the sheet with the comments gone, respects
 * quotes so a `}` inside `content: "}"` ends nothing, and keeps the prelude of
 * every block it opens, so a rule inside `@media` is reported with that condition
 * beside it rather than thrown away.
 *
 * **Nesting is refused, not guessed at.** jsdom does not understand CSS nesting: a
 * hover written as `& .entity-open:hover` inside `.table { … }` disappears without
 * a trace, while Vite lowers it into a plain descendant selector, so the rule
 * reaches the browser and applies. A review measured that twice: once plainly, and
 * once after switching the scanner off with a `}` inside a string and with
 * `@layer x;`, which has no block and made the next rule look guarded.
 */
function styleRules(text: string): { at: string; selector: string; body: string }[] {
  const plain = withoutComments(text)
  const rules: { at: string; selector: string; body: string }[] = []
  /* What is open right now, innermost last. `at` is the prelude of a block that
     begins with `@`; anything else is a style rule and may not contain a block. */
  const open: { prelude: string; from: number }[] = []
  let quote = ''
  let head = 0

  for (const [index, letter] of [...plain].entries()) {
    if (quote !== '') {
      quote = letter === quote ? '' : quote
      continue
    }

    if (letter === '"' || letter === "'") {
      quote = letter
      continue
    }

    if (letter === ';' && open.length === 0) {
      // An at-rule with no block (`@layer x;`) guards nothing that follows it.
      head = index + 1
      continue
    }

    if (letter === '{') {
      const prelude = plain.slice(head, index).trim()
      const inside = open.at(-1)

      if (inside !== undefined && !inside.prelude.startsWith('@')) {
        throw new Error(
          `nested CSS at character ${index}: this guard reads values through jsdom, which drops a nested rule, so it cannot answer for a sheet written this way`,
        )
      }

      open.push({ prelude, from: index })
      head = index + 1
      continue
    }

    if (letter === '}') {
      const closed = open.pop()

      if (closed !== undefined && !closed.prelude.startsWith('@')) {
        rules.push({
          at: open.map((one) => one.prelude).join(' '),
          selector: closed.prelude,
          body: plain.slice(closed.from + 1, index),
        })
      }

      head = index + 1
    }
  }

  return rules
}

/** Every rule of the sheet that applies unconditionally, with its selector. A
 *  rule inside `@media` or `@supports` is not among them, which is the point. */
function unconditional(text = css): { selector: string; style: CSSStyleDeclaration }[] {
  /* Refuses a nested sheet before the parser is handed anything, and ties the two
     mechanisms together below: what the scanner reads at the top level has to be
     what the parser reads there too. */
  const scanned = styleRules(text)

  const tag = document.createElement('style')

  tag.textContent = text
  document.head.append(tag)

  const sheet = tag.sheet

  expect(sheet, 'jsdom did not parse the sheet').not.toBeNull()

  const rules = [...(sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .map((rule) => ({ selector: rule.selectorText, style: rule.style }))

  tag.remove()

  /* The two mechanisms have to see the same top level. A scanner that walks off
     into a string or past an at-rule would otherwise answer confidently about a
     sheet the browser reads differently, which is how three of the seven ways past
     this guard worked. Compared without spaces, because the parser normalises a
     group of selectors and the scanner does not. */
  const bare = (one: string) => one.replace(/\s+/g, '')

  expect(
    scanned.filter((one) => one.at === '').map((one) => bare(one.selector)).sort(),
    'the scanner and the parser do not see the same unconditional rules',
  ).toEqual(rules.map((one) => bare(one.selector)).sort())

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
 * Whether any declaration for a selector shouts, anywhere in the sheet.
 *
 * The parser cannot be asked. It drops the priority of a declaration whose value is
 * a `var()`, which is every colour on this control; handed the same rule with the
 * value replaced by `inherit`, so that nothing could be invalid, it drops the
 * priority of a `background` shorthand as well. Both measured with a probe.
 *
 * **Anywhere, and that is the correction.** This used to skip the body of every
 * at-rule, on the assumption that a conditional rule cannot do harm. A review put
 * `@media (hover: hover) { .entity-open:hover { background: var(--accent)
 * !important } }` into the sheet and the whole suite passed: on every device with a
 * pointer, which is every device the hover matters on, the refused control lit up in
 * the accent again. A condition does not make a shout quieter, so the condition is
 * reported rather than skipped.
 *
 * Strings are cut out before the question is asked, because `content: "!important"`
 * shouts nothing.
 */
function shouting(selector: string, text = css): { at: string }[] {
  const rules = styleRules(text).filter((rule) => rule.selector === selector)

  expect(rules.length, `${selector} is not written once in the sheet`).toBeGreaterThan(0)

  return rules
    .filter((rule) => /!\s*important/i.test(withoutStrings(rule.body)))
    .map((rule) => ({ at: rule.at }))
}

/** A rule body with its quoted strings taken out, so `content: "!important"` says
 *  nothing about priority. */
function withoutStrings(body: string): string {
  return body.replace(/"[^"]*"|'[^']*'/g, '')
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
    const hovers = styleRules(css).filter(
      (rule) => rule.selector.includes('.entity-open') && rule.selector.includes(':hover'),
    )

    /* Counted off the scanner and not off the parser, so a hover written inside a
       media query is counted too. A review put one inside `@media (hover: hover)`,
       which is the very condition under which a hover exists at all, and the parser
       half of this file did not see it: the whole suite passed while the refused
       control lit up in the accent on every device with a pointer. */
    expect(hovers.map((rule) => `${rule.at}|${rule.selector}`)).toEqual([
      "|.entity-open[aria-disabled='true']:hover",
      '|.entity-open:hover',
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
    expect(shouting('.entity-open:hover', `.entity-open:hover { ${declaration}; }`)).not.toEqual([])
  })

  it('says nothing shouts where nothing does', () => {
    expect(shouting('.entity-open:hover', '.entity-open:hover { background: var(--x); }')).toEqual(
      [],
    )
  })

  it('does not hear a shout inside a string', () => {
    /* `content: "!important"` shouts nothing, and the question is asked with the
       strings cut out for exactly that reason. Glasno na obe strane: the rule below
       carries the word and no priority. */
    expect(shouting('.entity-open:hover', '.entity-open:hover { content: "!important"; }')).toEqual(
      [],
    )
  })

  it('hears a shout that a condition was hiding', () => {
    /* The seventh way past this guard, and the one that shipped: a condition does
       not make a shout quieter. `@media (hover: hover)` is the condition under which
       a hover exists at all, so a shout there reaches every device the refusal
       matters on. Reported with its condition beside it, not skipped. */
    const conditional = `@media (hover: hover) {
        .entity-open:hover { background: var(--accent) !important; }
      }`

    expect(shouting('.entity-open:hover', conditional)).toEqual([{ at: '@media (hover: hover)' }])
  })

  it('is not switched off by a brace in a string, or by an at-rule with no block', () => {
    /* Two ways of turning the nesting refusal off, both measured on the previous
       version: a `}` inside `content` threw the brace count off for the rest of the
       file, and `@layer x;` has no block but made the next rule look guarded by it.
       Both left plain nesting passing in silence. */
    const quoted = `.entity-open::after { content: "}"; }
      .table { & .entity-open:hover { background: var(--accent) !important; } }`
    const layered = `@layer overrides;
      .table { & .entity-open:hover { background: var(--accent) !important; } }`

    expect(fails(() => styleRules(quoted))).toBe(true)
    expect(fails(() => styleRules(layered))).toBe(true)
    // And neither form is refused when the nesting is not there.
    expect(fails(() => styleRules('.entity-open::after { content: "}"; }'))).toBe(false)
    expect(fails(() => styleRules(`@layer overrides;
${REFUSAL}`))).toBe(false)
  })

  it('is not silenced by a brace in a comment, or misled by one above the rule', () => {
    const awkward = `/* a hover, with a } in the comment */
      .entity-open:hover {
        /* why: because } */
        background: var(--surface-hover) !important;
      }`

    expect(shouting('.entity-open:hover', awkward)).not.toEqual([])
  })

  it('is not ended early by a brace inside a string', () => {
    const quoted = `.entity-open:hover {
        content: "}";
        color: var(--accent) !important;
      }`

    expect(shouting('.entity-open:hover', quoted)).not.toEqual([])
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
    /* A shout inside an at-rule is now counted, and named by its condition. It used
       to be skipped, on the assumption that a conditional rule cannot do harm; a
       review put one inside `@media (hover: hover)` and the whole suite passed while
       the refused control lit up on every device with a pointer. Even `@media print`
       is reported: a rule that shouts only on paper is still a rule somebody has to
       read before it stays. */
    expect(
      shouting(
        '.entity-open:hover',
        '@media print { .entity-open:hover { color: red !important; } } .entity-open:hover { color: var(--x); }',
      ),
    ).toEqual([{ at: '@media print' }])
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
