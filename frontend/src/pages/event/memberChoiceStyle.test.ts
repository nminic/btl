import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { must } from '../../test/at'
import { ruleFor, unconditionalRules } from '../../test/stylesheet'

/**
 * THE LETTERS AND THE ROWS OF THE LIST OF MEMBERS (owner, 24.11.2026, PDL „Sitnice iz recenzije PR-a 815 i 811
 * i panela tima": „u unosu rezultata pri uvećanom tekstu redovi spiska članova se prelamaju kao u panelu tima;
 * panel tima vraća sitnija prigušena slova").
 *
 * jsdom applies no stylesheet and lays nothing out (ADL A18), so what is asked here is the shape of the rules;
 * that a name really goes on to a second line at 200 % text on a telephone is a question for Chrome
 * (`geometry/memberChoice.geometry.ts` and `geometry/teamMembersPanel.geometry.ts`).
 *
 * <p>Two things are held, and each by the declaration that decides it rather than by a count of anything:
 * the row of EVERY list is allowed to break inside a word and is never cut with three dots, and the box and the
 * rows of the panel of a team are the 0,9rem every box of a field of the portal is, with the rows muted until
 * one is under the pointer.
 */
const CSS = readFileSync(join(process.cwd(), 'src/pages/event/MemberChoice.css'), 'utf-8')

describe('the rows of a list of members', () => {
  it('are never cut with three dots, in the list of the results as in the panel of a team', () => {
    const row = ruleFor(CSS, '.member-choice__one', 'MemberChoice.css')

    /* Each of the three that made a one-line row, written as an absence: a row that says `nowrap`, `ellipsis` or
       `hidden` again is a row that cuts a name at 200 % and takes the number of the member with it. */
    expect(row.getPropertyValue('white-space')).toBe('')
    expect(row.getPropertyValue('text-overflow')).toBe('')
    expect(row.getPropertyValue('overflow')).toBe('')
    expect(row.getPropertyValue('overflow-wrap')).toBe('anywhere')
  })

  it('are the size of the box in the panel of a team, and muted until one is pointed at', () => {
    const box = ruleFor(CSS, '.member-choice--fitted > .field__control', 'MemberChoice.css')
    const rest = ruleFor(CSS, '.member-choice__list--fitted .member-choice__one', 'MemberChoice.css')
    /* Found by the class the arrow keys move and not by the whole of its selector, which is a group with `:hover`
       and is written however the parser prints a group. */
    const [pointed] = unconditionalRules(CSS, 'MemberChoice.css').filter(
      (rule) =>
        rule.selectorText.includes('.member-choice__list--fitted .member-choice__one--at') &&
        rule.style.getPropertyValue('color') !== '',
    )

    expect(box.getPropertyValue('font-size')).toBe('0.9rem')
    /* The two meet in one size, or the `ch` the box is counted in and the letters of its rows part. */
    expect(rest.getPropertyValue('font-size')).toBe(box.getPropertyValue('font-size'))
    expect(rest.getPropertyValue('color')).toBe('var(--text-muted)')
    expect(must(pointed, 'the rule of the row that is pointed at').style.getPropertyValue('color')).toBe('var(--text)')
  })
})
