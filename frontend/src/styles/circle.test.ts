import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../test/at'

/* The circle a face and a team mark are both drawn in.
 *
 * This file exists because of one day. On 13.08.2026 the six declarations that
 * make a circle were written twice, once for a member's face and once for a
 * team's logo, and were extracted into a shared `.face-circle` so there would
 * be one of them (ADL A7). The comments moved. Four of the declarations did
 * not.
 *
 * What went to QA was a portal where every face was a round white monogram and
 * every team mark was a dark square with its initials in the colour of a link,
 * measured at 2,78:1 against the 4,5:1 that text owes (WCAG 2.2 SC 1.4.3), and
 * against the owner's own words in PDL P13: „Kružan oblik je oblik prikaza".
 * 1849 tests passed and coverage read 100 per cent.
 *
 * Nothing on a screen could have caught it. jsdom applies no stylesheet at all,
 * so every rendered test sees an element with a class name and no shape. So the
 * stylesheet is read as text, and what is asserted is the thing the extraction
 * broke: that the shared block really holds what is shared, and that a sheet
 * using the class brings the sheet that defines it.
 *
 * Nothing here names a value the source does not: every declaration is looked
 * for by property, and the two marks are compared against each other rather
 * than against a figure written down here (ADL A7).
 */

const read = (name: string) =>
  readFileSync(join(process.cwd(), 'src/components', name), 'utf-8')

const portrait = read('Portrait.css')
const teamMark = read('TeamMark.css')
const cropping = read('Crop.css')
const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')

/** What one declaration is set to, by rule and property. Names nothing itself:
 *  what it hands back is whatever the stylesheet says, and the tests compare
 *  that against the one thing it has to be (ADL A7). */
function valueOf(sheet: string, selector: string, property: string): string {
  const found = new RegExp(`^\\s{2}${property}:\\s*([^;]+);`, 'm').exec(bodyOf(sheet, selector))

  expect(found, `${selector} sets ${property}`).not.toBeNull()

  return (found?.[1] ?? '').trim()
}

/** One rule's body, by the selector that opens it. Everything between the brace
 *  that follows the selector and the first closing brace, which is all these
 *  blocks are: none of them nests. */
function bodyOf(sheet: string, selector: string): string {
  const at = sheet.indexOf(`${selector} {`)

  expect(at, `${selector} is defined`).toBeGreaterThan(-1)

  return sheet.slice(at, must(sheet.indexOf('}', at), 'the end of the rule'))
}

/** Which properties a rule sets, in the order it sets them. Read off the text
 *  rather than off a parser, because what is being guarded is what somebody
 *  will next delete by hand. */
function declaredIn(body: string): string[] {
  /* `slice` rather than an index, because a group that matched is still „string
     or nothing" to the compiler and the rule here is that nothing is asserted
     away (ADL A14). A group inside a match that succeeded is always there, so
     this drops nothing. */
  return [...body.matchAll(/^\s{2}([a-z-]+):/gm)].flatMap((found) => found.slice(1, 2))
}

const shared = declaredIn(bodyOf(portrait, '.face-circle'))

describe('the circle a face and a team mark share', () => {
  it('is a circle, and says so where both of them read it', () => {
    /* The one that got away. A block that has lost its radius still paints,
       still sizes, and still centres its letters, so the only thing that says
       anything is wrong is the shape, and the shape is what nothing tests.

       Half, and not a rounded corner. The first version of this file asked only
       whether the property was there, and a review changed the value to
       `var(--radius-8)` and watched all 1888 tests pass: every face and every
       team mark was a rounded square, which is exactly what PDL P13 refuses in
       the owner's own words. A guard that counts properties guards nothing. */
    expect(shared).toContain('border-radius')
    expect(valueOf(portrait, '.face-circle', 'border-radius')).toBe('50%')
  })

  it('writes the initials in the one colour that stands on a face', () => {
    /* The other half of the same lesson. Asked only for the presence of
       `color`, the guard let `var(--text-muted)` through, which measures 3,90:1
       to 4,37:1 on the colours these discs are painted in, against the 4,5:1
       normal text owes (WCAG 2.2 SC 1.4.3). The discs are `hsl(... 45% 32%)`, a
       lightness chosen for white, so white is the value and not merely a
       colour. */
    expect(valueOf(portrait, '.face-circle', 'color')).toBe('var(--white)')
    expect(valueOf(portrait, '.face-circle', 'font-weight')).toBe('700')
    expect(valueOf(portrait, '.face-circle', 'background')).toContain('hsl(var(--face-hue')
  })

  it('carries every declaration neither mark can do without', () => {
    /* Colour, weight and spacing are as shared as the shape: two letters on a
       dark disc are text and not decoration, and they are the whole of what
       tells one team from another until it has a logo. Left out of the block,
       they fell back to whatever the page around them said, which for a mark in
       a table of links was the colour of a link. */
    expect(shared).toEqual(
      expect.arrayContaining(['border-radius', 'color', 'font-weight', 'background', 'overflow']),
    )
  })

  it('leaves each mark only what genuinely differs', () => {
    /* The other half of one decision in one place. A shared block nobody
       shortens is a block that grows back into two copies: the point of the
       extraction was that a face and a mark differ in size and in how they sit
       in a line, and in nothing else. */
    const face = declaredIn(bodyOf(portrait, '.portrait'))
    const mark = declaredIn(bodyOf(teamMark, '.team-mark'))
    const both = face.filter((property) => mark.includes(property))

    expect(both.filter((property) => shared.includes(property))).toEqual([])
    expect(both).not.toContain('border-radius')
  })

  it('is brought by the sheet that uses it, and not by a bundler', () => {
    /* `TeamMark.tsx` writes `face-circle` on every mark. The class was defined
       only in `Portrait.css`, which is pulled in by `Portrait.tsx`, and the
       table of teams draws no portraits at all: the marks were painted because
       the build concatenates every stylesheet in the application into one, and
       would have gone bare the first time a page loaded this sheet without that
       one. ADL A7 says a sheet brings what it uses. */
    expect(teamMark).toContain("@import './Portrait.css'")
  })

  it('cuts a picture to the circle rather than letting one grow out of it', () => {
    /* A crop is a magnification (components/crop.ts), and a logo scaled to
       twice its circle covers the name beside it without something clipping it.
       The clipping belongs to the circle, which is never scaled, and not to the
       picture, which is. */
    expect(shared).toContain('overflow')
    expect(bodyOf(portrait, '.face-circle')).toMatch(/overflow:\s*hidden/)
  })

  it('paints a logo on a surface, and wins the tie that decides it', () => {
    /* A logo with holes in it stands on the surface of the card rather than on
       the colour the team was given. Both rules are one class deep, so which
       one paints would otherwise come down to the order the bundler happened to
       put two files in, which is the order of imports in whichever component
       loaded first. Named twice, this one wins wherever it lands. */
    expect(teamMark).toContain('.team-mark.team-mark--logo {')
    expect(bodyOf(teamMark, '.team-mark.team-mark--logo')).toMatch(/background:\s*var\(--surface\)/)
  })
})

/* The other half of a crop, which no rendered test can see either.
 *
 * The square is drawn twice by two unrelated pieces of CSS: `components/crop.ts`
 * works out three fractions, and one of the two drawings is nothing but a
 * property in a stylesheet. A review changed `cover` to `contain` and watched
 * all 1888 tests pass, which means the whole of that arithmetic had stopped
 * meaning anything and the logos were being letterboxed rather than cut. Same
 * rule as above: jsdom applies no stylesheet, so the sheet is read as text.
 */
describe('a crop drawn by the stylesheet', () => {
  it('fills the circle rather than fitting inside it', () => {
    /* `cover` is what makes `fittedTo` correct at all: it is the crop at its
       largest, and the two other properties are the zoom and the pan away from
       there (components/crop.ts). Anything else and the picture the member cut
       is not the picture on screen. */
    expect(valueOf(cropping, '.crop-fitted img', 'object-fit')).toBe('cover')
    expect(valueOf(cropping, '.crop-fitted', 'overflow')).toBe('hidden')
  })

  it('shows the whole picture where the square is being chosen', () => {
    /* And the opposite, three rules further down, for the same reason. The one
       place on the portal that deliberately shows everything is the review view:
       `cover` here would cut away exactly what the owner asked to stay visible. */
    expect(valueOf(cropping, '.crop__whole', 'object-fit')).toBe('contain')
  })

  it('shades what is thrown away without hiding it', () => {
    /* Owner, 12.08.2026: „zatamnjen ali dovoljno vidljiv ostatak". Both halves
       are a measurement and neither was guarded: a review set the shade to solid
       black, and to no shade at all, and watched every test pass both times.

       The band is wide because the exact value is a matter of taste and the
       requirement is not: opaque tells a moderator nothing about what a face was
       cut out of, and a veil tells them nothing about which part is kept. */
    const shade = valueOf(tokens, ':root', '--crop-shade')
    const alpha = Number(/(\d+)%\s*\)/.exec(shade)?.[1] ?? 0)

    expect(shade).toContain('rgb(0 0 0')
    expect(alpha).toBeGreaterThanOrEqual(35)
    expect(alpha).toBeLessThanOrEqual(70)

    /* And it is actually laid over the picture. It was a shadow spreading out of
       the lit square until 27.08.2026, and this line held it there; the day the
       square became a circle the shadow became a circle too, and the corners of a
       tall picture were left undimmed. So the shade is now a sheet over the whole
       picture with the circle cut out of it, and what is held here is the sheet.

       `inset: 0` is the half that matters and is the half the old shape could not
       promise: a sheet that covers the box covers its corners, whatever shape the
       hole in it is. */
    expect(valueOf(cropping, '.crop__shade', 'background')).toContain('var(--crop-shade)')
    expect(valueOf(cropping, '.crop__shade', 'inset')).toBe('0')
  })
})
