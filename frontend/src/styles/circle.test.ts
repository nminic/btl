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
       anything is wrong is the shape, and the shape is what nothing tests. */
    expect(shared).toContain('border-radius')
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
