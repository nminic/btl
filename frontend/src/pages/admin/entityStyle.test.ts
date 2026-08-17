import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { screen } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'

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
 * **A seventh way, and it is the one that changes the design.** Everything above
 * asks about `Entity.css` and the sheets it imports, and asks by the spelling of
 * the selector. The cascade is neither. Vite ships every stylesheet under `src` as
 * one, and a review wrote the same fault six ways that all read differently and all
 * applied: in `member/Member.css`, which the price list screen itself imports; as
 * `:HOVER` in capitals; as `[class~='entity-open']`; as `.entity-ope\6E`, an
 * escaped letter; through `@import url(./third.css)` without quotes; and as
 * `.entity-row-actions > button:first-child:hover`, which never names the class at
 * all and outweighs the refusal without shouting. All six passed in silence.
 *
 * **What this one does.** It asks the rendered button, not the file. The screen is
 * rendered on a day when the record is refused, every rule of every stylesheet in
 * the portal is read, and the DOM engine is asked which of them would apply to that
 * button under the mouse (, with the button put into that state). Whatever comes
 * back is then weighed by specificity, and the refusal has to be the last word.
 * Spelling stops mattering, and so does which file the rule was written in.
 *
 * The text is still read for one question the parser cannot answer, whether a
 * declaration shouts, and the sheet is still refused if it is nested, because jsdom
 * drops a nested rule and would then be answering about a sheet it cannot see.
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
  /* Strings are respected while comments are removed, because an opening comment
     mark written inside a string is an ordinary pair of characters and not the start
     of a comment. Written the other way round, one such string ate every rule down
     to the next closing mark and failed this guard over a correct sheet. */
  let out = ''
  let quote = ''
  let index = 0

  while (index < text.length) {
    const letter = text[index] ?? ''

    if (quote !== '') {
      out += letter
      if (letter === '\\') {
        out += text[index + 1] ?? ''
        index += 2
        continue
      }
      quote = letter === quote ? '' : quote
      index += 1
      continue
    }

    if (letter === '"' || letter === "'") {
      quote = letter
      out += letter
      index += 1
      continue
    }

    if (letter === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end === -1 ? text.length : end + 2
      continue
    }

    out += letter
    index += 1
  }

  return out
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

  let skip = false

  for (const [index, letter] of [...plain].entries()) {
    if (skip) {
      skip = false
      continue
    }

    if (quote !== '') {
      /* A quote behind a backslash is an ordinary character, not the end of the
         string. Without this the scanner closed the string on it and swallowed the
         rest of the sheet, which passed in silence. */
      if (letter === '\\') {
        skip = true
        continue
      }
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

  return must(found[0], `rule ${selector}`).style
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
    .filter((rule) => shouts(rule.body))
    .map((rule) => ({ at: rule.at }))
}

/** Whether a rule body shouts. One place, because the same pattern written four
 *  times is four chances for one of them to be written wrong, and one of them was:
 *  an extra backslash made it look for a backslash instead of a space, so a rule
 *  that shouted was reported as quiet. */
function shouts(body: string): boolean {
  return /!\s*important/i.test(withoutStrings(body))
}

/** A rule body with its quoted strings taken out, so `content: "!important"` says
 *  nothing about priority. */
function withoutStrings(body: string): string {
  return body.replace(/"[^"]*"|'[^']*'/g, '')
}

/** Every stylesheet the portal ships, because Vite makes them one and a rule for
 *  this control can be written in any of them. Read straight off the disc: an
 *  import resolved by hand is an import spelt one particular way. */
function everySheet(): { path: string; text: string }[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : entry.name.endsWith('.css')
          ? [join(dir, entry.name)]
          : [],
    )

  return walk(join(process.cwd(), 'src')).map((path) => ({
    path,
    text: readFileSync(path, 'utf-8'),
  }))
}

/** Every style rule of the portal, with the file it lives in. */
function everyRule(): { file: string; at: string; selector: string; body: string }[] {
  return everySheet().flatMap((sheet) =>
    styleRules(sheet.text).map((rule) => ({ file: sheet.path, ...rule })),
  )
}

/**
 * The weight of one selector, as the cascade counts it: ids, then classes and
 * attributes and pseudo-classes, then elements and pseudo-elements.
 *
 * Written out because the whole question of this file is which rule wins, and „both
 * are written in the file" is what the first version claimed to check.
 *
 * The functional pseudo-classes are not counted as one class each, which is what a
 * plain count does and what a review measured as wrong in both directions:
 * `:where()` weighs nothing at all, `:is()`, `:not()` and `:has()` weigh as much as
 * the heaviest thing inside them, so `.a:is(.b, #c)` outweighs a hundred classes
 * while `.a:where(.b)` weighs one.
 */
function specificity(one: string): number {
  let rest = one
  let inner = 0

  /* `:where()` contributes nothing, and the other three contribute their heaviest
     argument. Innermost first, so a nested `:not(:is(...))` is counted once. */
  for (;;) {
    const found = /:(where|is|not|has)\(([^()]*)\)/i.exec(rest)

    if (found === null) {
      break
    }

    const [whole, name = '', argument = ''] = found

    if ((name ?? '').toLowerCase() !== 'where') {
      inner += Math.max(...argument.split(',').map((part) => specificity(part.trim())), 0)
    }

    rest = rest.replace(whole, ' ')
  }

  const ids = (rest.match(/#[\w-]+/g) ?? []).length
  const classes = (rest.match(/\.[\w-]+|\[[^\]]*\]|(?<!:):[\w-]+/g) ?? []).length
  const elements =
    (rest.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length + (rest.match(/::[\w-]+/g) ?? []).length

  return ids * 10000 + classes * 100 + elements + inner
}

/**
 * A selector with its CSS escapes spelt out, so `\\6E` is the letter it stands for.
 *
 * `.entity-ope\\6E:hover` and `.entity-open:hove\\72` are the same selector to a
 * browser and two different strings to a search. A review wrote the second one and
 * it passed everything, because the text `:hover` was not in it.
 */
function unescaped(selector: string): string {
  return selector.replace(/\\([0-9a-f]{1,6})\s?/gi, (_whole, hex) =>
    String.fromCodePoint(Number.parseInt(String(hex), 16)),
  )
}

/** The parts of a group, split where the group really divides: a comma inside
 *  `:is(…)` or inside an attribute value divides nothing. Split on every comma, a
 *  perfectly ordinary rule became half a selector, jsdom refused it, and this file
 *  blamed jsdom. */
function groupParts(selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let head = 0

  for (const [index, letter] of [...selector].entries()) {
    if (quote !== '') {
      quote = letter === quote ? '' : quote
    } else if (letter === '"' || letter === "'") {
      quote = letter
    } else if (letter === '(' || letter === '[') {
      depth += 1
    } else if (letter === ')' || letter === ']') {
      depth -= 1
    } else if (letter === ',' && depth === 0) {
      parts.push(selector.slice(head, index))
      head = index + 1
    }
  }

  parts.push(selector.slice(head))

  return parts.map((one) => one.trim()).filter((one) => one !== '')
}

/**
 * The states in which this control has to keep looking refused.
 *
 * Hovering is not the only one. `:active` is the pointer held down on it, and
 * `:focus` and `:focus-visible` are the keyboard standing on it, which is exactly
 * where a refused control must not look live. A review wrote all three at weight 301
 * and every one of them passed, because only hovering was being modelled.
 */
/* Longest first: written , the alternation matched 
   inside  and left  behind, so that state was silently
   not modelled at all. Measured. */
const LIVE_STATES = /:(focus-visible|focus-within|hover|active|focus)\b/gi

/**
 * The parts of a group that reach this element in any of those states.
 *
 * **The element is put into the state, rather than the state being cut out of the
 * selector.** Deleting the text was a guess about what the state means, and a review
 * beat the guess three ways: `tr:hover .entity-open:hover` lost weight the refusal
 * kept, `:is(:hover)` became `:is()` and matched nothing, and `:hove\\72` was not
 * recognised at all.
 *
 * jsdom holds no state, so the state is modelled: it becomes an attribute, and the
 * attribute is set on the button and on every ancestor, which is who is in that state
 * when the pointer or the focus is on the button. The weight is unchanged by the
 * swap, since an attribute and a pseudo-class weigh the same.
 */
function partsOver(element: Element, selector: string): string[] {
  const marked: Element[] = []

  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    node.setAttribute('data-live', '')
    marked.push(node)
  }

  try {
    return groupParts(unescaped(selector))
      .map((one) => one.replace(LIVE_STATES, '[data-live]'))
      .filter((one) => {
        try {
          return element.matches(withoutPseudoElements(one))
        } catch {
          throw new Error(`a selector jsdom cannot read: ${one}`)
        }
      })
  } finally {
    marked.forEach((node) => node.removeAttribute('data-live'))
  }
}

/**
 * Which rules of the whole portal reach this element while the mouse is over it,
 * each with the weight of the part that reaches it.
 *
 * The DOM engine answers whether a rule applies, not a comparison of text: `:HOVER`,
 * `[class~='…']`, an escaped letter and a selector that never names the class are
 * all one question to `element.matches`, and all four beat a guard written on
 * spelling.
 *
 * **The weight is the reaching part's, not the group's.** A review wrote
 * `.rate__nothing:hover, .table td .entity-open:hover { … }`: the second part reaches
 * this button at 0,3,1 and outweighs the refusal, while the first part is light and
 * was the only one weighed. The whole suite passed and the refused control lit up in
 * every administrative table.
 */
function rulesOver(
  element: Element,
  onlyHover: boolean,
): { file: string; at: string; selector: string; body: string; weight: number }[] {
  return everyRule()
    /* Unescaped first: `:hove\\72` is the same selector to a browser, and asking the raw
       text left it out of every question about the state. */
    .filter((rule) => !onlyHover || new RegExp(LIVE_STATES.source, 'i').test(unescaped(rule.selector)))
    .map((rule) => ({ rule, parts: partsOver(element, rule.selector) }))
    .filter((found) => found.parts.length > 0)
    .map((found) => ({
      ...found.rule,
      weight: Math.max(...found.parts.map((part) => specificity(part))),
    }))
}

/**
 * Which rules reach this element while it is in none of those states.
 *
 * The same substitution, with the attribute set on nobody: `:hover` then matches
 * nothing and `:not(:hover)` matches everything, which is exactly what resting means.
 * Filtered instead by „the selector mentions a state", a rule written
 * `.entity-open:not(:hover)` fell out of both passes and reached the control in the
 * one state nobody was looking at.
 */
function restingRulesOver(element: Element): { file: string; selector: string }[] {
  return everyRule().filter((rule) =>
    groupParts(unescaped(rule.selector))
      .map((one) => one.replace(LIVE_STATES, '[data-live]'))
      .some((one) => {
        try {
          return element.matches(withoutPseudoElements(one))
        } catch {
          return false
        }
      }),
  )
}

/** A selector without its pseudo-element, which the DOM cannot be asked about but
 *  which is drawn on this control all the same: `::after` on a refused button paints
 *  over it. */
function withoutPseudoElements(selector: string): string {
  return selector.replace(/::[\w-]+(\([^()]*\))?/g, '')
}

/** A selector written on one line, so the same rule spread over three lines and
 *  the same rule on one are one entry. */
function tidy(selector: string): string {
  return selector.replace(/\s+/g, ' ').trim()
}

function short(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
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

  it('is the only thing in the portal that reaches this control', async () => {
    /* **Zašto spisak, a ne merenje kaskade.** Sedam krugova recenzije je na ovom
       fajlu našlo sedamnaest visokih nalaza, i svaki je bio nova osa kaskade koju
       merenje nije pokrivalo: stanja (`:hover`, `:active`, `:focus`), mirovanje
       (`:not(:hover)`), težina po delu grupe, `!important`, skraćenice svojstava,
       pseudo-elementi, slojevi, tokeni, i `all: revert`. Svako merenje je bilo
       tačno za osu koju je znalo i slepo za sledeću.
     *
       Kaskadu ovde niko ne može da izračuna tačno, jer je to posao pregledača. Ono
       što se može izračunati tačno jeste **ko uopšte dodiruje ovu kontrolu**. Zato
       je pitanje okrenuto: nijedno pravilo u celom portalu ne sme da stigne do
       odbijene kontrole, osim onih koja su ovde imenovana. Novo pravilo koje je
       dodirne obara ovaj test i mora da bude pročitano, što je jedino što je kroz
       sedam krugova stvarno radilo.
     *
       Pita se i u mirovanju i u svakom stanju u kom kontrola sme da izgleda živa. */
    renderAt('/sr/administracija/cenovnik', 'superadmin', null, undefined, '2026-11-01')

    const refused = await screen.findByRole('button', { name: 'Otvori: Preporuka novog člana' })

    expect(refused).toHaveAttribute('aria-disabled', 'true')

    const reaching = [...rulesOver(refused, false), ...restingRulesOver(refused)]
    const seen = [...new Set(reaching.map((rule) => `${short(rule.file)} ${tidy(rule.selector)}`))].sort()

    /* Everything that touches this control, and nothing else may. The reset and the
       focus ring are the portal's own, written once for every element there is; the
       four `.entity-open` rules are the control itself and its refusal. A new rule
       anywhere in the portal that reaches this button lands here and gets read. */
    expect(seen).toEqual([
      'Entity.css .entity-open',
      'Entity.css .entity-open:hover',
      "Entity.css .entity-open[aria-disabled='true']",
      "Entity.css .entity-open[aria-disabled='true']:hover",
      'index.css *, *::before, *::after',
      'index.css :focus-visible',
    ])
  })

  it('and the same holds where the entity screens draw the same control', () => {
    /* The price list draws this button in a plain cell; the entity screens wrap it
       in a row of actions. A rule written for that wrapper never reaches it here, so
       the same question is asked there too. The class names are read out of the
       component that draws them. */
    const editor = readFileSync(join(process.cwd(), 'src/pages/admin/EntityEditor.tsx'), 'utf-8')
    const wrapper = must(/className="(entity-row-[\w-]+)"/.exec(editor), 'the wrapper of the row actions')[1]
    const opener = must(/className="(entity-open)"/.exec(editor), 'the button that opens a record')[1]
    const table = document.createElement('table')

    table.className = 'table'
    table.innerHTML =
      `<tbody><tr><td><span class="${wrapper}">` +
      `<button class="${opener}" aria-disabled="true">Otvori</button>` +
      '</span></td></tr></tbody>'
    document.body.append(table)

    const refused = must(table.querySelector('.entity-open'), 'the button in the row of actions')
    const reaching = [...rulesOver(refused, false), ...restingRulesOver(refused)]
    const seen = [...new Set(reaching.map((rule) => `${short(rule.file)} ${tidy(rule.selector)}`))].sort()

    /* Everything that touches this control, and nothing else may. The reset and the
       focus ring are the portal's own, written once for every element there is; the
       four `.entity-open` rules are the control itself and its refusal. A new rule
       anywhere in the portal that reaches this button lands here and gets read. */
    expect(seen).toEqual([
      'Entity.css .entity-open',
      'Entity.css .entity-open:hover',
      "Entity.css .entity-open[aria-disabled='true']",
      "Entity.css .entity-open[aria-disabled='true']:hover",
      'index.css *, *::before, *::after',
      'index.css :focus-visible',
    ])

    table.remove()
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

  it('spells out a CSS escape, so the same selector is one selector', () => {
    /* `.entity-ope\\6E` is `.entity-open` to a browser and another string to a search. A
       review wrote the state that way and it walked past every question. */
    expect(unescaped('.entity-ope\\6E:hove\\72')).toBe('.entity-open:hover')
    expect(unescaped('.entity-open:hover')).toBe('.entity-open:hover')
  })

  it('divides a group only where the group really divides', () => {
    /* A comma inside `:is(…)` or inside an attribute value divides nothing. Split on
       every comma, an ordinary rule became half a selector, jsdom refused it, and this
       file blamed jsdom for a selector it reads perfectly well. */
    expect(groupParts('.a:is(.b, .c), .d')).toEqual(['.a:is(.b, .c)', '.d'])
    expect(groupParts('a[href="x,y"], .z')).toEqual(['a[href="x,y"]', '.z'])
    expect(groupParts('.only')).toEqual(['.only'])
  })

  it('puts the ancestors into the state as well, which is who is hovered', () => {
    /* `.table:hover .entity-open` reaches this button when the pointer is on it,
       because hovering the button hovers everything it sits in. Marked only on the
       button itself, that rule was invisible and passed at equal weight. */
    const table = document.createElement('table')

    table.className = 'table'
    table.innerHTML = '<tbody><tr><td><button class="entity-open">Otvori</button></td></tr></tbody>'
    document.body.append(table)

    const button = must(table.querySelector('.entity-open'), 'the button in the table')

    expect(partsOver(button, '.table:hover .entity-open')).toEqual(['.table[data-live] .entity-open'])
    expect(partsOver(button, '.entity-open:focus-visible')).toEqual(['.entity-open[data-live]'])
    // And nothing of the marking is left behind on the document.
    expect(document.querySelectorAll('[data-live]')).toHaveLength(0)

    table.remove()
  })

  it('says nothing shouts where nothing does', () => {
    expect(shouting('.entity-open:hover', '.entity-open:hover { background: var(--x); }')).toEqual(
      [],
    )
  })

  it('does not hear a shout inside a string', () => {
    /* `content: "!important"` shouts nothing, and the question is asked with the
       strings cut out for exactly that reason. Loud on both sides: the rule below
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
