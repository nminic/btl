import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { first, must } from '../test/at'
import { ruleFor, unconditionalRules } from '../test/stylesheet'

/**
 * The row of a competitor on the main standing, held in the stylesheet where it is decided.
 *
 * Owner, 28.09.2026, from a screenshot of this exact row: „Pogledaj koliko je ovaj red jezivo
 * pojeban. Sve mora biti centrirano vertikalno u njemu, a clanski broj treba da ide ispod Imena i
 * prezimena tako da ukupna visina punog imena i broja odgovara ukupnoj visini slike / inicijala u
 * krugu." Three sentences, three cases below, each reading the sheet a rendered test cannot: jsdom
 * lays nothing out, so nothing that renders this table can say whether a cell sits in the middle of
 * its row or whether two lines of text add up to the height of a circle beside them (ADL A33, the
 * same reason `styles/rankingsRow.test.ts` and `styles/leagueLayout.test.ts` read a sheet as text
 * rather than a screen).
 *
 * What puts the number under the name rather than beside it is asked of the DOM instead, in
 * `pages/publicScreens.test.tsx` (`describe('Rankings')`, „puts the member number under the name"):
 * a stylesheet can say the two lines are blocks, but only the tree can say which element the
 * portal actually put them in, and a mutation that reverted `Rankings.tsx` while leaving this sheet
 * alone would pass every case here.
 */

const RANKINGS = join(process.cwd(), 'src/pages/Rankings.css')
const PLATE = join(process.cwd(), 'src/components/NamePlate.css')

const rankings = readFileSync(RANKINGS, 'utf-8')
const plate = readFileSync(PLATE, 'utf-8')

/** The one rule of a sheet written for exactly these two selectors together and no others, the way
 *  `styles/leagueLayout.test.ts` reads `.plate__given` and `.plate__family`: a grouped selector is
 *  read by the browser's own parser and split on its own commas rather than searched for as a
 *  substring, because `.table th` is also the first few characters of
 *  `.table th:nth-child(-n + 3)`, which is a different rule arguing over a different property. */
function ruleForBoth(css: string, named: string, a: string, b: string): CSSStyleDeclaration {
  const found = unconditionalRules(css, named).filter((rule) => {
    const parts = rule.selectorText.split(',').map((one) => one.trim())

    return parts.length === 2 && parts.includes(a) && parts.includes(b)
  })

  expect(found.length, `${a} and ${b} are not one rule of exactly ${named}`).toBe(1)

  return must(first(found), 'the rule').style
}

/** The number in front of `rem` in a written length, so 2,1rem and 1,05rem can be added up rather
 *  than compared as text. Failing loudly rather than returning zero if the unit is ever something
 *  else, since a silent zero would make every height in this file equal to every other. */
function rem(value: string): number {
  const found = /^(-?[\d.]+)rem$/.exec(value.trim())

  expect(found, `${value} is not a length written in rem`).not.toBeNull()

  return Number(found?.[1])
}

describe('the row of a competitor on the main standing', () => {
  it('centres every cell of the row, not only the one that carries the circle', () => {
    /* „Sve mora biti centrirano vertikalno u njemu." Every cell, so the selector reaches `td`
       itself rather than one class among several: the category, the four figures and the points
       carry no class of their own on this screen and would be invisible to a rule that asked for
       one. */
    const cell = ruleFor(rankings, '.rankings__table tbody td', 'Rankings.css')

    expect(cell.getPropertyValue('vertical-align')).toBe('middle')
  })

  it('does not centre the shared table the same way everywhere else', () => {
    /* The floor under the case above: `styles/table.css` sets `vertical-align: top` for every
       other table on the portal, on purpose (a table is read across, and top keeps every column on
       one shared line). Reading that the row centres its own cells says nothing unless the shared
       default is still what it was, or a change here could just as easily have been a change there
       and this file would go on passing over a screen it never touches. */
    const shared = readFileSync(join(process.cwd(), 'src/styles/table.css'), 'utf-8')
    const cell = ruleForBoth(shared, 'table.css', '.table th', '.table td')

    expect(cell.getPropertyValue('vertical-align')).toBe('top')
  })

  it('lays the name and the number out as two lines, the way the plate already lays out a pair', () => {
    /* „clanski broj treba da ide ispod Imena i prezimena." Two block boxes with nothing inline
       between them stack top to bottom on their own; this is the half of that claim a stylesheet
       can answer, and `pages/publicScreens.test.tsx` answers the other half, which element the
       portal actually put them in. */
    const lines = ruleForBoth(
      rankings,
      'Rankings.css',
      '.rankings__member-name',
      '.rankings__member-number',
    )

    expect(lines.getPropertyValue('display')).toBe('block')
  })

  it('adds the two lines up to the circle beside them, read from both sheets independently', () => {
    /* „ukupna visina punog imena i broja odgovara ukupnoj visini slike / inicijala u krugu." Read
       from two files that know nothing of each other rather than from one constant both would
       otherwise share: a shared constant would make this compare a value with itself, which is the
       one shape of assertion that cannot fail (CLAUDE.md, „tvrdnja o visini ne sme da cita istu
       konstantu iz koje visina dolazi"). The circle's size is `NamePlate.css`'s own, unchanged and
       still held by the golden text in `styles/leagueLayout.test.ts`; the line height is
       `Rankings.css`'s own. A mutation to either alone has to fail exactly one of the two readings
       below and therefore this sum. */
    const circle = ruleFor(plate, '.plate .portrait', 'NamePlate.css')
    const lines = ruleForBoth(
      rankings,
      'Rankings.css',
      '.rankings__member-name',
      '.rankings__member-number',
    )

    const faceSize = rem(circle.getPropertyValue('block-size'))
    const lineHeight = rem(lines.getPropertyValue('line-height'))

    expect(lineHeight * 2).toBeCloseTo(faceSize, 5)
  })

  it('does not draw the circle at all below 700px, which is the boundary a wrapped name meets first', () => {
    /* The equal-height claim above is only ever measured where the circle exists. Below 700px this
       table draws no circle (`styles/leagueLayout.test.ts` already holds the rule that does it),
       so a name that wraps to two lines on a telephone has nothing to disagree with; this case says
       only that the boundary is still there; the case above says the two sides that meet above it
       still add up. */
    const hidden = rankings.slice(rankings.indexOf('@media (max-width: 699.98px)'))

    expect(hidden).toContain('.rankings__table .plate__faces')
    expect(hidden.slice(hidden.indexOf('.plate__faces'))).toMatch(/display:\s*none/)
  })
})
