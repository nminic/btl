import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { htmlElement, must } from '../test/at'
import { renderAt } from '../test/render'
import { rulesInMedia, unconditionalRules } from '../test/stylesheet'

/**
 * Where the three panels of the header are WRITTEN to stand, and what that is measured from.
 *
 * jsdom applies no stylesheet and computes no layout, so nothing rendered can see where a panel
 * lands. That is where this fault lived: on a telephone the row of tools wraps onto a row of its
 * own against the LEFT edge, and a panel 20rem wide measured from the right edge of a button
 * 110px from that edge began 163px off the screen. Messages, account and language alike, at 360
 * and at 390, and at 360 with the text at 200% as well (Chrome, 02.10.2026). Nothing could scroll
 * to what was cut off and the page did not scroll sideways, so the screen said nothing.
 *
 * **What is held here is what the source SAYS, and nothing about which rule wins** (ADL A33).
 * A guard over the text may claim where something is written; the cascade is computed by the
 * browser, and a check that claimed „it comes after every rule of the same weight that could
 * undo it" was knocked over four ways on 29.08.2026: a list of selectors, a media block,
 * `!important`, and a rule in another sheet. So this does not claim that. It holds the four
 * premises that leave the cascade nothing to decide, each as a fact about the source:
 *
 * 1. **one sheet:** everything that puts one of these boxes somewhere is written in
 *    `app/Shell.css`, read off the file system and not off a list (a rule in a sheet this
 *    never heard of is how the last guard of this kind was beaten);
 * 2. **one weight:** every selector that does is a plain class, so no rule is heavier than
 *    another and the order they are written in is what decides;
 * 3. **nothing important:** no such declaration says `!important`;
 * 4. **two places:** each is written either outside any query or in the one narrow query,
 *    and the narrow query is written AFTER the last rule outside it that places the same
 *    boxes, which is an order of lines and not a cascade.
 *
 * And what the query then says, and what stands outside it, is read straight off the rules.
 *
 * **What is NOT held here, said plainly because a guard may claim only what the tool beneath
 * it answers:** where the panel then lands, and which of the rules it ends up under. That is a
 * question for a browser and `scripts/header-panels-geometry.mjs` asks it, by hand and not in
 * the gate, because the browser the owner decided on in ADL A63 (22.09.2026) is not in the
 * package yet. Until it is, this is a guard over a SHAPE: the one `forms/FieldHint.css` found
 * for the same fault in August and `forms/fieldHintStyle.test.ts` holds in the same way. That
 * the shape is the one that keeps a panel on the screen was measured, not argued: fourteen
 * widths from 360 to 1280 on the production build and on the QA build, the inbox with messages,
 * empty, refused by the server and never answered, and 360 at 200% text, where every panel lies
 * whole on the screen. The numbers it was measured at, before and after, are the boundary
 * written in the head of that script, for the browser of ADL A63 to turn into guards one at a
 * time.
 *
 * **Both halves are held, since one without the other is the fault again.** The button's box
 * must not be positioned, or it is what the panel is measured from; and the bar must be, or the
 * panel is measured from the page, whose width is not the bar's on a screen with a scrollbar.
 * Nothing between the two may be positioned either (`.shell__tools` is the one thing that is).
 */
const SRC = join(process.cwd(), 'src')
const SHEET = 'app/Shell.css'
const css = readFileSync(join(SRC, SHEET), 'utf-8')

/** The one width the portal changes this header at: the navigation unfolds above it and the
 *  button that folds it away stops being drawn (`styles/scale.test.ts` holds the list of
 *  widths and says why this is on it). */
const NARROW = '(max-width: 51.24875em)'

/**
 * The three panels of the header: the name of the button that opens each, the box that button
 * stands in, and the panel it opens. One table, read by the questions about the stylesheet and
 * by the question about the markup, so that the class names the one holds are the ones the
 * other finds on the page (a fact with two homes drifts, and a guard over a class nobody wears
 * holds nothing).
 */
const HEADER_PANELS = [
  { button: 'Jezik', box: '.lang', panel: '.lang__menu' },
  { button: 'Otvori nalog', box: '.account', panel: '.account__panel' },
  { button: /^Otvori poruke/, box: '.inbox', panel: '.inbox__panel' },
]

const PANELS = HEADER_PANELS.map((one) => one.panel)
const BUTTONS_BOX = HEADER_PANELS.map((one) => one.box)

/** The width of the gutter on each side of the bar, which is the bar's own `padding-inline`
 *  (`.shell__bar`), written once as a token. */
const GUTTER = 'var(--space-16)'
const WITHIN_THE_BAR = `calc(100% - 2 * ${GUTTER})`

/** What puts a box somewhere, for a panel and for the box its button stands in. */
const PLACING = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'inset-inline',
  'inset-inline-start',
  'inset-inline-end',
  'inset-block',
  'inset-block-start',
  'inset-block-end',
  'width',
  'min-width',
  'max-width',
  'margin',
  'margin-top',
]

/** Everything that stands between a panel and what it is measured from, with what of it
 *  matters: the bar and the row of tools only by whether they are positioned. */
const WATCHED = new Map<string, string[]>([
  ...[...PANELS, ...BUTTONS_BOX].map((one): [string, string[]] => [one, PLACING]),
  ['.shell__bar', ['position']],
  ['.shell__tools', ['position']],
])

type Placement = {
  sheet: string
  selector: string
  property: string
  value: string
  important: boolean
  /** The query the rule is written in, or null where it is written outside any. */
  condition: string | null
  /** Where in the sheet it stands, counted over every rule. */
  order: number
}

/** Every stylesheet under `src`, with its path relative to it: the floor, read off the file
 *  system and not off a list somebody has to remember to extend. */
function stylesheets(dir = SRC, prefix = ''): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const here = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return stylesheets(here, name)
    }

    return entry.name.endsWith('.css') ? [{ path: name, text: readFileSync(here, 'utf-8') }] : []
  })
}

/** Every declaration, in every sheet of the portal, that places one of the boxes watched
 *  above, with where it is written. Read through the browser's own parser and not as text, so
 *  that a rule inside a query is a rule inside a query. */
function placements(): Placement[] {
  const found: Placement[] = []
  let order = 0

  for (const sheet of stylesheets()) {
    const tag = document.createElement('style')

    tag.textContent = sheet.text
    document.head.append(tag)

    const walk = (rules: CSSRule[], condition: string | null) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule) {
          order += 1

          for (const selector of rule.selectorText.split(',').map((part) => part.trim())) {
            /* The class a selector ends in, or the one it names plain: a descendant of one of
               these is not it, and `.account .portrait` places a portrait. */
            const named = selector.match(/\.[\w-]+$/)?.[0] ?? ''
            const properties = WATCHED.get(named) ?? []

            for (const property of properties) {
              if (rule.style.getPropertyValue(property) !== '') {
                found.push({
                  sheet: sheet.path,
                  selector,
                  property,
                  value: rule.style.getPropertyValue(property),
                  important: rule.style.getPropertyPriority(property) === 'important',
                  condition,
                  order,
                })
              }
            }
          }
        } else if (rule instanceof CSSMediaRule) {
          walk([...rule.cssRules], rule.conditionText)
        } else if (rule instanceof CSSGroupingRule) {
          walk([...rule.cssRules], '(another kind of query)')
        }
      }
    }

    walk([...(tag.sheet?.cssRules ?? [])], null)
    tag.remove()
  }

  return found
}

/** What one rule says about a property of a selector, read straight off the rules given:
 *  the value of the last rule among THEM that names the selector, `undefined` where none
 *  does. The rules given are one query or the top of one sheet, so this answers where
 *  something is written and never which of two wins. Read by the parts of a selector, because
 *  two selectors written on two lines are kept with the line break between them. */
function written(rules: CSSStyleRule[], selector: string, property: string): string | undefined {
  return rules
    .filter((rule) => rule.selectorText.split(',').some((one) => one.trim() === selector))
    .map((rule) => rule.style.getPropertyValue(property))
    .filter((value) => value !== '')
    .at(-1)
}

const inTheQuery = (selector: string, property: string) =>
  written(rulesInMedia(css, NARROW, SHEET), selector, property)

const outsideAnyQuery = (selector: string, property: string) =>
  written(unconditionalRules(css, SHEET), selector, property)

describe('what places the three panels of the header, and where it is written', () => {
  it('finds what it is asked about, so that a sheet it cannot read does not pass for one that is right', () => {
    /* Without this every check below passes on an empty list, which is the shape every
       sweeping test fails in. */
    expect(stylesheets().length).toBeGreaterThan(30)
    expect(placements().length).toBeGreaterThan(20)
    expect(inTheQuery('.shell__bar', 'position')).toBe('relative')
    expect(outsideAnyQuery('.shell__bar', 'padding-inline')).toBe(GUTTER)
  })

  it('is written in one sheet, at the weight of one class, and not once important', () => {
    const all = placements()

    /* ONE SHEET. A rule about these boxes anywhere else is a rule this cannot say anything
       about the weight of, and it is how the last guard over a cascade was beaten. */
    expect([...new Set(all.map((one) => one.sheet))]).toEqual([SHEET])

    /* ONE WEIGHT. Every selector that places one of them is a plain class, so none is heavier
       than another and the order of the lines decides. `.shell__tools .inbox` is a rule that
       is heavier than the one in the query without being written after it. */
    expect(all.filter((one) => !/^\.[\w-]+$/.test(one.selector)).map((one) => one.selector)).toEqual([])

    /* NOTHING IMPORTANT, which outranks both of the above. */
    expect(all.filter((one) => one.important).map((one) => `${one.selector} ${one.property}`)).toEqual([])
  })

  it('is written in two places only, and the query is written after the rules it takes over from', () => {
    const all = placements()

    /* TWO PLACES. Outside any query, and in the one narrow query. A third (a query of another
       width, `print`, a `@supports`) is a place the questions below were not asked about. */
    expect([...new Set(all.map((one) => one.condition))].sort()).toEqual([null, NARROW].sort())

    /* AND IN THAT ORDER. What is outside the query is the shape above the width where the
       navigation unfolds, and the query is what replaces it under it, so a rule outside the
       query written AFTER it would undo it, with the same weight, in every width. */
    const lastOutside = Math.max(...all.filter((one) => one.condition === null).map((one) => one.order))
    const firstInside = Math.min(...all.filter((one) => one.condition === NARROW).map((one) => one.order))

    expect(firstInside).toBeGreaterThan(lastOutside)
  })

  it('says, under the width where the navigation unfolds, that they hang from the bar and not from the button', () => {
    /* The bar is the box that cannot leave the page because the page cannot. */
    expect(inTheQuery('.shell__bar', 'position')).toBe('relative')

    /* And the button's own box is not what the panel is measured from, which is the half that
       was missing: `.account`, `.inbox` and `.lang` were `position: relative` and the panel
       was measured from a box 38px wide. */
    for (const box of BUTTONS_BOX) {
      expect(inTheQuery(box, 'position'), `${box} in the narrow query`).toBe('static')
    }

    /* Nothing between the two is positioned either. `.shell__tools` is the row of tools and is
       the box between the button and the bar: given a position, in any query or outside any,
       it is what the panel is measured from again, and it is as wide as its buttons. */
    expect(
      placements()
        .filter((one) => one.selector === '.shell__tools' && one.property === 'position')
        .map((one) => one.condition),
    ).toEqual([])
  })

  it('stand under the button that opened them, against the gutter at the right edge of the bar', () => {
    for (const panel of PANELS) {
      /* The static position is the line under the button; the gap under it is the same step
         the rule outside the query gives it. */
      expect(inTheQuery(panel, 'top'), `${panel} top`).toBe('auto')
      expect(inTheQuery(panel, 'margin-top'), `${panel} margin-top`).toBe('var(--space-8)')

      /* A step of the scale and never a negative one: the offset that was here was `-0.5rem`,
         which pushed the panel half a rem PAST the button it hangs from. */
      expect(inTheQuery(panel, 'right'), `${panel} right`).toBe(GUTTER)
    }
  })

  it('are never pulled past an edge, in any query', () => {
    /* A negative offset on a panel is how it leaves the screen. The scale test refuses a bare
       `-0.5rem`, and this refuses the ones that test cannot read: one behind a `calc`, one in
       a logical spelling. Asked of every declaration that places a panel, in every query. */
    const OFFSETS = ['left', 'right', 'inset', 'inset-inline', 'inset-inline-start', 'inset-inline-end']
    const offsets = placements().filter(
      (one) => PANELS.includes(one.selector) && OFFSETS.includes(one.property),
    )

    expect(offsets.length).toBeGreaterThan(0)
    expect(
      offsets
        /* A minus sign in front of a number, and not the two that open a custom property. */
        .filter((one) => /(?:^|[\s(,])-(?=[\d.])/.test(one.value))
        .map((one) => `${one.selector} ${one.property}: ${one.value}`),
    ).toEqual([])
  })

  it('are as wide as the bar allows and never wider, counted from the bar and not from the window', () => {
    for (const panel of PANELS) {
      /* The width the panels always had, asked for outright: left to `auto` it grows to the
         longest line of the longest subject once the room it is offered is the whole bar,
         which is 736px on a tablet, over the picture at the other end of the row. */
      expect(inTheQuery(panel, 'width'), `${panel} width`).toBe('min-content')
      expect(inTheQuery(panel, 'max-width'), `${panel} max-width`).toBe(WITHIN_THE_BAR)

      /* The least it is allowed is the bar's room too, or the cap above is a cap over a floor
         that is higher: 20rem is 640px at 200% text on a screen 360 wide. */
      const least = must(inTheQuery(panel, 'min-width'), `${panel} min-width`)

      expect(least, `${panel} min-width`).toMatch(
        /^min\([\d.]+rem, calc\(100% - 2 \* var\(--space-16\)\)\)$/,
      )
    }

    /* `100vw` is the window, scrollbar included, and the bar is narrower than it by the
       scrollbar: it is what the width was counted from until now. Asked of every declaration
       that places a panel, in every query. */
    const fromTheWindow = placements()
      .filter((one) => PANELS.includes(one.selector))
      .filter((one) => /\d(?:d|s|l)?v[wi]\b/.test(one.value))

    expect(fromTheWindow.map((one) => `${one.selector} ${one.property}: ${one.value}`)).toEqual([])
  })
})

describe('the markup a panel hangs from', () => {
  it('is the chain the stylesheet is written about, and carries no style of its own', async () => {
    /* The axis the questions above cannot see, and the one that beat the last guard over a
       cascade in this portal (`pages/admin/entityStyle.test.ts`, ADL A33): an inline `style`
       is heavier than any rule in `Shell.css`, so `position: relative` written into the markup
       of the box of a button puts the panel back where it began, off the screen, with every
       case above green. It is answered where jsdom answers it exactly, as a question about an
       attribute and not about a cascade.

       And the chain itself is held, because the stylesheet names a button's box, the row of
       tools and the bar by class: a panel that is not the next thing after its button, in a
       box that is a child of the row of tools, which is a child of the bar, is a panel the
       questions above are asked about and do not apply to. */
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

describe('what stands outside the query, above the width where the navigation unfolds', () => {
  it('hangs from its own button, which is the rule that is right there and is not touched', () => {
    /* The other side of the guard above, and the half a repair of the telephone is tempted to
       take with it: above the query the tools stand in one row at the right, so a panel
       measured from its button with the right edges together lies inside the screen, and a
       panel measured from the bar would stand away from its button. Held so that moving the
       rules in the query out of it, or deleting these, fails here and not on a desktop. */
    for (const box of BUTTONS_BOX) {
      expect(outsideAnyQuery(box, 'position'), `${box} outside the query`).toBe('relative')
    }

    for (const panel of PANELS) {
      expect(outsideAnyQuery(panel, 'position'), `${panel} position`).toBe('absolute')
      /* Written `0` and read back `0px`: the parser gives a zero its unit. */
      expect(outsideAnyQuery(panel, 'right'), `${panel} right`).toMatch(/^0(px)?$/)
    }

    for (const panel of ['.account__panel', '.inbox__panel']) {
      expect(outsideAnyQuery(panel, 'top'), `${panel} top`).toBe('calc(100% + var(--space-8))')
    }
  })
})
