import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor, ruleInMedia, unconditionalRules } from '../test/stylesheet'

/**
 * One arrangement of the month that no rendered test can see.
 *
 * jsdom lays nothing out and applies no stylesheet (ADL A18), so what is asked here
 * is that the rule is written and declares what it is meant to declare. Whether it
 * wins is a question for a browser, and the numbers below are what was measured
 * there.
 */
const calendar = readFileSync(join(process.cwd(), 'src/pages/Calendar.css'), 'utf-8')

/* The portal's own sheet, for the one rule `ADL.md` A7 names by name: hiding by width
   is done with „ista pravila koja nosi `visually-hidden`", so what those rules are is
   a question for that sheet rather than for a copy of them kept here. */
const portal = readFileSync(join(process.cwd(), 'src/index.css'), 'utf-8')

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

/**
 * WHAT MAKES THE PIECES OF A BAR ONE BAR (PDL P35, 21.09.2026).
 *
 * A multi-day event is drawn as one piece per day, each inside its own day, and the
 * sheet is what makes them meet: a piece that does not start the bar reaches back over
 * the gap into the day before it and draws no end there. jsdom lays nothing out, so
 * what is asked here is that the declarations are written and are written **where they
 * only apply to a grid**; whether they meet was measured in a browser.
 */
const WIDE = '(min-width: 48.75em)'

describe('a bar across several days', () => {
  it('reaches back over the gutter, and by the very tokens the gutter is made of', () => {
    /* From the content edge of this day leftwards to the content edge of the one
       before it: this day's padding, this day's border, the gap between the two, the
       other day's border, the other day's padding. Three gaps and two borders, out of
       the tokens `.day` and `.calendar__grid` are themselves set from.

       **Asked as the whole declaration**, which is the lesson the floor above paid for:
       asked for as a term, `4px` is satisfied by `4px * 6`, and neither a multiplier nor
       a sign is a piece of text at all. A reach written as a number is a reach that is
       right at one size of text and wrong at every other, and it would leave a bar with
       a seam through it or hanging over the day before. */
    expect(ruleInMedia(calendar, WIDE, '.chip--continues', 'Calendar.css').getPropertyValue(
      'margin-inline-start',
    )).toBe('calc(-3 * var(--space-8) - 2px)')

    /* And the three pixels that say „a tile begins here" go, or the bar carries a
       coloured bar through its own middle once a day. The face fills them, because the
       margin places the border box whether the border is painted or not. */
    expect(
      ruleInMedia(calendar, WIDE, '.chip--continues', 'Calendar.css').getPropertyValue(
        'border-inline-start-width',
      ),
      'jsdom writes a bare nought back as 0px',
    ).toBe('0px')
    /* The same mark by the other method, which is how a gathering and a training wear
       it (`Calendar.css`). Left standing, those two kinds would show it and a race
       would not, which is one bar drawn two ways. */
    expect(
      ruleInMedia(calendar, WIDE, '.chip--continues', 'Calendar.css').getPropertyValue(
        'box-shadow',
      ),
    ).toBe('none')
  })

  it('moves the body of a stump out of sight and never takes it away', () => {
    /* **`ADL.md` A7, 31.07.2026, in so many words:** „Kontrola koja menja natpis po
       širini ekrana mora zadržati oba natpisa u pristupačnom stablu … Skrivanje se radi
       pomeranjem van vidnog polja (ista pravila koja nosi `visually-hidden`), nikad
       uklanjanjem."

       This rule said `visibility: hidden` until 22.09.2026, which is removal, and the
       piece it stood on was `aria-hidden` besides. The two together read well above
       780px, where the piece is a mute stump, and below it left 26 tiles in the served
       calendar that looked like every other tile, could not be tapped and were not in
       the accessibility tree at all. The decision above was written after the same
       trick „ostavio šest dugmadi bez ijednog imena ispod 620px".

       **The floor under this is `.visually-hidden` itself**, read off `index.css` rather
       than written out here: the decision says „ista pravila koja nosi
       `visually-hidden`", so the thing that decides whether these are those rules is
       that rule and not a copy of it. A class cannot be added by a media query, so the
       declarations have to be repeated; what must not happen is that they drift. */
    const recipe = ruleFor(portal, '.visually-hidden', 'index.css')
    const stump = ruleInMedia(calendar, WIDE, '.chip--continues > :not(.chip__hold)', 'Calendar.css')
    const named = [...recipe].sort()

    /* The floor under the floor: a rule that declared nothing would make every check
       below vacuous, and so would one somebody reduced to a single property. */
    expect(named.length, '.visually-hidden in index.css declares nothing').toBeGreaterThan(5)

    for (const property of named) {
      expect(
        stump.getPropertyValue(property),
        `the stump says something else than .visually-hidden does about ${property}`,
      ).toBe(recipe.getPropertyValue(property))
    }

    /* And it removes nothing, which is the half the properties above cannot say:
       `visibility: hidden` and `display: none` each take the name out of the
       accessibility tree while every rule above is still written. */
    expect(stump.getPropertyValue('visibility'), 'the body is removed, not moved').toBe('')
    expect(stump.getPropertyValue('display'), 'the body is removed, not moved').toBe('')
  })

  it('keeps a held lane off a telephone and gives it its line back on a grid', () => {
    /* A held lane is the one thing in a day that carries no word at all, so it is the
       one thing the sheet may take away outright. Below the grid there is nothing for
       it to hold in line: the days stand one under another, and on 2 June 2019 it drew
       an empty band the width of the page and spent one of the day's five lines on it.

       Read at both ends, because either one alone says nothing: taken away everywhere,
       the bar under it climbs a row on the grid and breaks in the middle of itself. */
    expect(ruleFor(calendar, '.chip--hollow', 'Calendar.css').getPropertyValue('display')).toBe(
      'none',
    )

    const onGrid = ruleInMedia(calendar, WIDE, '.chip--hollow', 'Calendar.css')

    expect(onGrid.getPropertyValue('display')).toBe('flex')
    expect(onGrid.getPropertyValue('visibility')).toBe('hidden')

    /* The space that holds a stump as tall as a tile goes the same way round, and for
       the same reason: it says nothing, and below the grid a continuing piece is a
       whole tile that this would only widen. */
    expect(ruleFor(calendar, '.chip__hold', 'Calendar.css').getPropertyValue('display')).toBe(
      'none',
    )
    expect(
      ruleInMedia(calendar, WIDE, '.chip--continues > .chip__hold', 'Calendar.css').getPropertyValue(
        'display',
      ),
    ).toBe('inline')
  })

  it('reaches nowhere at all below the width where there is a grid', () => {
    /* **This is the one that costs a page if it is wrong.** Below 48.75em the month is
       one column of days, so there is no day to the left to reach into: the reach would
       pull the tile out of the page and the page would scroll sideways, which is the
       one thing the portal never does (WCAG 2.2 SC 1.4.10, ADL A26).

       Asked as „no unconditional rule carries these" rather than as „the query holds
       them", because those are different claims and only this one fails when somebody
       copies the rule out of the query and leaves it at the top of the sheet. */
    const loose = unconditionalRules(calendar, 'Calendar.css').map((rule) => rule.selectorText)

    expect(loose).not.toContain('.chip--continues')
    expect(loose).not.toContain('.chip--continues > :not(.chip__hold)')
    expect(loose).not.toContain('.chip--runs-on')
  })

  it('draws no end where it runs into the next day', () => {
    const runs = ruleInMedia(calendar, WIDE, '.chip--runs-on', 'Calendar.css')

    expect(runs.getPropertyValue('border-start-end-radius')).toBe('0px')
    expect(runs.getPropertyValue('border-end-end-radius')).toBe('0px')
  })

  /* What stood here measured only that a held lane is hidden rather than removed, and
     that was half the question: it said nothing about the width, so it was green while
     the lane was drawn as an empty band across a telephone. The case „keeps a held lane
     off a telephone and gives it its line back on a grid" above reads both ends. */
})
