import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../../test/stylesheet'
import { bare } from '../../test/sources'

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
const SCREEN = readFileSync(join(process.cwd(), 'src/pages/member/MyResults.tsx'), 'utf-8')

/** The name the two of them have to agree on, written once here. */
const OWN = 'my-results__own'

describe('the cell holding what a member may do with a counted result', () => {
  it('is written under the name the screen really uses', () => {
    /* The first round of review found the mirror of this: a name in the markup
       with no rule behind it. What replaced it proved only that the rule exists,
       which is the same hole the other way round. Measured by a review on
       28.08.2026 with the class renamed in the screen alone: the rule stopped
       reaching the table, „Izmeni" ended at 549,09 and „Obriši" began at 549,09,
       so the destructive control sat flush against the harmless one again, and all
       2224 tests stayed green.

       Comments blanked, so a note naming the class is not read as using it. */
    expect(bare(SCREEN)).toContain(`<div className="${OWN}">`)
  })

  it('is a box inside the cell, and never the cell itself', () => {
    /* The precedent this follows says it in as many words where it does the same
       thing (`admin/ReviewQueue.tsx`): „The buttons in a box inside the cell,
       never on the cell itself: a `td` laid out as a flex container leaves the
       table and stops lining up with the row." This was written with the class on
       the `td` while citing that sentence.

       Measured by a review on 28.08.2026 in Chrome at 360 by 780: 36 of the 180
       rows, every one whose race name wraps to more lines than the controls do,
       drew the last cell 5,05 pixels shorter than its row, so the rule under the
       row broke off short of the rest of it. Moving the same class to a box
       inside the cell brought the offset to nought in the same page.

       Asked of the source and not of the screen, because jsdom lays nothing out
       (ADL A18) and this is a fault a browser has to draw before it exists: with
       the class back on the `td`, everything else in this file and in
       `ownResult.test.tsx` stayed green. */
    expect(bare(SCREEN)).not.toContain(`<td className="${OWN}"`)
  })

  it('is a box of its own, so the two controls do not touch', () => {
    const cell = ruleFor(MEMBER, `.${OWN}`, 'Member.css')

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
    const button = ruleFor(MEMBER, `.${OWN} .button`, 'Member.css')
    const queue = ruleFor(MEMBER, '.review__decide .button', 'Member.css')

    expect(button.padding).toBe(queue.padding)
    expect(button.fontSize).toBe(queue.fontSize)
    expect(button.whiteSpace).toBe('nowrap')
  })

  it('gives the mark on a race the calendar does not hold a rule of its own', () => {
    /* The name was invented rather than read from a sheet, so the cell drew „NOVO"
       in the same letters as the race beside it and read „NOVOProbna trka" (review,
       31.08.2026). What holds it is that the two homes of the name agree: the
       markup writes it and this sheet paints it.

       On its own line, which is what makes it a mark rather than a word running
       into the name, and that is the part the owner asked for („negde u ćošku"). */
    const mark = ruleFor(MEMBER, '.review__new', 'Member.css')

    expect(mark.getPropertyValue('display')).toBe('block')
    expect(mark.getPropertyValue('color')).not.toBe('')

    /* **And the name the queue really writes**, which is the half this asked
       nothing about for one round: renamed in the markup alone the rule stops
       reaching anything, the mark falls back to `inline` with no colour, and the
       cell reads „NOVOProbna trka" again with the whole suite green (measured
       31.08.2026). The mirror of this hole was found on 28.08.2026 fifty lines
       above and closed the same way.

       Comments blanked, so a note naming the class is not read as using it. */
    expect(bare(readFileSync(join(process.cwd(), 'src/pages/admin/ReviewQueue.tsx'), 'utf-8'))).toContain(
      'className="review__new"',
    )
  })
})
