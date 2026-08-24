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
  it('may be narrower than the longest name in it, down to what it carries', () => {
    /* The one thing the portal never does is move the page sideways (WCAG 2.2 SC
       1.4.10, ADL A7), and the calendar was doing it: measured on 23.08.2026 on a
       360px phone at 200% text, **the page itself** scrolled 80px, and with no floor
       at all it scrolls on 266 of 480 measured combinations of width, zoom and
       month, at 1560px on 200% by as much as 548px.

       A grid item refuses to shrink under its own `min-content` unless it is told
       to, so the longest event name of the month set the width of every day:
       407,94px inside a box of 296px, which is `360 - 2 x 32` at 200% text, where
       the padding grows with the letters. (328 is that same box at the default size;
       the two are not interchangeable, ADL A26.)

       **The value is measured, and both of its parts are.** What has to fit inside a
       day is five length dots and the gap before them, drawn in the reader's own
       letters, **plus the pixels that are not**: one of the day's border and the
       tile's left edge. A floor written wholly in `rem` is right at exactly one size
       of text, and that is not a detail: `5.5rem` removed the overflow and brought
       the page scroll back, 38px at 1560px on 200% text, on every one of the 216
       months, because the grid gets `.shell__main` and its `max-width: 1100px` is in
       pixels and does not grow with the letters. `calc(5.125rem + 4px)` gave zero of
       both across all 216 months at 1560/200% and across 72 further combinations.

       Seven and not four since 24.08.2026: the tile's edge is three pixels on a race
       and six on a gathering or a training, so that a reader who cannot separate two
       colours still sees which tile is not a race. Measured on the fullest day at
       780/100%, sitting exactly on the old floor of 86px: as a race the dots ended
       0,02px inside the day, the same tile as a training ran 2,98px outside it.

       Asked as the string the parser gives back, which puts the pixels first: jsdom
       normalises `calc()` and reorders its terms, so what is written in the sheet
       and what is read out of it are not the same characters. */
    const day = ruleFor(calendar, '.day', 'Calendar.css')

    expect(day.getPropertyValue('min-inline-size')).toBe('calc(7px + 5.125rem)')
  })
})
