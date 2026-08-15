import { readFileSync } from 'node:fs'
import { must } from '../test/at'
import { join } from 'node:path'

/**
 * The row the filters stand in, held in the stylesheet where it is decided.
 *
 * jsdom computes no layout, so nothing that renders this screen can say whether
 * two fields are side by side or one under the other. What can be said is
 * that the rules the arrangement is built out of are still there, and each of
 * them is one the owner asked for by name.
 *
 * Read off the text, the way the other stylesheet guards on this portal are
 * (styles/hooks.test.ts, styles/scale.test.ts). Comments are blanked first, so
 * a rule described in prose is never mistaken for a rule that is written.
 */

const SHEET = blanked(readFileSync(join(process.cwd(), 'src/pages/Rankings.css'), 'utf-8'))

/** The screen itself, so a rule can be checked against a class something
 *  really wears rather than only against the sheet that writes it. */
const SOURCE = readFileSync(join(process.cwd(), 'src/pages/Rankings.tsx'), 'utf-8')

/** The sheet with its comments taken out. */
function blanked(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * The telephone's media query, and nothing after it.
 *
 * Bounded at the closing brace, which is the part a review found missing: cut
 * only at the front, the range ran to the end of the sheet, and `findLast`
 * happily answered with a rule that is not in the query at all. Proved by
 * emptying the real rule and writing a copy of it at the foot of the file: the
 * copy then applies at every width, the desktop table becomes the telephone`s
 * two column grid, and all seven guards passed.
 *
 * The query is the one block in this sheet that nests, so its end is the first
 * brace standing alone at the start of a line.
 */
function phoneQuery(): string {
  const whole = SHEET.slice(SHEET.indexOf('@media (max-width: 34.99875em)'))
  /* The brace that stands alone at the start of a line, which in this sheet
     is the one closing the query: everything inside it is indented. */
  const ends = whole.search(/\n\}/)

  expect(ends, 'the telephone query is closed').toBeGreaterThan(-1)

  return whole.slice(0, ends)
}

/**
 * One rule inside the telephone's media query, by a selector it carries.
 *
 * Matched against the whole selector, not against a piece of the text. Every
 * rule in this media query opens with the same
 * `.rankings--tooled:has(> .rankings__filters)`, so searching for a substring
 * finds whichever rule happens to stand first or last rather than the one that
 * is being asked about. A review proved what that costs with a decoy rule at
 * the top of the query: the guard over the spacing passed while the real rule
 * was set to nought and the gap on a telephone had halved.
 *
 * A rule may carry several selectors, so each list is split on commas and the
 * whole of one entry has to match. What comes back is the body alone.
 *
 * The **last** rule that carries it, because that is the one the browser obeys:
 * two rules of equal weight are settled by which comes later. Written to take
 * the first, this passed against a decoy at the top of the query while the real
 * rule below it was set to nought and the gap on a telephone had halved. Taking
 * the last is not a trick against decoys, it is reading the sheet the way the
 * browser does.
 */
function phoneRule(selector: string): string {
  const phone = phoneQuery()
  const rules = [...phone.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  const found = rules.findLast((rule) =>
    must(rule[1], 'the selectors of a rule')
      .split(',')
      .map((one) => one.trim())
      .includes(selector),
  )

  expect(found, `${selector} is not a selector in the telephone's rules`).toBeDefined()

  return must(found?.[2], 'the body of the rule')
}

/**
 * One rule's body, by its selector.
 *
 * The last of them, not the first: three of these selectors are written twice,
 * once inside the telephone's media query and once for every width, and the
 * media query stands first in the sheet. Asked for the first, this read the
 * telephone's rules and reported that the row is not a row.
 */
function bodyOf(selector: string): string {
  const at = SHEET.lastIndexOf(`${selector} {`)

  expect(at, `${selector} is not in the sheet`).toBeGreaterThan(-1)

  return SHEET.slice(at, SHEET.indexOf('}', at))
}

describe('the row the filters stand in', () => {
  it('lays them out in a row, names above controls', () => {
    /* Season, then categories (owner, 11.08.2026). There was a search box at
       the end of the row until he had it taken out on 31.07.2026. */
    const row = bodyOf('.rankings__filters')

    expect(row).toContain('display: flex')
    /* Aligned at the top and not at the foot: each field is a name over a
       control, and aligned at the foot a field with a taller control pushes its
       own name up, so the two names read as two heights. */
    expect(row).toContain('align-items: start')
  })

  it('puts the spacing the row gives away back on its last field', () => {
    /* On a telephone the row of filters becomes `display: contents`, which
       throws its own box away and its `margin-block-end` with it. What stood
       between the filters and the table has to be put back on whatever is last
       in the row.

       That was the search box until it went (owner, 31.07.2026), and taking the
       box out took the spacing with it: a review measured the gap on a 360px
       screen fall from 24px to 12px, which is not a thing any test on this
       portal could see. The rule names the one field that can be last, and
       `:last-child` is what keeps it from spacing a field with something under
       it. */
    const spacing = phoneRule(
      '.rankings--tooled:has(> .rankings__filters) > .rankings__filters > .rankings__field--categories:last-child',
    )

    expect(spacing).toContain('margin-block-end: var(--space-12)')
    /* And the class it names is one an element actually wears. The rule it
       replaced named `--search`, which after the deletion no element on the
       portal carries, so it was correct, inert and invisible all at once. */
    expect(SOURCE).toContain('rankings__field--categories')
  })

  it('lets the chips give way rather than push the row', () => {
    /* The chips are as wide as the chips until the row runs out, and then they
       shrink and scroll inside themselves: unshrinkable, ten of them pushed the
       page sideways and the row's own scroll never engaged.

       This asked one more thing of a search box that took whatever was left of
       the row, until the box went (owner, 31.07.2026). The rule outlived it by
       a commit, and a review found the pair: a stylesheet block that no element
       on the portal wears, held in place by a test that made it look wanted. A
       guard over something that is not drawn is worse than no guard, because
       whoever comes to tidy the sheet has to delete the test to do it. */
    const chips = bodyOf('.rankings__field--categories')

    expect(chips).toContain('flex: 0 1 auto')
    expect(chips).toContain('min-inline-size: 0')
  })

  it('lets the chips scroll inside themselves rather than pushing the page', () => {
    /* The other half of the pair: `min-inline-size: 0` lets the field shrink,
       and this is what the shrinking is for. Without it a season with ten
       categories pushes the page sideways at 560px, which is the fault the
       shrinking was written to fix. */
    /* Read out of the rule that declares it, not the last rule of that name:
       the chip row is written twice, once for the row it stands in and once for
       itself, and `bodyOf` answers with the later. */
    const rows = SHEET.slice(SHEET.indexOf('.rankings__categories {'))

    expect(rows.slice(0, rows.indexOf('}'))).toContain('overflow-x: auto')
  })

  it('stands the categories as tall as the controls beside them', () => {
    /* The chips are shorter than a select, so without this they sat between the
       top and the bottom of the row and the two controls shared neither. */
    expect(bodyOf('.rankings__field--categories .rankings__categories')).toContain(
      'min-height: 2.5rem',
    )
  })

  it('puts the gender beside the season on a telephone, and nowhere else', () => {
    /* Under 560px they are one row under the name of the screen (owner,
       11.08.2026); above it the gender belongs with the name of the screen and
       the season with the filters. What lets a grandchild stand in that grid is
       `display: contents` on the row of filters, and that is the whole of the
       mechanism: without it the season cannot leave the row it is written in.

       Read out of the rules that own the declarations rather than out of the
       whole media query: asked of the query as one string, a `display: grid`
       moved to any rule at all inside it still passed, which is a guard that
       holds a word rather than a layout. */
    const container = phoneRule('.rankings--tooled:has(> .rankings__filters)')

    expect(container).toContain('display: grid')
    /* Both tracks bounded at nought, because a track is otherwise at least as
       wide as its content asks for: at 200% text the two gender buttons stopped
       fitting and the page scrolled sideways (WCAG 2.2 SC 1.4.4, 1.4.10). */
    expect(container).toContain('grid-template-columns: minmax(0, auto) minmax(0, 1fr)')
    expect(container).toContain('column-gap')
    /* Both gaps: `display: contents` throws the row's own away with its box, so
       without the second the three rows of filters touch. */
    expect(container).toContain('row-gap')
    /* Aligned at the foot, because the season carries a name above it and the
       gender does not: what makes them one row is that they end together. */
    expect(container).toContain('align-items: end')

    expect(
      phoneRule('.rankings--tooled:has(> .rankings__filters) > .rankings__filters'),
    ).toContain('display: contents')
  })

  it('scopes every one of those rules to this screen', () => {
    /* `rankings--tooled` is eight screens. A rule inside this query that names
       only the shared class is a rule that reaches all eight, and "inert on the
       other seven" is a thing that stays true only until one of them grows a
       row of filters. */
    /* `phoneQuery` already stops at the brace that closes the query. It used
       to be cut again here with `lastIndexOf`, which on an unbounded range was
       the last brace of the whole file, and what saved this one was the two
       spaces of indentation in the pattern below rather than the cut. */
    const loose = [...phoneQuery().matchAll(/^ {2}(\.[^{]+)\{/gm)]
      .map((one) => must(one[1], 'the selector the match found').trim())
      .filter((one) => !one.includes(':has(> .rankings__filters)'))

    expect(loose).toEqual([])
  })
})
