import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { htmlElement } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

/**
 * What is WRITTEN about where the three panels of the header stand, and about what that is
 * measured from.
 *
 * jsdom applies no stylesheet and computes no layout, so nothing rendered can see where a panel
 * lands. That is where this fault lived: on a telephone the row of tools wraps onto a row of its
 * own against the LEFT edge, and a panel 20rem wide measured from the right edge of a button
 * 110px from that edge began 163px off the screen. Messages, account and language alike, at 360
 * and at 390, and at 360 with the text at 200% as well (Chrome, 02.10.2026). Nothing could scroll
 * to what was cut off and the page did not scroll sideways, so the screen said nothing.
 *
 * **What is held here is where things are written, and nothing about which rule wins or where a
 * box lands** (ADL A33): the first is a fact about the source, the second and the third are a
 * browser's, and `scripts/header-panels-geometry.mjs` asks the browser, by hand and not in the
 * gate, because the browser the owner decided on in ADL A63 (22.09.2026) is not in the package yet.
 *
 * **The question, and who answers it.** Of the four elements a panel hangs from (the box its button
 * stands in, the row of tools, the bar, and the panel itself), asked in the closed state and in the
 * state a click leaves it in (the box wears `is-open`, focus is inside it, and the pointer is over
 * its button): which rules of which stylesheet REACH it? Asked of the DOM's own `matches`, rule by
 * rule, over every sheet under `src` (the portal's own habit, `forms/formStyle.test.ts`: „asked of
 * what each mark is REACHED by, not of the text of one rule"). That is what takes the question off
 * the spelling of a selector, which is where every earlier draft of this guard was beaten: a rule
 * for `.lang.is-open`, for `.inbox:focus-within`, for `.shell__tools > *` or for `*` reaches an
 * element exactly as a plain class does, and a guard that reads the last class of a selector sees
 * none of them. A rule NESTED in another (`.inbox { &:focus-within { … } }`, or a query nested in a
 * rule) is written against what it stands in, so it is asked as that rule with `&` read as the one
 * it nests in.
 *
 * **What is then held, each as a fact about the source:**
 *
 * 1. Every rule that reaches one of the four and writes a property of that element's family
 *    (below) is a plain class or a list of plain classes, is in `app/Shell.css`, stands outside
 *    any query or in the one narrow query, and is not `!important`.
 * 2. The names those rules write on each element are exactly the ones pinned below. The names and
 *    not the values, so a repaint of a value fails nothing and a property nobody has written
 *    there before fails at once. Where a value alone can take a box away, it is read as well: the
 *    `display` of the row of tools and of the bar.
 * 3. Where a base rule and the narrow query write one name on one element, the query stands after
 *    the base rule: an order of lines, which is not a claim that it wins.
 * 4. What the narrow query says and what stands outside it is read off the same rules by name,
 *    which is exact because of the first fact: every rule that could say otherwise is one of those.
 * 5. In each of those states none of the four carries an inline `style`, which would be heavier
 *    than any rule, whether it is written for the open state only or for both.
 *
 * **The two families, as patterns and not lists.** A list of names is a list of one spelling: the
 * logical `margin-inline-end` is a way to push a panel off the screen that no list of `margin` and
 * `margin-top` has ever heard of. For the three boxes between a panel and the bar the family is
 * what can make one of them the measure of a positioned box, take its box away, or clip what
 * hangs from it: `position`, `display`, `all`, `overflow` and `clip` in every spelling, and the
 * properties that give a box a containing block of its own (`transform` and its three
 * single-property cousins, `perspective`, `filter`, `backdrop-filter`, `contain`, `container-type`,
 * `content-visibility`, `will-change`). For a panel it is what places, sizes or moves it:
 * `position`, `all`, the four offsets and `inset` in every spelling, `margin` in every spelling,
 * width and height and their minimum and maximum, physical and logical, and `transform` with its
 * three single-property cousins (`translate`, `rotate`, `scale`).
 *
 * **What is NOT held here, said plainly because a guard may claim only what the tool beneath it
 * answers.** Where the panel then lands, and which rule it ends up under. Properties outside the
 * families: what hides a panel (`visibility`, `opacity`, `display` and `z-index` of a panel); what
 * enlarges its box from the inside, which is `padding`, `border` and `box-sizing` (design values
 * that a pin would freeze, and `box-sizing: border-box` is what `index.css` says of every element,
 * which is what lets `max-width` hold them); what its content asks of it; and the button, whose
 * own box decides the line the panel hangs under. A rule that applies only under a
 * pseudo-class jsdom's matcher does not carry (`:active`, `:focus-visible`, `:target`), or under
 * `:hover` over anything but the button. A property or an at-rule jsdom's parser does not know,
 * which it drops (`@starting-style` inside a rule, measured). And a style that script writes after
 * the state is read. Every one of those is asked of Chrome and none of them of this.
 *
 * That the shape this holds is the one that keeps a panel on the screen was measured, not argued:
 * fourteen widths from 360 to 1280 on the production build and on the QA build, the inbox with
 * messages, empty, refused by the server and never answered, and 360 at 200% text, where every
 * panel lies whole on the screen. The numbers it was measured at, before and after, are the
 * boundary written in the head of that script, for the browser of ADL A63 to turn into guards one
 * at a time.
 */
const SRC = join(process.cwd(), 'src')
const SHEET = 'app/Shell.css'

/** The one width the portal changes this header at: the navigation unfolds above it and the
 *  button that folds it away stops being drawn (`styles/scale.test.ts` holds the list of
 *  widths and says why this is on it). */
const NARROW = '(max-width: 51.24875em)'

/**
 * The three panels of the header: the name of the button that opens each, the box that button
 * stands in, the panel it opens, and the names written on that panel (pinned, with the reason
 * each is there below). One table, read by every question about the stylesheet and about the
 * markup, so that the class names the one holds are the ones the other finds on the page (a fact
 * with two homes drifts, and a guard over a class nobody wears holds nothing).
 *
 * `margin` and `transform` are the language menu's alone: `margin: 0` is the list's own, and
 * `transform` is how it opens (`translateY(-4px)` shut, `none` open, both read below by value,
 * because they are the one place a panel is meant to be moved). `margin-top` is the step under the
 * button that the query gives all three.
 */
const ON_THE_PANEL = ['margin-top', 'max-width', 'min-width', 'position', 'right', 'top', 'width']

const HEADER_PANELS = [
  {
    button: 'Jezik',
    box: '.lang',
    panel: '.lang__menu',
    onThePanel: ['margin', 'transform', ...ON_THE_PANEL].sort(),
  },
  { button: 'Otvori nalog', box: '.account', panel: '.account__panel', onThePanel: ON_THE_PANEL },
  { button: /^Otvori poruke/, box: '.inbox', panel: '.inbox__panel', onThePanel: ON_THE_PANEL },
]

const PANELS = HEADER_PANELS.map((one) => one.panel)
const BUTTONS_BOX = HEADER_PANELS.map((one) => one.box)

/** What is written on the three boxes between a panel and the bar: the box of a button is only
 *  ever positioned (`relative` outside the query, `static` in it), the row of tools is a flex row
 *  and nothing else, and the bar is a flex row that the query makes the positioned box. */
const BETWEEN_PINNED = { box: ['position'], tools: ['display'], bar: ['display', 'position'] }

/** What can make one of the three boxes between a panel and the bar the measure of a positioned
 *  box, take its box away, or clip what hangs from it (the head of this file says why a pattern and
 *  not a list). */
const BETWEEN =
  /^(position|display|all|overflow(-.+)?|clip(-path)?|transform|translate|rotate|scale|perspective|filter|backdrop-filter|contain|container-type|content-visibility|will-change)$/

/** What places, sizes or moves a panel, in every spelling. */
const THE_PANEL =
  /^(position|all|top|right|bottom|left|inset(-.+)?|margin(-.+)?|(min-|max-)?(width|height|inline-size|block-size)|transform|translate|rotate|scale)$/

/** The width of the gutter on each side of the bar, which is the bar's own `padding-inline`
 *  (`.shell__bar`), written once as a token. */
const GUTTER = 'var(--space-16)'
const WITHIN_THE_BAR = `calc(100% - 2 * ${GUTTER})`

type Role = 'box' | 'panel' | 'tools' | 'bar'

/** One rule of one sheet, with where it is written and what it writes. */
type Written = {
  sheet: string
  /** The selector as written, the whitespace of its line breaks folded. */
  selector: string
  /** The query the rule is written in, or null where it is written outside any. */
  condition: string | null
  /** Where in its sheet it stands, counted over the style rules of that sheet. */
  line: number
  /** Every property it writes, a shorthand's longhands folded back into it. */
  names: string[]
  values: Record<string, string>
  important: string[]
}

/** One rule that reaches one element in one state, and the names of the family it writes. */
type Reach = {
  panel: string
  open: boolean
  role: Role
  rule: Written
  names: string[]
}

type Snapshot = {
  sheets: number
  rules: number
  reaches: Reach[]
  /** `panel, state, role` of every element that carries an inline `style`. */
  inlined: string[]
  /** What the state really was, so that a click that did nothing does not pass for a state. */
  states: { panel: string; open: boolean; expanded: boolean; focusInside: boolean; worn: boolean }[]
  /** The chain, as the stylesheet names it: what each box, panel, row and bar turned out to be. */
  chain: { panel: string; box: boolean; panelClass: boolean; tools: boolean; bar: boolean }[]
  /** Rules that write a name of a family and whose selector the matcher refused. */
  unreadable: string[]
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

/** The properties a style rule writes, and a `margin` shorthand's four physical longhands folded
 *  back into it: the parser hands out all five for `margin: 0`, and the four are the one. */
function namesIn(style: CSSStyleDeclaration): string[] {
  const names: string[] = []

  for (let at = 0; at < style.length; at += 1) {
    names.push(style.item(at))
  }

  return names.includes('margin')
    ? names.filter((one) => !/^margin-(top|right|bottom|left)$/.test(one))
    : names
}

/** A rule that carries declarations of its own and is not a style rule: what the parser calls the
 *  declarations that follow a nested rule, or stand in a query nested in a rule. */
function carriesDeclarations(rule: CSSRule): rule is CSSRule & { style: CSSStyleDeclaration } {
  return 'style' in rule && rule.style instanceof CSSStyleDeclaration
}

/**
 * Every rule of every sheet of the portal, wherever it stands: at the top, inside a media query,
 * inside anything else that groups rules, AND NESTED inside another rule, which the parser
 * understands and an earlier version of this walked past. A nested rule is written against what it
 * nests in, so `&` is the rule it stands in (`:is(.inbox)`) and the declarations that follow a
 * nested rule belong to that rule too. Read through the browser's own parser and not as text, so
 * that a rule inside a query is a rule inside a query.
 *
 * What the parser drops, it drops here: an at-rule it does not know (`@starting-style` inside a
 * rule, measured) is not seen, and the head of this file says so.
 */
function everythingWritten(): { rules: Written[]; sheets: number } {
  const rules: Written[] = []
  const sheets = stylesheets()

  for (const sheet of sheets) {
    const tag = document.createElement('style')
    let line = 0

    tag.textContent = sheet.text
    document.head.append(tag)

    const add = (selector: string, style: CSSStyleDeclaration, condition: string | null) => {
      const names = namesIn(style)

      line += 1
      rules.push({
        sheet: sheet.path,
        selector,
        condition,
        line,
        names,
        values: Object.fromEntries(names.map((one) => [one, style.getPropertyValue(one)])),
        important: names.filter((one) => style.getPropertyPriority(one) === 'important'),
      })
    }

    const walk = (list: CSSRule[], condition: string | null, within: string | null) => {
      for (const rule of list) {
        if (rule instanceof CSSStyleRule) {
          const written = rule.selectorText.replace(/\s+/g, ' ').trim()
          const selector = within === null ? written : written.replace(/&/g, `:is(${within})`)

          add(selector, rule.style, condition)
          walk([...rule.cssRules], condition, selector)
        } else if (within !== null && carriesDeclarations(rule)) {
          add(within, rule.style, condition)
        } else if (rule instanceof CSSMediaRule) {
          walk([...rule.cssRules], rule.conditionText, within)
        } else if (rule instanceof CSSGroupingRule) {
          walk([...rule.cssRules], '(another kind of query)', within)
        }
      }
    }

    walk([...(tag.sheet?.cssRules ?? [])], null, null)
    tag.remove()
  }

  return { rules, sheets: sheets.length }
}

let everything: ReturnType<typeof everythingWritten> | undefined

/** Read once and kept: what comes out is data, and parsing every sheet of the portal is the
 *  costly part of every question below. */
const read = () => (everything ??= everythingWritten())

let snapshot: Promise<Snapshot> | undefined

/**
 * The portal drawn signed in, every one of the three panels in its closed state and then in the
 * state a click leaves it in, and for each of the four elements the rules that reach it. Taken
 * once and kept, since what comes out is data and the drawing costs a second; the panel is shut
 * again with Escape before the next one is opened, so that every closed state is a closed one.
 */
function theHeaderAsItIs(): Promise<Snapshot> {
  snapshot ??= (async () => {
    const user = setupUser()
    const { rules, sheets } = read()
    const reaches: Reach[] = []
    const inlined: string[] = []
    const states: Snapshot['states'] = []
    const chain: Snapshot['chain'] = []
    const unreadable: string[] = []

    renderAt('/sr', 'competitor', '000007')

    for (const one of HEADER_PANELS) {
      const name = String(one.button)
      const button = await screen.findByRole('button', { name: one.button })

      for (const open of [false, true]) {
        if (open) {
          await user.click(button)
        }

        const box = htmlElement(button.parentElement)
        const panel = htmlElement(button.nextElementSibling)
        const tools = htmlElement(box.parentElement)
        const bar = htmlElement(tools.parentElement)
        const elements: [Role, HTMLElement, RegExp][] = [
          ['box', box, BETWEEN],
          ['panel', panel, THE_PANEL],
          ['tools', tools, BETWEEN],
          ['bar', bar, BETWEEN],
        ]

        states.push({
          panel: name,
          open,
          expanded: button.getAttribute('aria-expanded') === 'true',
          focusInside: box.matches(':focus-within'),
          worn: box.classList.contains('is-open'),
        })

        if (!open) {
          chain.push({
            panel: name,
            box: box.matches(one.box),
            panelClass: panel.matches(one.panel),
            tools: tools.classList.contains('shell__tools'),
            bar: bar.classList.contains('shell__bar'),
          })
        }

        for (const [role, element, family] of elements) {
          if (element.hasAttribute('style')) {
            inlined.push(`${name} ${open ? 'open' : 'closed'} ${role}`)
          }

          for (const rule of rules) {
            const names = rule.names.filter((written) => family.test(written))

            if (names.length === 0) {
              continue
            }

            try {
              if (element.matches(rule.selector)) {
                reaches.push({ panel: name, open, role, rule, names })
              }
            } catch {
              unreadable.push(`${rule.sheet} ${rule.selector}`)
            }
          }
        }
      }

      /* Shut again, so that the next panel's closed state is a closed one and the next click
         opens one panel and not two. */
      await user.keyboard('{Escape}')
    }

    return { sheets, rules: rules.length, reaches, inlined, states, chain, unreadable }
  })()

  return snapshot
}

/**
 * What `app/Shell.css` says about a property of a selector in one place, read off the same rules
 * the questions about what reaches an element are asked of: the value of the LAST rule written in
 * that place (inside the narrow query, or outside any) that names the selector and writes the
 * property, `undefined` where none does. It answers where something is written and never which
 * of two wins. One data source on purpose: a value read from the top of the sheet by one reader
 * while another reader walks the rules nested inside them is two readers that can disagree, and a
 * declaration nested in a query (`.inbox { @media … { position: relative } }`) is one only the
 * second would see. Read by the parts of a selector, because two selectors written on two lines are
 * folded with a space; exact here because of the first fact above, that every rule that reaches
 * one of these elements and writes one of its names is a plain class.
 */
function valueIn(selector: string, property: string, condition: string | null): string | undefined {
  return read()
    .rules.filter(
      (rule) =>
        rule.sheet === SHEET &&
        rule.condition === condition &&
        rule.names.includes(property) &&
        rule.selector.split(',').some((one) => one.trim() === selector),
    )
    .at(-1)?.values[property]
}

const inTheQuery = (selector: string, property: string) => valueIn(selector, property, NARROW)

const outsideAnyQuery = (selector: string, property: string) => valueIn(selector, property, null)

describe('what reaches the three panels of the header and the boxes they hang from', () => {
  it('asks every rule of every sheet of the portal, and every state it claims to ask about', async () => {
    const seen = await theHeaderAsItIs()

    /* Without this every check below passes on an empty list, which is the shape every sweeping
       test fails in. */
    expect(seen.sheets).toBeGreaterThan(30)
    expect(seen.rules).toBeGreaterThan(500)

    for (const role of ['box', 'panel', 'tools', 'bar']) {
      expect(seen.reaches.filter((one) => one.role === role).length, `rules that reach the ${role}`).toBeGreaterThan(0)
    }

    /* A rule whose selector the matcher refuses is a rule nobody asked, and it is not let pass. */
    expect(seen.unreadable).toEqual([])

    /* And the states really are the ones the head of this file says. The open state is what a
       click leaves: expanded, the box worn with `is-open`, focus inside the box. The closed one
       is shut, with nothing worn. A click that did nothing would leave the open state as the
       closed one and every rule below would be asked of the wrong element. */
    expect(seen.states).toHaveLength(HEADER_PANELS.length * 2)

    for (const state of seen.states) {
      expect(state.expanded, `${state.panel} ${state.open ? 'open' : 'closed'}`).toBe(state.open)
      expect(state.worn, `${state.panel} ${state.open ? 'open' : 'closed'} is-open`).toBe(state.open)
      expect(state.focusInside, `${state.panel} ${state.open ? 'open' : 'closed'} focus`).toBe(state.open)
    }
  })

  it('is written in one sheet, in one of two places, at the weight of one class, and not once important', async () => {
    const seen = await theHeaderAsItIs()
    const PLAIN = /^\.[\w-]+(?: ?, ?\.[\w-]+)*$/
    const offenders = new Set<string>()

    for (const { rule, role, names: written } of seen.reaches) {
      /* The one name that is let have a heavier rule, and only on a panel: `transform` is how the
         language menu opens, written once for the shut menu and once under `.lang.is-open`. It is
         pinned by name below like the rest, and both of its values are read below, which is what
         stands in for the weight of a rule that is not allowed to be a plain class. */
      const names = role === 'panel' ? written.filter((one) => one !== 'transform') : written

      if (names.length === 0) {
        continue
      }

      const where = `${rule.sheet} ${rule.condition ?? 'outside any query'} ${rule.selector}`

      /* ONE SHEET. A rule about these elements anywhere else is a rule whose weight this cannot
         say anything about. */
      if (rule.sheet !== SHEET) {
        offenders.add(`${where}: another sheet`)
      }

      /* TWO PLACES. Outside any query, and in the one narrow query. A third (a query of another
         width, `print`, a `@supports`) is a place the questions below were not asked about. */
      if (rule.condition !== null && rule.condition !== NARROW) {
        offenders.add(`${where}: a query of its own`)
      }

      /* ONE WEIGHT. A plain class, or a list of them: so no rule that reaches these is heavier
         than another, and what stands under `.lang.is-open`, `.inbox:focus-within`,
         `.shell__tools > *` or `*` is found here by what it reaches and refused. */
      if (!PLAIN.test(rule.selector)) {
        offenders.add(`${where}: not a plain class (${names.join(', ')})`)
      }

      /* NOTHING IMPORTANT, which outranks both of the above. */
      if (names.some((one) => rule.important.includes(one))) {
        offenders.add(`${where}: important`)
      }
    }

    expect([...offenders]).toEqual([])
  })

  it('writes exactly the names pinned here on each of them, in the closed state and in the open one', async () => {
    const seen = await theHeaderAsItIs()

    /* The pins are written by hand and that is on purpose: a list that regenerates itself from
       what is there pins nothing. A property nobody has written on one of these elements before
       is a new name, and it is read by whoever adds it before it is accepted. */
    for (const one of HEADER_PANELS) {
      const name = String(one.button)

      for (const open of [false, true]) {
        const on = (role: Role) =>
          [
            ...new Set(
              seen.reaches
                .filter((reach) => reach.panel === name && reach.open === open && reach.role === role)
                .flatMap((reach) => reach.names),
            ),
          ].sort()
        const state = `${name} ${open ? 'open' : 'closed'}`

        expect(on('box'), `${state}, the box`).toEqual(BETWEEN_PINNED.box)
        expect(on('tools'), `${state}, the row of tools`).toEqual(BETWEEN_PINNED.tools)
        expect(on('bar'), `${state}, the bar`).toEqual(BETWEEN_PINNED.bar)
        expect(on('panel'), `${state}, the panel`).toEqual(one.onThePanel)
      }
    }
  })

  it('stands the narrow query after the base rule, wherever both write one name on one element', async () => {
    const seen = await theHeaderAsItIs()
    const lines = new Map<string, { base: number[]; narrow: number[] }>()

    for (const { panel, open, role, rule, names } of seen.reaches) {
      for (const name of names) {
        const key = `${panel} ${open ? 'open' : 'closed'} ${role} ${name}`
        const here = lines.get(key) ?? { base: [], narrow: [] }

        here[rule.condition === null ? 'base' : 'narrow'].push(rule.line)
        lines.set(key, here)
      }
    }

    const both = [...lines].filter(([, one]) => one.base.length > 0 && one.narrow.length > 0)

    /* The pairs the repair is made of, so that this cannot pass over none: the box of each
       button and the three panels' own offsets. */
    expect(both.length).toBeGreaterThan(10)

    /* An order of lines and not a claim about which of them wins: the query is written after
       the rule it takes over from, and that is what the file says. */
    expect(
      both
        .filter(([, one]) => Math.min(...one.narrow) < Math.max(...one.base))
        .map(([key]) => key),
    ).toEqual([])
  })
})

describe('what the narrow query says, and what stands outside it', () => {
  it('says that the bar is the positioned box and the box of a button is not', () => {
    expect(inTheQuery('.shell__bar', 'position')).toBe('relative')
    expect(outsideAnyQuery('.shell__bar', 'padding-inline')).toBe(GUTTER)

    /* The box of each button is written `position: static` in the query, where it is written
       `relative` outside it (below). That the panel is then measured from the bar and not from
       the button is a browser's to say; what is held is what is written. */
    for (const box of BUTTONS_BOX) {
      expect(inTheQuery(box, 'position'), `${box} in the narrow query`).toBe('static')
    }
  })

  it('stands the panels under the button that opened them, against the gutter at the right edge of the bar', () => {
    for (const panel of PANELS) {
      /* The static position is the line under the button; the gap under it is the same step the
         rule outside the query gives it. */
      expect(inTheQuery(panel, 'top'), `${panel} top`).toBe('auto')
      expect(inTheQuery(panel, 'margin-top'), `${panel} margin-top`).toBe('var(--space-8)')

      /* A step of the scale and never a negative one: the offset that was here was `-0.5rem`,
         which pushed the panel half a rem PAST the button it hangs from. */
      expect(inTheQuery(panel, 'right'), `${panel} right`).toBe(GUTTER)
    }
  })

  it('never pulls a panel past an edge, in any query and in any spelling', async () => {
    /* A negative offset on a panel is how it leaves the screen. The scale test refuses a bare
       `-0.5rem`, and this refuses the ones that test cannot read: one behind a `calc`, one in a
       logical spelling. Asked of every declaration that reaches a panel and places it. */
    const seen = await theHeaderAsItIs()
    const placed = seen.reaches
      .filter((one) => one.role === 'panel')
      .flatMap(({ rule, names }) =>
        names.map((name) => ({ selector: rule.selector, name, value: rule.values[name] ?? '' })),
      )
      .filter((one) => /^(?:left|right|top|bottom|inset|margin)(?:-.+)?$/.test(one.name))

    expect(placed.length).toBeGreaterThan(0)
    expect(
      placed
        /* A minus sign in front of a number, and not the two that open a custom property. */
        .filter((one) => /(?:^|[\s(,])-(?=[\d.])/.test(one.value))
        .map((one) => `${one.selector} ${one.name}: ${one.value}`),
    ).toEqual([])
  })

  it('makes a panel as wide as the bar allows and never wider, counted from the bar and not from the window', async () => {
    for (const panel of PANELS) {
      /* The width the panels always had, asked for outright: left to `auto` it grows to the
         longest line of the longest subject once the room it is offered is the whole bar, which
         is 736px on a tablet, over the picture at the other end of the row. */
      expect(inTheQuery(panel, 'width'), `${panel} width`).toBe('min-content')
      expect(inTheQuery(panel, 'max-width'), `${panel} max-width`).toBe(WITHIN_THE_BAR)

      /* The least it is allowed is the bar's room too, or the cap above is a cap over a floor
         that is higher: 20rem is 640px at 200% text on a screen 360 wide. */
      expect(inTheQuery(panel, 'min-width'), `${panel} min-width`).toMatch(
        /^min\([\d.]+rem, calc\(100% - 2 \* var\(--space-16\)\)\)$/,
      )
    }

    /* `100vw` is the window, scrollbar included, and the bar is narrower than it by the
       scrollbar: it is what the width was counted from until now. Asked of every declaration that
       reaches a panel, in every query. */
    const seen = await theHeaderAsItIs()
    const fromTheWindow = seen.reaches
      .filter((one) => one.role === 'panel')
      .flatMap(({ rule, names }) =>
        names.map((name) => ({ selector: rule.selector, name, value: rule.values[name] ?? '' })),
      )
      .filter((one) => /\d(?:d|s|l)?v[wi]\b/.test(one.value))

    expect(fromTheWindow.map((one) => `${one.selector} ${one.name}: ${one.value}`)).toEqual([])
  })
})

describe('the markup a panel hangs from', () => {
  it('is the chain the stylesheet is written about, and carries no style of its own in either state', async () => {
    /* The axis the questions above cannot see, and the one that beat the last guard over a
       cascade in this portal (`pages/admin/entityStyle.test.ts`, ADL A33): an inline `style` is
       heavier than any rule in `Shell.css`, so `position: relative` written into the markup of
       the box of a button puts the panel back where it began, off the screen. It is answered
       where jsdom answers it exactly, as a question about an attribute and not about a cascade,
       and in BOTH states: one written for the open state only (`style={open ? … : undefined}`)
       is not there to be found while the panel is shut.

       And the chain itself is held, because the stylesheet names a button's box, the row of
       tools and the bar by class: a panel that is not the next thing after its button, in a box
       that is a child of the row of tools, which is a child of the bar, is a panel the questions
       above are asked about and do not apply to. */
    const seen = await theHeaderAsItIs()

    expect(seen.inlined).toEqual([])

    for (const one of seen.chain) {
      expect(one, `the chain of ${one.panel}`).toEqual({
        panel: one.panel,
        box: true,
        panelClass: true,
        tools: true,
        bar: true,
      })
    }

    expect(seen.chain).toHaveLength(HEADER_PANELS.length)
  })
})

describe('what stands outside the query, above the width where the navigation unfolds', () => {
  it('hangs a panel from its own button, which is the rule that is right there and is not touched', () => {
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

    /* The row of tools and the bar are flex rows and have a box. The names written on them are
       pinned above and not their values, and `display: contents` on the row would take its box
       away and make every box in it a child of the bar: a value of a name that was already
       there, which the pins cannot see, so it is read here. */
    expect(outsideAnyQuery('.shell__tools', 'display')).toBe('flex')
    expect(outsideAnyQuery('.shell__bar', 'display')).toBe('flex')
  })

  it('moves the language menu by four pixels while it is shut and by nothing while it is open', () => {
    /* The one place a panel is meant to be moved, and the two names that are allowed in it
       (`transform` and the list's own `margin: 0`) are pinned by name above and not by value, so
       a new value of either would pass for the old one. The opening animation is the whole of
       what `transform` is for here, and `.lang.is-open .lang__menu` is a heavier rule than a
       plain class on purpose, so it is read by the selector it is written under. */
    expect(outsideAnyQuery('.lang__menu', 'transform')).toBe('translateY(-4px)')
    expect(outsideAnyQuery('.lang.is-open .lang__menu', 'transform')).toBe('none')
    expect(outsideAnyQuery('.lang__menu', 'margin')).toMatch(/^0(px)?$/)
  })
})
