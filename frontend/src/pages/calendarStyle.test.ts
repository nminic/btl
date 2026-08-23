import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../test/stylesheet'

/**
 * One arrangement of the month that no rendered test can see.
 *
 * jsdom lays nothing out and applies no stylesheet (ADL A18), so what is asked here
 * is that the rule is written and declares what it is meant to declare. Whether it
 * wins is a question for a browser, and the numbers below are what was measured
 * there.
 */
const calendar = readFileSync(join(process.cwd(), 'src/pages/Calendar.css'), 'utf-8')

describe('a day of the month', () => {
  it('may be narrower than the longest name in it', () => {
    /* The one thing the portal never does is move the page sideways (WCAG 2.2 SC
       1.4.10, ADL A7), and the calendar was doing it: measured on 23.08.2026 on a
       360px phone at 200% text, **the page itself** scrolled 80px.

       A grid item refuses to shrink under its own `min-content` unless it is told
       to, and under 780px the month is one column, so the longest event name of the
       month set the width of every day: 407,94px inside a box of 296px, which is
       `360 - 2 x 32` at 200% text, where the padding grows with the letters. (328
       is that same box at the default size; the two are not interchangeable, ADL
       A26.) Measured after: nothing moves at 100, 125, 150 or 200 per cent.

       Not claimed: that no content leaves its day. It does. At 780px a day with
       five length dots is 74,47px and the dots are 59,98px, overflowing by 11,52px
       onto the frame of the next day; five days in the archive have that many.
       Written down and waiting, because without this line the page itself scrolls
       179px, which is worse for the same reader.

       Held on `.day` and not on the grid, because the grid is what asks and the item
       is what refuses. */
    expect(
      ruleFor(calendar, '.day', 'Calendar.css').getPropertyValue('min-inline-size'),
      'a day cannot be narrower than the longest name in it, so the month pushes the page',
    ).toBe('0px')
  })
})
