import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../../test/stylesheet'

/**
 * The two controls a member has over a result that has been counted, and the
 * room between them.
 *
 * The cell was named `my-results__own` in the markup and the name was never
 * written anywhere, so it decided nothing. That is not untidiness: without a box
 * of its own the two controls stack flush against each other, and one of them is
 * the one that deletes a result for good. Measured by a review on 28.08.2026 in
 * Chrome at 360 by 780: „Izmeni" ended at 542 and „Obriši" began at 542.
 *
 * jsdom applies no stylesheet and lays nothing out (ADL A18), so what is asked
 * here is the shape of the rules; the pixels were measured in a browser and are
 * written down below so a later reading has something to be compared with.
 *
 * Same screen, `/sr/moji-rezultati` as member 000001 at 360 by 780, over the
 * counted table:
 *
 * - before: the table drew **504** pixels inside a box of **328**, and both
 *   controls stood entirely past the right edge, „Izmeni" at 422 and „Obriši" at
 *   431 with the visible part of the box ending at 344. Nothing on the screen
 *   said they were there.
 * - after, with this rule and with the category column away on a phone: the table
 *   draws **370** in the same **328**, „Izmeni" begins at 312 and so is visible at
 *   the edge, and the gap between the two controls is 6 pixels (530 to 536).
 *
 * The 42 pixels that remain are one race name: „Langenzersdorfer
 * Weihnachtsmarathon" is a single unbreakable word 150 pixels wide, and a column
 * cannot be narrower than the longest word in it. The table scrolls inside its
 * own box by design (`styles/table.css`) and the page itself does not scroll
 * sideways, which is the hard rule; the rest belongs to the collected round of
 * scrolling work the owner has already put off („ima vremena", 24.08.2026).
 */
const MEMBER = readFileSync(join(process.cwd(), 'src/pages/member/Member.css'), 'utf-8')

describe('the cell holding what a member may do with a counted result', () => {
  it('is a box of its own, so the two controls do not touch', () => {
    const cell = ruleFor(MEMBER, '.my-results__own', 'Member.css')

    expect(cell.display).toBe('flex')
    /* Wrapping and not one line: in a column this narrow the two sit one above
       the other, and a row that refused to wrap would push the second one out of
       the table altogether. */
    expect(cell.flexWrap).toBe('wrap')
    /* The gap is the whole point. A token rather than a number, so it moves with
       every other space on the portal. */
    expect(cell.gap).toBe('var(--space-6)')
  })

  it('draws its controls the size the moderator’s queue draws them', () => {
    /* The same treatment as `.review__decide`, which is the portal's other pair
       of controls in a table cell, and it is what lets these two fit a phone at
       all: at full size this column alone added 106 pixels to a table already
       wider than the screen. */
    const button = ruleFor(MEMBER, '.my-results__own .button', 'Member.css')
    const queue = ruleFor(MEMBER, '.review__decide .button', 'Member.css')

    expect(button.padding).toBe(queue.padding)
    expect(button.fontSize).toBe(queue.fontSize)
    expect(button.whiteSpace).toBe('nowrap')
  })
})
