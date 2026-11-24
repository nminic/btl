import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { at, must } from '../test/at'
import { contrast } from '../test/contrast'
import { bare, sources, WHOLE_PORTAL } from '../test/sources'
import { unremarked } from '../test/stylesheet'

/* EVERY DROPDOWN OF THE PORTAL WEARS ONE ARROW (owner, 23.11.2026, PDL „Strelica padajućeg izbora je veća”: „I
 * dropdown strelica na 2027 stoji jako malo i skroz desno u ćošku, ne sviđa mi se. Može li malo manje diskretna i
 * estetski lepše?”, and on the question where: every dropdown, the forms, the filters such as SEZONA, and the box
 * of a member).
 *
 * WHY NO LIST OF SELECTS IS KEPT HERE. The arrow is one rule in `index.css`, `select, .dropdown`, in the portal's
 * one palette (PDL „Portal ima samo tamnu temu; svetla se izbacuje", 24.11.2026), and every declaration of it is
 * important. In the cascade only another important declaration can beat an important one: no class,
 * however heavy, no order of sheets, and no `style` attribute React writes. So the question „does every select
 * wear it” is not asked select by select, which would be a list somebody has to keep (sixteen of them in thirteen
 * files on 23.11.2026, and more to come); it is asked of the cascade, which answers it for every select there is
 * or will be: is there anywhere ELSE an important declaration of anything that dresses a dropdown (its
 * appearance, its background, its padding)? The sweep is every stylesheet under `src`, read off the file system,
 * and every source that could set a priority on an element's style.
 *
 * What jsdom cannot say, that the rule really lands on the selects of real screens and draws an arrow a reader
 * can see, Chrome says (`geometry/dropdownArrow.geometry.ts`).
 */

const SRC = join(process.cwd(), 'src')
const INDEX = 'index.css'

function read(path: string): string {
  return readFileSync(join(SRC, path), 'utf-8').replaceAll('\r\n', '\n')
}

/** Every stylesheet under `src`, by its path from there. */
function stylesheets(dir = SRC, prefix = ''): { path: string; css: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return stylesheets(join(dir, entry.name), name)
    }

    return entry.name.endsWith('.css') ? [{ path: name, css: read(name) }] : []
  })
}

/** What dresses a dropdown: how the browser draws it, what is painted behind its text, and the room around it. */
const DRESS = /^(?:-webkit-|-moz-)?(?:all|appearance|background(?:-[a-z]+)*|padding(?:-[a-z]+)*)$/

/** Every important declaration of a sheet: of what, with what, and under which selector and which query. */
function important(css: string): { property: string; value: string; selector: string; inside: string }[] {
  const plain = unremarked(css)

  return [...plain.matchAll(/([-a-z]+)\s*:\s*([^;{}]*?)\s*!\s*important/g)].map((one) => {
    /* The block the declaration stands in opens at the last brace before it, and what is written between that
       brace and the punctuation before it is the selector; the block around that one, if any, is its query. */
    const opens = plain.lastIndexOf('{', one.index)
    const before = Math.max(plain.lastIndexOf('{', opens - 1), plain.lastIndexOf('}', opens - 1), plain.lastIndexOf(';', opens - 1))
    const outer = plain.lastIndexOf('{', opens - 1)
    const closedSince = plain.lastIndexOf('}', opens - 1)
    const query =
      outer > closedSince
        ? plain.slice(Math.max(plain.lastIndexOf('}', outer - 1), plain.lastIndexOf(';', outer - 1)) + 1, outer).trim()
        : ''

    return {
      property: at(one, 1),
      value: at(one, 2),
      selector: plain.slice(before + 1, opens).replaceAll(/\s+/g, ' ').trim(),
      inside: query.replaceAll(/\s+/g, ' '),
    }
  })
}

/** The rule that draws the arrow, as `index.css` writes it. */
const ARROW = { selector: 'select, .dropdown', inside: '' }
/** The second, for the reader who has asked the system for its own colours (review of PR 803, medium 1). */
const FORCED = { selector: ':root:root :is(select, .dropdown)', inside: '@media (forced-colors: active)' }
/** The one palette's rule; the second is no palette and is read on its own. */
const DRAWING = [ARROW]

function draws(one: { selector: string; inside: string }): boolean {
  return [...DRAWING, FORCED].some((rule) => rule.selector === one.selector && rule.inside === one.inside)
}

function ruleOf(rule: { selector: string; inside: string }) {
  return important(read(INDEX)).filter((one) => one.selector === rule.selector && one.inside === rule.inside)
}

describe('the rule that draws the arrow', () => {
  it('takes the browser arrow away from every select and the box one types into, paints the arrow at the right, and keeps the text clear of it', () => {
    expect(ruleOf(ARROW).map((one) => `${one.property}: ${one.value}`)).toEqual([
      'appearance: none',
      expect.stringMatching(/^background-image: url\("data:image\/svg\+xml,[^"]+"\)$/),
      'background-repeat: no-repeat',
      /* 0,625rem in from the edge, as far as the caret of the language box stands from its button's edge. */
      'background-position: right 0.625rem center',
      /* A box of 0,75rem (12px; owner, 23.11.2026, PDL „Strelica padajućeg izbora je manja i suptilnija”), in which the chevron spans 16 of 24: 8px of it. */
      'background-size: 0.75rem 0.75rem',
      /* The room is the arrow, the space it stands in from the edge, and a gap before the text: 12 + 10 + 4, inside the 2rem the portal's cards have room for; the room at the edge is the owner's „dobar” and stays. */
      'padding-inline-end: var(--space-32)',
    ])
  })

  it('is the one picture of the arrow there is: no other rule of the sheet draws one', () => {
    /* Until 24.11.2026 the dark palette drew the same arrow again under the two selectors it was applied by. A
       second picture of the arrow is a second palette, and the colour in it is held by nothing below. */
    const pictures = important(read(INDEX)).filter((one) => one.property === 'background-image')

    expect(pictures.map((one) => `${one.inside} ${one.selector}`.trim())).toEqual([
      ARROW.selector,
      `${FORCED.inside} ${FORCED.selector}`,
    ])
  })
})

describe('the rule for the reader who has asked the system for its own colours', () => {
  it('draws the same chevron, edged in white and drawn in black, which one of the two is always seen against any ground', () => {
    const [drawn, ...others] = ruleOf(FORCED).map((one) => `${one.property}: ${one.value}`)

    expect(others, 'nothing else than the picture changes: the place and the room stay the rule\'s own').toEqual([])
    expect(drawn).toMatch(/^background-image: url\("data:image\/svg\+xml,/)

    /* The path is the one of the rule for every palette (the same shape, the portal's one arrow), twice: the edge, then the line. */
    const arrow = ruleOf(ARROW).find((one) => one.property === 'background-image')?.value ?? ''
    const path = /d='([^']+)'/.exec(decodeURIComponent(arrow))?.[1]
    const picture = decodeURIComponent(drawn ?? '')

    expect(path).toBe('M4 8.5l8 8 8-8')
    expect([...picture.matchAll(/<path d='([^']+)'/g)].map((one) => one[1])).toEqual([path, path])
    /* White three pixels thick under black one pixel thick: the line is the stroke of the rule above (2 of 24), the edge
       is three times that. */
    expect([...picture.matchAll(/stroke='(#[0-9a-f]+)' stroke-width='(\d+)'/g)].map((one) => `${one[1]} ${one[2]}`)).toEqual([
      '#fff 6',
      '#000 2',
    ])
  })
})

describe('nothing else in the portal can take the arrow away', () => {
  const sheets = stylesheets()

  it('reads every stylesheet of the portal', () => {
    /* A sweep narrowed by accident answers „nothing wrong” over nothing (`test/sources.ts`): 57 sheets on
       23.11.2026, and the largest folder holds well under fifty. */
    expect(sheets.length).toBeGreaterThan(50)
    expect(sheets.map((one) => one.path)).toEqual(expect.arrayContaining([INDEX, 'pages/Rankings.css', 'roles/RoleSwitch.css']))
  })

  it('reads the important declarations it says it reads, the ones of the two rules among them', () => {
    expect(important(read(INDEX)).filter(draws)).toHaveLength(7)
  })

  it('has no important declaration of what dresses a dropdown outside those two rules', () => {
    const offenders = sheets.flatMap(({ path, css }) =>
      important(css)
        .filter((one) => DRESS.test(one.property))
        .filter((one) => path !== INDEX || !draws(one))
        .map((one) => `${path}: ${one.selector} { ${one.property} }`),
    )

    expect(offenders).toEqual([])
  })

  it('sets no priority on a style from the code, the one other way an important declaration is written', () => {
    const code = sources()

    expect(code.length).toBeGreaterThan(WHOLE_PORTAL)

    const offenders = code.filter((one) => /['"`]important['"`]/.test(bare(one.code))).map((one) => one.path)

    expect(offenders).toEqual([])
  })
})

describe('the colour of the arrow', () => {
  /* The arrow is the MUTED tone of the text (owner, 23.11.2026, PDL „Strelica padajućeg izbora je manja i
     suptilnija”), `--text-muted` of the palette, and not the full `--text` it wore before. */
  const tokens = unremarked(read('styles/tokens.css'))
  /* Every block of `tokens.css` that gives `--text` a value is a palette, and there is one since 24.11.2026. */
  const palettes = [...tokens.matchAll(/\{[^{}]*\s--text:[^{}]*\}/g)].map((one) => one[0])

  function valueIn(block: string, name: string): string | undefined {
    return new RegExp(`\\s${name}: ([^;]+);`).exec(block)?.[1]?.trim()
  }

  /** A colour of the palette followed through `var()` to its hex. */
  function hex(block: string, name: string): string {
    const value = must(valueIn(block, name), `${name} has no value`)
    const named = /^var\((--[a-z0-9-]+)\)$/.exec(value)

    if (named === null) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/)
      return value
    }

    return hex(block, must(named[1], 'the name inside var()'))
  }

  function strokeOf(rule: { selector: string; inside: string }): string {
    const image = must(ruleOf(rule).find((one) => one.property === 'background-image'), `${rule.selector} draws no arrow`)

    expect(image.value).toContain("stroke-width='2'")
    expect(image.value).toContain("stroke-linecap='round'")
    expect(image.value).toContain("stroke-linejoin='round'")

    return `#${must(/stroke='%23([0-9a-f]{6})'/.exec(image.value)?.[1], 'the arrow has no stroke colour')}`
  }

  it('reads one palette, for the one rule that draws the arrow, with a muted tone that is not the full one', () => {
    for (const palette of palettes) {
      expect(hex(palette, '--text-muted')).not.toBe(hex(palette, '--text'))
    }

    expect(palettes).toHaveLength(DRAWING.length)
  })

  it('is drawn in the stroke of the portal symbols, in the muted colour of the text', () => {
    DRAWING.forEach((rule, index) => {
      expect(strokeOf(rule), rule.selector).toBe(hex(must(palettes[index], 'a palette'), '--text-muted'))
    })
  })

  it('keeps 3:1 on the surface a control stands on and on the page behind it (WCAG 2.2 SC 1.4.11)', () => {
    DRAWING.forEach((rule, index) => {
      const palette = must(palettes[index], 'a palette')

      expect(contrast(strokeOf(rule), hex(palette, '--surface'))).toBeGreaterThanOrEqual(3)
      expect(contrast(strokeOf(rule), hex(palette, '--bg'))).toBeGreaterThanOrEqual(3)
    })
  })

})

describe('the arrow of the language box of the header is the same arrow', () => {
  const menu = read('app/LanguageMenu.tsx')
  const caret = must(/<svg\s+className="lang__caret"[\s\S]*?<\/svg>/.exec(menu)?.[0], 'the caret of the language box')
  const dropdown = must(ruleOf(ARROW).find((one) => one.property === 'background-image'), 'the arrow of the dropdowns').value

  it('draws the chevron of the dropdowns, in the stroke they have, in the muted tone of its text', () => {
    expect(caret).toContain('viewBox="0 0 24 24"')
    expect(caret).toContain('stroke="currentColor"')
    expect(caret).toContain('strokeWidth="2"')
    expect(caret).toContain('strokeLinecap="round"')
    expect(caret).toContain('strokeLinejoin="round"')
    expect(caret).toContain(`<path d="${must(/%3Cpath d='([^']+)'/.exec(dropdown)?.[1], 'the chevron of the dropdowns')}" />`)
  })

  it('is the size of the arrow of the dropdowns, in their muted tone, and not faded', () => {
    const css = unremarked(read('app/Shell.css'))
    const rule = must(/\.lang__caret\s*\{([^}]*)\}/.exec(css)?.[1], 'the rule of the caret')

    expect(rule).toContain('width: 0.75rem;')
    expect(rule).toContain('height: 0.75rem;')
    expect(rule).toContain('color: var(--text-muted);')
    expect(rule).not.toContain('opacity')
  })
})
