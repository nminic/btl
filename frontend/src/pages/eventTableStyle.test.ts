import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor, ruleInMedia } from '../test/stylesheet'

/**
 * Two arrangements that no rendered test can see, both found by an independent
 * round on 23.08.2026 and both measured in Chrome rather than argued.
 *
 * jsdom lays nothing out and applies no stylesheet (ADL A18), so what is asked here
 * is that the rules are written and declare what they are meant to declare. Whether
 * they win is a question for a browser, and the numbers each comment carries are
 * what was measured there.
 */
const profile = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')

describe('the table of races on an event', () => {
  it('is never narrower than the words in it', () => {
    /* Equal columns were asked for and a ceiling alone gave them: `min(100%, …)`.
       Measured at 200% text, that ceiling is also a floor a column cannot rise
       above, and a fixed layout will not grow for its content, so „Ultramaraton"
       wrote itself 14px over „324,00" at 1280 and 83px over it at 700, and the
       button in „Opcije" stood 70px outside its own cell.

       A floor in `rem` grows with the reader's text exactly as the content does.
       When it wins the table is wider than its box and the box scrolls, which is
       what PDL P24 asks of every other table on the portal. Measured after: zero
       overflow at 700 and at 1280, at 100% and at 200%, and the page itself never
       scrolls sideways. */
    /* In the query that says every column is drawn, and named as such: under 700px
       the climb and the descent are hidden (styles/table.css), so a width worked
       out from the count of columns would describe a table that is not there. */
    const races = ruleInMedia(profile, '(min-width: 700px)', '.table.table--races', 'Profile.css')
    const width = races.getPropertyValue('inline-size')

    expect(races.getPropertyValue('table-layout')).toBe('fixed')
    /* Both halves, because either alone is one of the two faults: the ceiling
       alone is what overflowed, and the floor alone would make a table of two
       columns take the width of five. */
    expect(width, 'the ceiling is gone, so the table may be wider than its box').toContain(
      'min(100%',
    )
    expect(width, 'the floor is gone, so a column may be narrower than its words').toContain(
      '7.5rem',
    )
  })
})

describe('the head of a competitor', () => {
  it('may break into two rows rather than push the page sideways', () => {
    /* The circle is sized in `rem`, so it grows with the reader's text: at 200% on
       a 360px screen it is 104px rather than 52px, and beside it the season's
       `select` has an intrinsic width of its own that `min-inline-size: 0` cannot
       talk down. Measured before: the page scrolled sideways by 44px, which is the
       one thing the portal never does (WCAG 2.2 SC 1.4.10). Measured after: 360px
       of content in 360px of screen at 100%, 150% and 200%. */
    expect(
      ruleFor(profile, '.profile__head--person', 'Profile.css').getPropertyValue('flex-wrap'),
    ).toBe('wrap')
  })
})
