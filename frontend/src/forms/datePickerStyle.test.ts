import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../test/at'
import { ruleFor } from '../test/stylesheet'

/**
 * What the sheet of the date picker SAYS about the row of a copy, and nothing it cannot
 * say (ADL A33).
 *
 * The copy of an event offers two days beside the calendar button (PDL, „Kopiranje
 * događaja bira korak", 23.08.2026), and at 360px with the text at 200% the three buttons
 * asked for more than the row had: the box was squeezed to 50px, no date could be read in
 * it, and the page scrolled sideways by 13px. The row now wraps, and only that row
 * (`DatePicker.css`, `.datepicker--steps`, which says why with the numbers).
 *
 * **What is held here is where things are written**, which is all a text guard may claim:
 * that the wrap is declared on the row of a picker with days and not on the bare row, that
 * the box asks for a width between the two measurements the sheet names, and that the
 * group the days travel in neither grows nor shrinks and keeps the row's own gap.
 *
 * **What is NOT held, and is written here rather than left to be found.** Whether the row
 * really wraps where it should, which rule wins where two apply, and where a box lands are
 * the browser's to answer, not a stylesheet's text (ADL A33). `scripts/date-row-geometry.mjs`
 * asks it, by hand and not in the gate, at 360, 390, 768 and 1280 with the text as it comes
 * and doubled; the browser of ADL A63 is the one to turn that into a guard. The markup the
 * sheet is written against, the class and the group, is held where the picker is drawn
 * (`DatePicker.test.tsx`).
 */
const PICKER = readFileSync(join(process.cwd(), 'src/forms/DatePicker.css'), 'utf-8')

/** The three parts of `flex: <grow> <shrink> <basis>`, as the sheet writes them. */
function flexOf(rule: CSSStyleDeclaration): { grow: string; shrink: string; basis: string } {
  const [grow, shrink, basis] = rule.getPropertyValue('flex').split(/\s+/)

  return { grow: grow ?? '', shrink: shrink ?? '', basis: basis ?? '' }
}

describe('the row of a picker that was handed days', () => {
  it('wraps, and only that row does', () => {
    const stepped = ruleFor(PICKER, '.datepicker--steps', 'DatePicker.css')
    const plain = ruleFor(PICKER, '.datepicker', 'DatePicker.css')

    expect(stepped.getPropertyValue('flex-wrap')).toBe('wrap')
    /* The other state of the same axis. The plain row is the one in the cell of a table of
       races and in the corner of the shell, and a wrap written there would be a wrap for
       every date on the portal. Asked of the bare row and not of the absence of a class:
       moving the declaration onto it is the mistake this is written for. */
    expect(plain.getPropertyValue('flex-wrap')).toBe('')
  })

  it('asks the box for a width between what a date needs and what one row at 360px leaves', () => {
    const box = ruleFor(PICKER, '.datepicker--steps .field__control', 'DatePicker.css')
    const { grow, shrink, basis } = flexOf(box)

    /* It may take the room that is left and give way, like the plain box. A basis alone
       would be a box that cannot take a whole line when it has one to itself. */
    expect([grow, shrink]).toEqual(['1', '1'])

    /* In `rem`, which is what moves with the text: the date is as wide as its letters, and
       the buttons beside it are as wide as theirs. */
    const rems = Number(must(/^(\d+(?:\.\d+)?)rem$/.exec(basis)?.[1], `a basis in rem, written ${basis}`))

    /* The floor: a typed date takes 211px of a root of 32px with its padding, measured in
       Chrome on 09.10.2026, which is 6.6rem. Below it the box is one nobody can read a date
       in, which is the fault this row was changed for (50px at 360px and 200%). */
    expect(rems, 'the box would be too narrow to show a date').toBeGreaterThanOrEqual(6.6)

    /* The ceiling, from the other side: at 360px with the text as a browser starts, the
       content is 328px wide and the days with the calendar and the gaps take 140.78 and
       6 of it, which leaves 181.22px, or 11.3rem, for the box. A larger basis would send
       the days under the box where they stand beside it today, against the owner's one
       row (PDL, „Kopiranje događaja bira korak", 23.08.2026). */
    expect(rems, 'the days would no longer fit beside the box at 360px').toBeLessThanOrEqual(11.3)
  })

  it('keeps the days and the calendar together, with the gap of the row between them', () => {
    const group = ruleFor(PICKER, '.datepicker__tools', 'DatePicker.css')
    const row = ruleFor(PICKER, '.datepicker', 'DatePicker.css')

    expect(group.getPropertyValue('display')).toBe('flex')
    /* Neither grows nor shrinks, so the group is beside the box whole or under it whole. */
    expect(group.getPropertyValue('flex')).toBe('0 0 auto')

    /* The gap is read off the row and not written twice, so the three look as they did
       when they were siblings of the box. Asked first whether the row has one, because two
       empty answers are equal and a guard that cannot tell nothing from something is not
       one. */
    expect(row.getPropertyValue('gap'), 'the row has no gap to compare with').not.toBe('')
    expect(group.getPropertyValue('gap')).toBe(row.getPropertyValue('gap'))
  })
})
