import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { must } from './at'
import { bare } from './sources'

/**
 * Reading a rule out of a stylesheet, for the guards that hold a declaration
 * jsdom cannot compute.
 *
 * Lifted out of `styles/goldBand.test.ts` on 22.08.2026, unchanged. It was
 * written there after a measured incident and carries its own tests; a second
 * guard then wrote the idea again from memory, without the part the incident had
 * taught (`indexOf` on a selector matches the end of a longer one), and a rule
 * renamed to `.section-body__signoff-wide` with a `.section-body__signoff`
 * stub left behind passed while the page laid out wrong. One home, one reader.
 *
 * `expect` is used inside `bodyOf`, so this belongs to the test tree and nowhere
 * near what ships.
 *
 * **Its tests are in `styles/goldBand.test.ts`**, in the block „reading a rule
 * out of a stylesheet", and they stayed there when the readers moved: they are
 * written against stylesheets typed inside that file, and every awkward shape
 * they try is a shape one of those guards met. The house habit in `src/test/` is
 * a helper with its test beside it (`at.ts`, `at.test.ts`), so somebody looking
 * for `stylesheet.test.ts` and not finding one would conclude this is unmeasured.
 * It is not.
 */
/**
 * A copy of the stylesheet with the inside of every comment blanked out, and the
 * same length as what went in, so a position in it is a position in the original.
 *
 * Only the braces are being counted, and a brace written in prose is not one.
 * None of these sheets has one today; the rules read here are held by a comment
 * apiece explaining why they exist, so one is a matter of time.
 *
 * A brace inside a string or a `url()` is still counted, and none of the sheets
 * has one of those either. It is the direction that matters if one arrives: a
 * closing brace in a string closes a block that is still open, and a rule truly
 * nested inside another then passes for its own without a word. An opening one
 * refuses every rule below it in the file, which at least says so.
 */
export function unremarked(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
}

/**
 * Where the block that opens at `at` is closed.
 *
 * Counted rather than found. A search for the first `}` after a media query is
 * a search for the end of the first rule inside it, and a search for one at the
 * start of a line is a search for a particular way of laying out a stylesheet:
 * indent the closing brace of the query and everything after the query reads as
 * being inside it, which is the whole of what a containment check is for.
 * Nothing in this project formats CSS, so nothing keeps that indentation either.
 */
export function closes(css: string, at: number): number {
  const plain = unremarked(css)
  let depth = 0

  for (let index = at; index < plain.length; index += 1) {
    const mark = plain[index]

    if (mark === '{') {
      depth += 1
    } else if (mark === '}') {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }
  }

  throw new Error(`the block at ${at} is never closed`)
}

/**
 * Where that selector begins a rule of its own, and -1 where it does not.
 *
 * It has to be the whole of a selector and not the tail of a longer one.
 * `.table__hide-phone` is written inside `.rankings .table__hide-phone`, so a
 * plain search finds the second and reports a rule that drops columns on one
 * screen as one that drops them everywhere: scoped down that way, the whole
 * suite stayed green while the board of best races showed all eight of its
 * columns at 360px and scrolled 211 pixels sideways inside its own card, which
 * is what PDL P12 forbids.
 *
 * So what stands in front of the match is read. A newline, a comma or a brace
 * put the selector where it is; anything else is part of it, a space included,
 * because a space between two selectors is a combinator and not a gap.
 *
 * And what stands above it. A selector nested inside another rule is preceded by
 * a newline like any other, so nothing in front of it says that it draws only
 * where the rule around it draws; `.colchart__bar` nested in `.colchart__track`
 * would answer for the real one and hold a height nobody uses. An at-rule around
 * it is a different matter, and the reason this cannot simply refuse depth: four
 * of the rules read here live inside a media query, and refusing depth outright
 * would take those four guards with it.
 */
export function ruleAt(css: string, selector: string): number {
  const plain = unremarked(css)
  const written = `${selector} {`

  for (let at = plain.indexOf(written); at > -1; at = plain.indexOf(written, at + 1)) {
    let before = at - 1

    /* Back over the indentation, to whatever put the selector on its line. */
    while (plain[before] === ' ' || plain[before] === '\t') {
      before -= 1
    }

    const mark = plain[before]
    const begins = mark === undefined || mark === '\n' || mark === ',' || mark === '{' || mark === '}'

    if (begins && underAtRulesOnly(plain.slice(0, at))) {
      return at
    }
  }

  return -1
}

/**
 * Whether every block still open at the end of that text was opened by an
 * at-rule, `@media` and its kind, rather than by a rule of its own.
 *
 * What opened a block is whatever was written between the brace and the
 * punctuation before it, which is the block's prelude.
 */
function underAtRulesOnly(before: string): boolean {
  const open: string[] = []
  let prelude = ''

  for (const mark of before) {
    if (mark === '{') {
      open.push(prelude.trim())
      prelude = ''
    } else if (mark === '}') {
      open.pop()
      prelude = ''
    } else if (mark === ';') {
      prelude = ''
    } else {
      prelude += mark
    }
  }

  return open.every((one) => one.startsWith('@'))
}

/** The body of one rule, from its selector to the brace that closes it. */
export function bodyOf(css: string, selector: string): string {
  const at = ruleAt(css, selector)

  expect(at, `${selector} is not a rule of its own in the stylesheet`).toBeGreaterThan(-1)
  return css.slice(at, closes(css, at))
}

/**
 * Every rule of a sheet that applies **unconditionally**, with its selector.
 *
 * Read through the browser's own parser and not as text: a sheet handed to a
 * `<style>` element answers `sheet.cssRules`, and a rule inside `@media` or
 * `@supports` is not among the top level ones. That is the whole difference. Read
 * as text, a rule wrapped in `@media print` is still there to be found, while on
 * a screen it no longer applies — a review measured exactly that on `Entity.css`
 * on 17.08.2026, with four guards staying green over two dead rules, and it is
 * written down as ADL A18: **ask the parser about structure, ask the text only
 * whether a declaration shouts.**
 *
 * The text readers above are the exception that proves it. They exist for
 * `goldBand.test.ts`, which does arithmetic on custom properties jsdom does not
 * compute at all, and they say so where they are used. Anything asking „does this
 * rule apply" belongs here instead.
 */
export function unconditionalRules(css: string, named: string): CSSStyleRule[] {
  const tag = document.createElement('style')

  tag.textContent = css
  document.head.append(tag)

  const sheet = tag.sheet

  expect(sheet, `jsdom did not parse ${named}`).not.toBeNull()

  const rules = [...(sheet?.cssRules ?? [])].filter(
    (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
  )

  tag.remove()

  return rules
}

/**
 * EVERY RULE OF A SHEET, wherever it is written: at the top, inside a query, inside a
 * query inside a query.
 *
 * `unconditionalRules` and `rulesInMedia` each answer „is this one rule written where I
 * think it is", which is the question a guard over one declaration asks. This answers
 * the opposite one: „is there anywhere else in this sheet that says something about
 * this", which is what a guard over a cascade has to ask, since a rule of greater weight
 * written anywhere beats the one being held no matter which query it is in.
 *
 * Read through jsdom's own parser and not by cutting the text, for the reason `ADL.md`
 * A18 gives: a tail of a longer selector reads the same as the selector, and a rule cut
 * at the first closing brace says nothing about what it is nested in.
 */
export function everyRule(css: string, named: string): CSSStyleRule[] {
  const tag = document.createElement('style')

  tag.textContent = css
  document.head.append(tag)

  const sheet = tag.sheet

  expect(sheet, `jsdom did not parse ${named}`).not.toBeNull()

  const gather = (rules: CSSRule[]): CSSStyleRule[] =>
    rules.flatMap((rule) =>
      rule instanceof CSSStyleRule
        ? [rule]
        : rule instanceof CSSGroupingRule
          ? gather([...rule.cssRules])
          : [],
    )

  const found = gather([...(sheet?.cssRules ?? [])])

  tag.remove()

  return found
}

/**
 * Every rule of one media query, read the way a browser reads it.
 *
 * `unconditionalRules` above deliberately refuses these, because a rule wrapped in
 * `@media print` is a rule that does not apply and a guard over the text of a sheet
 * cannot tell the two apart (ADL A18). Some rules, though, are meant to be
 * conditional: a table that is given equal columns only where every column is drawn
 * says so in a query, and holding it means naming the query it is in.
 *
 * The condition is matched as written, so a rule moved into another query fails
 * here rather than being found under a condition nobody asked about.
 */
export function rulesInMedia(css: string, condition: string, named: string): CSSStyleRule[] {
  const tag = document.createElement('style')

  tag.textContent = css
  document.head.append(tag)

  const sheet = tag.sheet

  expect(sheet, `jsdom did not parse ${named}`).not.toBeNull()

  const found = [...(sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
    .filter((rule) => rule.conditionText === condition)
    .flatMap((rule) => [...rule.cssRules])
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)

  tag.remove()

  return found
}

/** The one rule of one media query written for exactly this selector. */
export function ruleInMedia(
  css: string,
  condition: string,
  selector: string,
  named: string,
): CSSStyleDeclaration {
  const found = rulesInMedia(css, condition, named).filter(
    (rule) => rule.selectorText === selector,
  )

  expect(found.length, `${selector} is not one rule of ${condition} in ${named}`).toBe(1)

  return must(found[0], `the rule ${selector}`).style
}

/** The one unconditional rule written for exactly this selector, and a failure
 *  naming it where there is none or more than one. */
export function ruleFor(css: string, selector: string, named: string): CSSStyleDeclaration {
  const found = unconditionalRules(css, named).filter((rule) => rule.selectorText === selector)

  expect(found.length, `${selector} is not one unconditional rule of ${named}`).toBe(1)

  return must(found[0], `the rule ${selector}`).style
}

/* Everything below reads what a file asks for rather than what it declares, and
 * is here rather than in one test because two of them now need it: the sheet of
 * tables, and the sheet that styles a link out of the portal. A closure written
 * twice is a closure that can be tightened once.
 *
 * `bare` used to live here and now lives beside the sweeps in `sources.ts`, which
 * is where a third reader of it turned up (`data/contract.test.ts`). */

/**
 * What a file asks for by name: `import './Member.css'` in a component,
 * `@import 'Rankings.css'` in a stylesheet. One expression for both, since a
 * component never writes the second and a stylesheet never writes the first.
 *
 * Comments are blanked first. This portal explains its imports at least as often
 * as it writes them, and the note above one of them names the file it is about.
 */
export function asks(text: string): string[] {
  return [...bare(text).matchAll(/@?import\s+[\w{},*\s]*(?:from\s+)?(?:url\()?['"][^'"]+\.css[^'"]*['"]/g)].map(
    (one) =>
      /* The name without the quotes around it or the query after it, cut from
         the whole match rather than caught in a group. A group is
         `string | undefined` under `noUncheckedIndexedAccess` (ADL A14), and the
         `?? ''` that would settle it is a branch nothing can reach.

         The forms around the name are wider than what this portal writes today,
         on purpose: `@import url(…)` is plain CSS, `?inline` and `?raw` are
         ordinary Vite, and `import sheet from './x.css'` is ordinary TypeScript.
         Unmatched, each of them would be reported as a component asking for
         nothing, which is a failure saying the opposite of what is true. */
      one[0].slice(one[0].search(/['"]/) + 1, -1).replace(/\?.*$/, ''),
  )
}

/**
 * Every stylesheet a file ends up with: the ones it asks for, and the ones those
 * ask for in turn.
 *
 * Whole paths, so a sheet reached two ways is one entry and a cycle is not a
 * loop. `Profile.css` is both: it asks for `Rankings.css` and for `table.css`,
 * and `Rankings.css` has already brought `table.css` by the time it is asked.
 */
export function sheetsOf(at: string, code: string, seen = new Set<string>()): Set<string> {
  for (const name of asks(code)) {
    const sheet = resolve(dirname(at), name)

    if (!seen.has(sheet)) {
      seen.add(sheet)
      sheetsOf(sheet, readFileSync(sheet, 'utf-8'), seen)
    }
  }

  return seen
}

/**
 * WHAT EVERY `overflow` DECLARATION IN A SHEET DOES TO WHAT IS INSIDE THE BOX.
 *
 * **Written 22.09.2026 after a cut that nothing on the portal could see.** The month of
 * the calendar was given `overflow-x: clip` to bound the name of a multi-day bar, and at
 * 1440px on 200% text that took eight day boxes off the screen, every Sunday of the
 * month whole, with **no scrollbar anywhere** and nothing saying a day was missing
 * (`pages/Calendar.css`). `ADL.md` A26 names that shape: „Strana se ne pomera, pa nista
 * na ekranu ne kaze da je nesto odseceno."
 *
 * The guard that should have caught it read `overflow\s*:\s*hidden` out of a pattern
 * typed by hand, so a spelling nobody had thought of went straight through it
 * (`styles/scale.test.ts`). **A list of the ways to cut a box is not a list anybody can
 * finish by thinking about it**, which is a lesson this portal has paid for more than
 * once, so a longer list is not what holds this. What holds it is that **every value any
 * sheet actually writes has to be classified here**, and one that is not fails the guard
 * that asks instead of passing it.
 *
 * So the two maps below are small and closed on purpose. They are not „the overflow
 * values the portal happens to use"; they are what these CSS keywords mean, and the
 * floor is `known`.
 */
const OVERFLOW_PROPERTIES = new Map([
  /* The three that decide whether a box cuts what sticks out of it. */
  ['overflow', true],
  ['overflow-x', true],
  ['overflow-y', true],
  /* And the two of the same family that decide nothing of the sort: where a long word
     may be broken, and how far outside the box a cut is made once there is one. */
  ['overflow-wrap', false],
  ['overflow-clip-margin', false],
])

const OVERFLOW_VALUES = new Map([
  /* Nothing is cut. */
  ['visible', false],
  /* Cut, but the box is scrollable and a reader can reach what is outside it, which is
     what `ADL.md` A26 asks of anything that does not fit. */
  ['auto', false],
  ['scroll', false],
  /* Cut with no way back. `hidden` leaves the box scrollable to a script and to nobody
     else; `clip` does not even do that. */
  ['hidden', true],
  ['clip', true],
])

/** One `overflow` declaration of a sheet, and what it does. */
export type Cut = {
  property: string
  value: string
  /** Whether it takes content off the screen with no way to reach it. */
  cuts: boolean
  /** Whether this file has anything to say about it at all. */
  known: boolean
}

/**
 * Every declaration of the `overflow` family in a stylesheet, each classified.
 *
 * Comments are blanked first, here as everywhere in this file: a note explaining why a
 * box is not cut is not a rule that cuts one, and every sheet on this portal explains
 * itself at least as often as it declares anything.
 *
 * The value is read word by word, because `overflow` is a shorthand: `overflow: hidden
 * auto` cuts in one direction and scrolls in the other, and a reading of the whole
 * string would call that a spelling nobody has classified.
 */
export function cutsIn(css: string): Cut[] {
  return [...unremarked(css).matchAll(/(?<![-\w])(overflow[a-z-]*)\s*:\s*([^;{}]+);/g)].map(
    (one) => {
      const property = one[1] ?? ''
      const value = (one[2] ?? '').replace('!important', '').trim()
      const words = value.split(/\s+/)
      const decides = OVERFLOW_PROPERTIES.get(property) === true

      return {
        property,
        value,
        cuts: decides && words.some((word) => OVERFLOW_VALUES.get(word) === true),
        known: OVERFLOW_PROPERTIES.has(property) && (!decides || words.every((word) => OVERFLOW_VALUES.has(word))),
      }
    },
  )
}
