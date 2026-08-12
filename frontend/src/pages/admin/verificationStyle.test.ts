import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* What the stylesheet of the verification queues has to say, read as text.
 *
 * jsdom applies no stylesheet, so every rendered test on these screens sees a
 * card that is never folded and a legend that is always on screen. The one fault
 * this file exists for lives exactly in that blind spot: the line saying what a
 * star means was drawn by the renderer over a screen whose every star the
 * stylesheet had folded away.
 */
const css = readFileSync(join(process.cwd(), 'src/pages/admin/Verification.css'), 'utf-8')

/** What is inside one query and nothing after it, counted by braces. */
function inside(query: string): string {
  const at = css.indexOf(query)

  expect(at, `${query} is not in Verification.css`).toBeGreaterThan(-1)

  let depth = 0

  for (let end = css.indexOf('{', at); end < css.length; end += 1) {
    if (css[end] === '{') {
      depth += 1
    }

    if (css[end] === '}') {
      depth -= 1

      if (depth === 0) {
        return css.slice(at, end + 1)
      }
    }
  }

  throw new Error(`${query} is never closed`)
}

describe('the line that says what a star means, on a queue of folded cards', () => {
  it('goes away with the cards, and comes back with the star inside one', () => {
    /* Below 820px a card is its name and its day, and everything else opens on a
       press: both things that draw a star on these screens, the three fields a
       proposed team is corrected in and the reason a proposal is sent back, are
       inside that card. The renderer cannot see any of this, because it is the
       stylesheet that folds the card, so the answer is written here and it is the
       question itself: is there a star inside an open card.

       Held as text and by both halves. The rule with the wrong selector is a rule
       that never matches, which reads exactly like the fault it was written for:
       a legend standing over a screen with nothing starred on it. */
    const folded = inside('@media (max-width: 819px)')

    expect(folded).toContain(':has(.pending__card--open .field__required)')
    expect(folded).toContain('.pending__legend')
    expect(folded.slice(folded.indexOf('.pending__legend'))).toContain('display: none;')
  })

  it('is written for the width where a card folds, and for no other', () => {
    /* Above 820px every card is open, so a legend drawn by the renderer is a
       legend beside its stars and nothing here may take it away. Written outside
       the query, this rule would hide the line on the very screens where it
       belongs. */
    const wide = inside('@media (min-width: 820px)')

    expect(wide).not.toContain('.pending__legend')
    expect(css.slice(0, css.indexOf('@media (max-width: 819px)'))).not.toContain(
      '.pending__legend',
    )
  })
})
