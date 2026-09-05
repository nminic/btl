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
    const row = ruleFor(calendar, '.chip__lengths', 'Calendar.css')

    /* **Asked as the whole declaration, not as pieces of its text.** Every check
       written over parts of it let a wrong floor through: `4px` asked for as a term
       is satisfied by `4px * 6`, a ban on units written beside it is blind to
       `+ 4px + 14px` once the four are taken out of the string, and neither a
       multiplier nor a sign is a piece of text at all — measured, those four give a
       day of 106, 100, 94 and 42 pixels with the check green (review, 05.09.2026).
       A day of 42px is below anything this floor was ever measured for, and without
       a floor the page scrolls sideways on 266 of 480 measured combinations
       (ADL A26), which is what it exists to prevent.

       The cost is that a deliberate reformatting of this line is a change here too.
       That is the same cost every snapshot in this portal pays, and it is paid at
       the moment of writing. */
    expect(day.getPropertyValue('min-inline-size')).toBe(
      'calc(var(--length-dots-row) + var(--space-6) + 2 * var(--space-8) + 4px)',
    )

    /* **The row of dots is one name, and the ceiling over it reads the same one.**
       Two rules are that width and they are not in one subtree, so the name lives in
       the token file: read from the row's own rule, it is undefined where the floor
       reads it, the whole declaration is invalid, and the day has no floor at all
       (measured in a browser, 05.09.2026). Written out in both, „five dots and four
       gaps" was one fact in two hands and the two could come apart with the gate
       green (review, 05.09.2026). */
    expect(row.getPropertyValue('max-inline-size')).toBe('var(--length-dots-row)')

    /* And the row **spaces itself from that same gap**, which is a different fact
       from „the gap is not named here" and the one that matters: written
       `gap: var(--space-4)`, nothing is declared on this rule either, and the row is
       spaced out of one name while the ceiling counts it out of another. Raising the
       shared token then widens the gaps without widening the ceiling, and five dots
       break into two lines, which is the very thing this rule exists to prevent
       (review, 05.09.2026). */
    expect(row.getPropertyValue('gap')).toBe('var(--dot-gap)')
    expect(
      row.getPropertyValue('--dot-gap'),
      'the gap is named in tokens.css, not on the row',
    ).toBe('')
  })
})
