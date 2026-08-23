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
  it('may be narrower than the longest name in it, down to the dots it carries', () => {
    /* The one thing the portal never does is move the page sideways (WCAG 2.2 SC
       1.4.10, ADL A7), and the calendar was doing it: measured on 23.08.2026 on a
       360px phone at 200% text, **the page itself** scrolled 80px, and with no floor
       at all 266 of 480 measured combinations of width, zoom and month scroll it,
       the worst by 279px.

       A grid item refuses to shrink under its own `min-content` unless it is told
       to, so the longest event name of the month set the width of every day:
       407,94px inside a box of 296px, which is `360 - 2 x 32` at 200% text, where
       the padding grows with the letters. (328 is that same box at the default size;
       the two are not interchangeable, ADL A26.)

       **A floor and not nought, which is a correction.** Written as `0` first, and a
       round measured what that cost: a day could then be narrower than the row of
       length dots inside it, and neither the name nor the dots wrap. July 2015 at
       1440px and 150% text had no page scroll at all and the line pushed five dots
       20,42px past the edge of their day; at 1560px and 200% text seven days
       overflowed, the worst by 65,80px. The fullest tile there is asks for 5,25rem
       and the floor is 5,5rem; measured after, at 765px of content the same day
       neither overflows nor scrolls the page, and at 4rem it stood 11,52px over.

       Seven columns of 5,5rem plus six gaps are 44,5rem, and the grid begins at
       48,75em, so the floor fits the narrowest grid there is at any size of letters:
       both are drawn in the reader's own, which is why the floor is in `rem` and not
       in pixels. */
    const day = ruleFor(calendar, '.day', 'Calendar.css')

    expect(day.getPropertyValue('min-inline-size')).toBe('5.5rem')
  })
})
