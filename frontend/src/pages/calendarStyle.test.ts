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

       Four, and it stayed four when the tiles of a gathering and a training took a
       wider edge on 24.08.2026. It was raised to seven for a day, since a border of
       six pixels makes the tile three wider and the day three wider again. Measured,
       that cost more than it bought: at 1560px on 200% text the page began to scroll
       sideways by 3px, which is what this floor exists to prevent. The wider edge is
       painted inside the tile instead, so the tile keeps its width and four goes on
       describing it.

       **[ISPRAVLJENO 05.09.2026] The number is gone and the tokens are here.** The
       floor read `calc(4px + 5.125rem)`, and this line held those characters, so the
       four tokens the paragraph above describes were a fact with no reader: raising
       `--length-dot-size` moved the row of dots and left the floor where it was, and
       the whole suite stayed green (review, 30.08.2026). Measured in a real browser
       on 05.09.2026: with the floor written out, the dot raised to `0.9rem` left the
       day at 86px; read off the tokens, the same day answers 114px. The arithmetic is
       unchanged at today's values — 5 × 0,55 + 4 × 0,25 + 0,375 + 2 × 0,5 = 5,125rem,
       and the browser says 86px either way.

       Asked as the four names rather than as one string: jsdom hands back whatever
       the sheet wrote, whitespace and all, so a comparison against the whole
       declaration would fail the next time anybody reformats it. What must not
       disappear is that each of the four is read. */
    const day = ruleFor(calendar, '.day', 'Calendar.css')
    const floor = day.getPropertyValue('min-inline-size')

    for (const token of ['--length-dot-size', '--dot-gap', '--space-6', '--space-8']) {
      expect(floor, token).toContain(`var(${token})`)
    }

    /* And the four pixels of borders, which are not letters and do not grow with
       them. Written as a number because that is what they are. */
    expect(floor).toContain('4px')
    /* And no number of letters written out beside them: the whole fault was a size
       in `rem` that nothing kept in step with the tokens it copied. */
    expect(floor).not.toMatch(/[\d.]+rem/)
  })
})
