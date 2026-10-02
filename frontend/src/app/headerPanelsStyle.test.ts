import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { htmlElement, must } from '../test/at'
import { renderAt } from '../test/render'
import { everyRule, unconditionalRules } from '../test/stylesheet'

/**
 * Where the three panels of the header stand, and what that is measured from.
 *
 * jsdom applies no stylesheet and computes no layout, so nothing rendered can see
 * where a panel lands. That is where this fault lived: on a telephone the row of
 * tools wraps onto a row of its own against the LEFT edge, and a panel 20rem wide
 * measured from the right edge of a button 110px from that edge began 163px off
 * the screen. Messages, account and language alike, at 360 and at 390, and at 360
 * with the text at 200% as well (Chrome, 02.10.2026). Nothing could scroll to what
 * was cut off and the page did not scroll sideways, so the screen said nothing.
 *
 * **What is held here is what the stylesheet SAYS**, and it is read through the
 * browser's own parser and not as text (ADL A18): a rule moved out of its query, or
 * a later rule that puts a button back where it was, passes for the real thing when
 * the file is read as a string. The cascade is worked out the only way a stylesheet
 * can be asked about it without a layout: the rules that apply at a narrow screen,
 * in the order they are written, last one wins.
 *
 * **What is NOT held here, said plainly because a guard may claim only what the
 * tool beneath it answers:** where the panel then lands. That is a question for a
 * browser and `scripts/header-panels-geometry.mjs` asks it, by hand and not in the
 * gate, because the browser the owner decided on in ADL A63 (22.09.2026) is not in
 * the package yet. Until it is, the words below are a guard over a SHAPE: the shape
 * `forms/FieldHint.css` found for the same fault in August, and
 * `forms/fieldHintStyle.test.ts` holds in the same way. That the shape is the one
 * that keeps a panel on the screen was measured, not argued: fourteen widths from 360
 * to 1280 on the production build and on the QA build, the inbox with messages, empty,
 * refused by the server and never answered, and 360 at 200% text, where every panel
 * lies whole on the screen. The numbers it was measured at, before and after, are the
 * boundary written in the head of `scripts/header-panels-geometry.mjs`, for the browser
 * of ADL A63 to turn into guards one at a time.
 *
 * **Both halves are held, since one without the other is the fault again.** The
 * button's box must not be positioned, or it is what the panel is measured from;
 * and the bar must be, or the panel is measured from the page, whose width is not
 * the bar's on a screen with a scrollbar. Nothing between the two may be positioned
 * either (`.shell__tools` is the one thing that is).
 */
const css = readFileSync(join(process.cwd(), 'src/app/Shell.css'), 'utf-8')

/** The one width the portal changes this header at: the navigation unfolds above it
 *  and the button that folds it away stops being drawn (`styles/scale.test.ts` holds
 *  the list of widths and says why this is on it). */
const NARROW = '(max-width: 51.24875em)'

/**
 * The three panels of the header: the name of the button that opens each, the box that button
 * stands in, and the panel it opens. One table, read by the questions about the stylesheet and by
 * the question about the markup, so that the class names the one holds are the ones the other
 * finds on the page (a fact with two homes drifts, and a guard over a class nobody wears holds
 * nothing).
 */
const HEADER_PANELS = [
  { button: 'Jezik', box: '.lang', panel: '.lang__menu' },
  { button: 'Otvori nalog', box: '.account', panel: '.account__panel' },
  { button: /^Otvori poruke/, box: '.inbox', panel: '.inbox__panel' },
]

const PANELS = HEADER_PANELS.map((one) => one.panel)
const BUTTONS_BOX = HEADER_PANELS.map((one) => one.box)

/** The width of the gutter on each side of the bar, which is the bar's own
 *  `padding-inline` (`.shell__bar`), written once as a token. */
const GUTTER = 'var(--space-16)'
const WITHIN_THE_BAR = `calc(100% - 2 * ${GUTTER})`

/** Every rule that applies at a narrow screen, in the order it is written: the ones
 *  outside any query and the ones inside the narrow query, and no others. */
function applyingAtNarrow(): CSSStyleRule[] {
  const tag = document.createElement('style')

  tag.textContent = css
  document.head.append(tag)

  const sheet = tag.sheet

  expect(sheet, 'jsdom did not parse Shell.css').not.toBeNull()

  const rules = [...(sheet?.cssRules ?? [])].flatMap((rule) =>
    rule instanceof CSSStyleRule
      ? [rule]
      : rule instanceof CSSMediaRule && rule.conditionText === NARROW
        ? [...rule.cssRules].filter((inner): inner is CSSStyleRule => inner instanceof CSSStyleRule)
        : [],
  )

  tag.remove()

  return rules
}

/** What the cascade says about one property of one selector among the rules given: the
 *  value of the last rule that names the selector and declares it, and `undefined` where
 *  none does. Equal weight is assumed and is true of every selector below, which are all
 *  one class; a rule of greater weight is a thing this does not see. Read by the parts of
 *  a selector and not by its whole text, because `.account,
.inbox` is kept as it was
 *  written and is not `.account, .inbox`. */
function said(rules: CSSStyleRule[], selector: string, property: string): string | undefined {
  return rules
    .filter((rule) => rule.selectorText.split(',').some((one) => one.trim() === selector))
    .map((rule) => rule.style.getPropertyValue(property))
    .filter((value) => value !== '')
    .at(-1)
}

const atNarrow = (selector: string, property: string) =>
  said(applyingAtNarrow(), selector, property)

const aboveTheQuery = (selector: string, property: string) =>
  said(unconditionalRules(css, 'Shell.css'), selector, property)

describe('the three panels of the header on a narrow screen', () => {
  it('reads the rules it is about, so that a sheet it cannot read does not pass for one that is right', () => {
    /* Without this every check below passes on an empty list, which is the shape
       every sweeping test fails in. */
    expect(applyingAtNarrow().length).toBeGreaterThan(20)
    expect(atNarrow('.shell__bar', 'padding-inline')).toBe(GUTTER)
  })

  it('hang from the bar, and not from the button they open from', () => {
    /* The bar is the box that cannot leave the page because the page cannot. */
    expect(atNarrow('.shell__bar', 'position')).toBe('relative')

    /* And the button's own box is not what the panel is measured from, which is the
       half that was missing: `.account`, `.inbox` and `.lang` were `position: relative`
       and the panel was measured from a box 38px wide. */
    for (const box of BUTTONS_BOX) {
      expect(atNarrow(box, 'position'), `${box} at a narrow screen`).toBe('static')
    }

    /* Nothing between the two is positioned either. `.shell__tools` is the row of
       tools and is the box between the button and the bar: given a position, it is what
       the panel is measured from again, and it is as wide as its buttons. Asked of the
       whole sheet, in every query, and not only at a narrow screen. */
    const tools = everyRule(css, 'Shell.css')
      .filter((rule) => rule.selectorText.split(',').some((one) => one.trim() === '.shell__tools'))
      .map((rule) => rule.style.getPropertyValue('position'))
      .filter((value) => value !== '')

    expect(tools).toEqual([])
  })

  it('stand under the button that opened them, against the gutter at the right edge of the bar', () => {
    for (const panel of PANELS) {
      /* The static position is the line under the button; the gap under it is the
         same step the rule above the query gives it. */
      expect(atNarrow(panel, 'top'), `${panel} top`).toBe('auto')
      expect(atNarrow(panel, 'margin-top'), `${panel} margin-top`).toBe('var(--space-8)')

      /* A step of the scale and never a negative one: the offset that was here was
         `-0.5rem`, which pushed the panel half a rem PAST the button it hangs from. */
      expect(atNarrow(panel, 'right'), `${panel} right`).toBe(GUTTER)
    }
  })

  it('are never pulled past an edge, in any query', () => {
    /* A negative offset on a panel is how it leaves the screen. The scale test
       refuses a bare `-0.5rem`, and this refuses the ones that test cannot read: one
       behind a `calc`, one behind a custom property, one in a logical spelling. Asked
       of every rule that names a panel, in every query. */
    const OFFSETS = ['left', 'right', 'inset', 'inset-inline', 'inset-inline-start', 'inset-inline-end']
    const pulled = everyRule(css, 'Shell.css').flatMap((rule) =>
      rule.selectorText
        .split(',')
        .map((one) => one.trim())
        .filter((one) => PANELS.includes(one))
        .flatMap((one) =>
          OFFSETS.map((property) => `${one} ${property}: ${rule.style.getPropertyValue(property)}`),
        ),
    )

    expect(pulled.filter((line) => /: ?(-|calc\(-|calc\(.*-\d)/.test(line))).toEqual([])
  })

  it('are as wide as the bar allows and never wider, counted from the bar and not from the window', () => {
    for (const panel of PANELS) {
      /* The width the panels always had, asked for outright: left to `auto` it grows to
         the longest line of the longest subject once the room it is offered is the whole
         bar, which is 736px on a tablet, over the picture at the other end of the row. */
      expect(atNarrow(panel, 'width'), `${panel} width`).toBe('min-content')
      expect(atNarrow(panel, 'max-width'), `${panel} max-width`).toBe(WITHIN_THE_BAR)

      /* The least it is allowed is the bar's room too, or the cap above is a cap
         over a floor that is higher: 20rem is 640px at 200% text on a screen 360 wide. */
      const least = must(atNarrow(panel, 'min-width'), `${panel} min-width`)

      expect(least, `${panel} min-width`).toMatch(
        /^min\([\d.]+rem, calc\(100% - 2 \* var\(--space-16\)\)\)$/,
      )
    }

    /* `100vw` is the window, scrollbar included, and the bar is narrower than it by
       the scrollbar: it is what the width was counted from until now. Asked of every
       rule that names a panel, in every query. */
    const fromTheWindow = everyRule(css, 'Shell.css')
      .filter((rule) =>
        rule.selectorText
          .split(',')
          .map((one) => one.trim())
          .some((one) => PANELS.includes(one)),
      )
      .filter((rule) => /v[wi]\b|vw|dvw|svw|lvw/.test(rule.cssText))
      .map((rule) => rule.selectorText)

    expect(fromTheWindow).toEqual([])
  })
})

describe('the markup a panel hangs from', () => {
  it('is the chain the stylesheet is written about, and carries no style of its own', async () => {
    /* The axis the questions above cannot see, and the one that beat the last guard over a
       cascade in this portal (`pages/admin/entityStyle.test.ts`, ADL A33): an inline `style` is
       heavier than any rule in `Shell.css`, so `position: relative` written into the markup of
       the box of a button puts the panel back where it began, off the screen, with every case
       above green. It is answered where jsdom answers it exactly, as a question about an
       attribute and not about a cascade.

       And the chain itself is held, because the stylesheet names a button's box, the row of
       tools and the bar by class: a panel that is not the next thing after its button, in a box
       that is a child of the row of tools, which is a child of the bar, is a panel the questions
       above are asked about and do not apply to. */
    renderAt('/sr', 'competitor', '000007')

    for (const one of HEADER_PANELS) {
      const button = await screen.findByRole('button', { name: one.button })
      const box = htmlElement(button.parentElement)
      const panel = htmlElement(button.nextElementSibling)
      const tools = htmlElement(box.parentElement)
      const bar = htmlElement(tools.parentElement)

      expect(box, `the box of ${String(one.button)}`).toHaveClass(one.box.slice(1))
      expect(panel, `the panel of ${String(one.button)}`).toHaveClass(one.panel.slice(1))
      expect(tools).toHaveClass('shell__tools')
      expect(bar).toHaveClass('shell__bar')

      const styled = [box, panel, tools, bar].filter((found) => found.hasAttribute('style'))

      expect(styled.map((found) => found.className)).toEqual([])
    }
  })
})

describe('the same panels above the width where the navigation unfolds', () => {
  it('hang from their own button, which is the rule that is right there and is not touched', () => {
    /* The other side of the guard above, and the half a repair of the telephone is
       tempted to take with it: above the query the tools stand in one row at the right,
       so a panel measured from its button with the right edges together lies inside the
       screen, and a panel measured from the bar would stand away from its button. Held
       so that moving the rules above out of their query, or deleting these, fails here
       and not on a desktop. */
    for (const box of BUTTONS_BOX) {
      expect(aboveTheQuery(box, 'position'), `${box} above the query`).toBe('relative')
    }

    for (const panel of PANELS) {
      expect(aboveTheQuery(panel, 'position'), `${panel} position`).toBe('absolute')
      /* Written `0` and read back `0px`: the parser gives a zero its unit. */
      expect(aboveTheQuery(panel, 'right'), `${panel} right`).toMatch(/^0(px)?$/)
    }

    for (const panel of ['.account__panel', '.inbox__panel']) {
      expect(aboveTheQuery(panel, 'top'), `${panel} top`).toBe('calc(100% + var(--space-8))')
    }
  })
})
