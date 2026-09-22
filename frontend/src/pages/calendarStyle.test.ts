import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../test/at'
import { cutsIn, everyRule, ruleFor, ruleInMedia, rulesInMedia, unconditionalRules } from '../test/stylesheet'

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

/**
 * A declaration with the spaces taken out of it, for the three arithmetics below.
 *
 * **Not the same cost the floor under a day pays**, and the difference is who does the
 * spacing. That one is compared as it is written, because nobody but a person touches
 * it. These three are read back through jsdom, which writes `3 * var(--x)` out as
 * `3*var(--x)`, and one of them is long enough that the formatter decides where it
 * breaks: both are facts about a tool. Every name, number, sign and multiplier is still
 * compared, which is the whole of what a wrong arithmetic would differ in.
 */
const written = (declaration: string) => declaration.replaceAll(/\s+/g, '')

/**
 * The one rule of the grid's media query written for exactly this list of selectors.
 *
 * `ruleInMedia` compares the selector as a string, and a rule written for two selectors
 * keeps the newline between them in `selectorText`: the guard would then be a guard over
 * how the sheet is laid out. What is being held here is WHICH selectors the rule is for,
 * so the list is read as a list.
 */
function ruleForAll(selectors: string[]): CSSStyleDeclaration {
  const asList = (text: string) =>
    text
      .split(',')
      .map((one) => one.trim().replaceAll(/\s+/g, ' '))
      .sort()
  const wanted = asList(selectors.join(','))
  const found = rulesInMedia(calendar, WIDE, 'Calendar.css').filter(
    (rule) => String(asList(rule.selectorText)) === String(wanted),
  )

  expect(found.length, `${selectors.join(', ')} is not one rule of ${WIDE}`).toBe(1)

  return must(found[0], 'the rule').style
}

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
       a seam through it or hanging over the day before.

       **[ISPRAVLJENO 22.09.2026] Counted once and read twice.** The reach and the width
       of the name written across a run are the same arithmetic over the same tokens, and
       written out in both places they are one fact in two hands: the reach moves, the
       name does not, and the suite stays green while the name runs off the end of its
       bar. It is the fault `--length-dots-row` and `--dot-gap` were named for on
       05.09.2026, one sheet over. So the tokens are counted into `--bar-reach` on the
       grid and both rules read that, and what is asked here is both halves: that the
       name says what it is made of, and that the reach is nothing but the name. */
    expect(
      written(ruleFor(calendar, '.calendar__grid', 'Calendar.css').getPropertyValue('--bar-reach')),
    ).toBe(written('calc(3 * var(--space-8) + 2px)'))
    expect(ruleInMedia(calendar, WIDE, '.chip--continues', 'Calendar.css').getPropertyValue(
      'margin-inline-start',
    )).toBe('calc(-1 * var(--bar-reach))')

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
    /* **And the two selectors ARE half the claim of the case below**, asked for here by
       name: the NAME is moved out of sight wherever the piece does not OPEN the run, and
       the DOTS wherever it does not END it. Written over `.chip--scale` at large, or with
       the two swapped, the name would be drawn on every piece and the dots on every day,
       which is the shape the owner said it should not have. */
    const stump = ruleForAll(['.chip--continues .chip__name', '.chip--runs-on .chip__lengths'])
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

  it('writes one name across the whole run and puts the dots at its far end', () => {
    /* Owner, 22.09.2026: „naziv pise preko cele strafte, dok su tacke skroz na desnom
       kraju iste." The two halves are one claim and are read together, because each of
       them alone is satisfied by a bar that draws the other thing everywhere.

       Which piece hides what is read by the case above, by asking for that rule's two
       selectors by name. What is left is the two rules that put each of the two where
       the owner asked. */
    const dots = ruleInMedia(calendar, WIDE, '.chip--continues .chip__lengths', 'Calendar.css')

    /* Against the right edge of the piece that ends the run. `auto` and not a length,
       because what the dots are pushed away from is the start of a box as wide as a
       column of the month, and no number describes that. */
    expect(dots.getPropertyValue('margin-inline-start')).toBe('auto')

    const name = ruleInMedia(
      calendar,
      WIDE,
      '.chip--scale.chip--runs-on:not(.chip--continues) .chip__name',
      'Calendar.css',
    )

    /* **AND IT STOPS WHERE ITS OWN BAR STOPS** (owner, 22.09.2026): „Ime pocinje na
       levom kraju trake i sme da tece preko narednih dana, ali se **zaustavlja tamo gde
       pocinju tacke**, sa trotackom ako je predugo."

       What stood here until that sentence was `overflow: visible` with `text-overflow:
       clip` and no width at all, so the only thing that stopped the name was the edge of
       the month. Measured at 1024px on the served calendar with a name of 120
       characters, which is what the form allows: the ink ended **282,67px past the end
       of its own bar**, over the tile of an unrelated event two days later, and
       `document.elementFromPoint` 20px inside that tile answered with THIS name, so the
       click opened the wrong event.

       **Asked as the whole declaration**, which is the habit this sheet already pays
       for twice over (the floor under a day, the reach of a continuing piece): asked as
       terms, a width is satisfied by the same names in the wrong arithmetic, and neither
       a multiplier nor a sign is a piece of text at all. A width that is too large by
       one term is a name over somebody else's tile again.

       `jsdom` lays nothing out, so what is asked here is that the declaration stands.
       What it is worth was measured in a browser on 22.09.2026: at 1024px the name ends
       71px inside its own bar, at 1440px on 200% text 145px inside it, and at 360, 390
       and 768 there is no run at all and the rule does not apply.

       **Read with the spaces taken out, and that is not the same cost the floor under a
       day pays.** That one is compared as it is written because nobody but a person
       touches it; this line is long enough that the formatter breaks it, and where it
       breaks is a fact about the formatter. Every name, number, sign and multiplier is
       still here, which is the whole of what a wrong width would differ in. */
    expect(written(name.getPropertyValue('inline-size'))).toBe(
      written('calc(var(--run-days) * (100% + var(--bar-day)) - var(--bar-day) - var(--length-dots-row) - var(--space-6))'),
    )
    /* And how much a further day of the bar is worth, read off the grid rather than out
       of this line, and out of the reach the pieces already meet by. */
    expect(
      written(ruleFor(calendar, '.calendar__grid', 'Calendar.css').getPropertyValue('--bar-day')),
    ).toBe(written('calc(var(--bar-reach) + 3px + 2 * var(--space-8))'))

    /* **`flex: none`, or the width above is a ceiling on something that never grows to
       meet it.** `.chip__name` is `flex: 1`, a basis of nought that takes the room its
       own tile has; a wider `inline-size` beside that basis changes nothing at all, and
       the name goes on being cut at the edge of its day. Measured both ways in a browser
       on 22.09.2026: with the basis left alone the name box is 64,94px wide on a
       four-day bar, with `flex: none` it is 324,88px.

       **Asked as the three parts that matter and not as the word**, since `flex: none`
       is three values in a coat: a basis that is not nought is what a width needs to
       size the box, no growing keeps the tile from handing it room of its own on top,
       and no shrinking is the part that actually holds that width once drawn. Measured
       in a browser on 22.09.2026: `flex: none` replaced with exactly the other two terms
       this case already asked for, `flex-grow: 0; flex-basis: auto`, and shrink left at
       its default of 1, still satisfies both expectations below, and the name box
       computes to 63,97px against the 328,75px `flex: none` draws, cut 334,94px before
       the end of its own bar. That is the same break this rule exists to fix. Any one of
       the three left out leaves the fault: a basis of nought grows to the tile regardless
       of the width, growth left on hands the tile's spare room back to the box, and
       shrink left on lets the row crush the box back down the moment it runs short. */
    expect(name.getPropertyValue('flex-basis'), 'a basis of nought ignores the width').toBe('auto')
    expect(name.getPropertyValue('flex-grow'), 'the tile must not add room of its own').toBe('0')
    expect(
      name.getPropertyValue('flex-shrink'),
      'shrink is what actually holds the width once drawn; left at its default the row crushes it back down the moment it runs short',
    ).toBe('0')

    /* The ellipsis is NOT written here, and that is the point: it comes back from
       `.chip__name` itself, where the portal says once what a name does when it does not
       fit. The rule that stood here turned it off, which is why a bar cut at the right
       edge of a row was cut with no ellipsis at all. */
    expect(name.getPropertyValue('overflow'), 'the base rule is what clips').toBe('')
    expect(name.getPropertyValue('text-overflow'), 'the base rule is what elides').toBe('')

    const base = ruleFor(calendar, '.chip__name', 'Calendar.css')

    expect(base.getPropertyValue('overflow')).toBe('hidden')
    expect(base.getPropertyValue('text-overflow')).toBe('ellipsis')

    /* And drawn over the pieces rather than under them. A day is positioned with no
       z-index of its own, so it opens no stacking context, and a later day would paint
       its ground over a name that came out of an earlier one. Measured in a browser. */
    expect(name.getPropertyValue('position')).toBe('relative')
    expect(Number(name.getPropertyValue('z-index'))).toBeGreaterThan(0)
  })

  it('takes no day of the month off the screen', () => {
    /* **[ZAMENJUJE „lets nothing it draws leave the month sideways", 22.09.2026]** That
       case held `overflow-x: clip` on the month, and the rule it held was the fault.
       Written to bound a bar's name, it bounded the month: measured at 1440px on 200%
       text, March 2022, **eight day boxes** crossed the cut, every Sunday whole (236px
       gone out of a box 168px wide), page scroll **nought**, and nothing anywhere saying
       a day was missing. `ADL.md` A26, 23.08.2026, in so many words: „Strana se ne
       pomera, pa nista na ekranu ne kaze da je nesto odseceno. To je tacno ono sto PDL
       P24 zabranjuje."
     *
       The name is bounded by its own bar now, so there is nothing left for a cut to
       bound. Measured after taking it away, same screen and same month: page scroll 42px
       and **no day out of reach**; at 1024px on 200% text, 295px of page scroll and no
       day out of reach. What moves the page there is the floor under a day, which is
       `PDL.md` P24's own entry: a month with no bar in it at all gives the same 1272px
       of content in the same 1036px box, measured the same day.
     *
       **Asked of the whole sheet and not of the one rule**, and the classes are read out
       of `test/stylesheet.ts` rather than typed here. A guard naming `overflow-x` would
       have been green the day somebody wrote `overflow: clip`, and a guard naming
       `clip` green the day somebody wrote `hidden`: this asks what the keyword MEANS,
       and a keyword nobody has classified fails `styles/scale.test.ts` by name.
     *
       **The sheet does cut two boxes, and neither of them is a day**, so they are named
       with the reason, the way `styles/scale.test.ts` names what may be hidden. Anything
       else, on any selector, is a day of the month disappearing behind an edge. */
    const named = new Map([
      [
        '.chip__name',
        'a name too long for the tile it is in, cut onto an ellipsis. Nothing is lost: the whole of it is in the tile\'s `title` and on the day\'s own page, and the ellipsis says out loud that there is more',
      ],
      [
        '.chip--continues .chip__name, .chip--runs-on .chip__lengths',
        'the recipe `.visually-hidden` carries, written out because a class cannot be added by a media query (`ADL.md` A7). It moves a body out of SIGHT and leaves it in the accessibility tree, and the case above holds that it really is that recipe',
      ],
    ])

    const cuts = everyRule(calendar, 'Calendar.css').flatMap((rule) =>
      [...rule.style]
        .filter((property) => property.startsWith('overflow'))
        .flatMap((property) =>
          cutsIn(`${property}: ${rule.style.getPropertyValue(property)};`)
            .filter((one) => one.cuts)
            .map(() => ({
              selector: rule.selectorText.replaceAll(/\s+/g, ' '),
              said: `${property}: ${rule.style.getPropertyValue(property)}`,
            })),
        ),
    )

    expect(
      cuts.filter((one) => !named.has(one.selector)).map((one) => `${one.selector} { ${one.said} }`),
    ).toEqual([])
  })

  it('says once, and in one place, that the dots stand at the far end of the run', () => {
    /* „Tacke skroz na desnom kraju iste" (owner, 22.09.2026) is held today by ONE
       declaration, `margin-inline-start: auto`, and a declaration is only ever as strong
       as the cascade around it. Measured 22.09.2026: a rule of greater weight written
       into this very sheet, `.chip--continues .chip__lengths { margin-inline-start: 0 }`,
       left the whole suite green (3019 passed) and moved the dots from 8px off the end
       of the bar back to 82,9px, which is its middle.
     *
       **The half about the NAME has a width to be asked for and this half has nothing**:
       `auto` against a box as wide as a column of the month is not a number, and jsdom
       lays nothing out (ADL A33). `styles/lengthDots.test.ts` is this portal's record of
       what happens to a guard that stands in for geometry with a reading of the text:
       five drafts of one, each beaten by a longhand, a query or another sheet.
     *
       **So this does not read the geometry. It reads the CASCADE, which is text.** Every
       rule of this sheet that says anything at all about a margin on `.chip__lengths` is
       gathered through jsdom's own parser, queries and all, and there may be exactly the
       two that are meant to: the row pushed to the far end on a piece that continues a
       run, and the `-1px` that is part of moving a body out of sight where the piece
       does not END one. A third, wherever in the sheet it is written and whatever its
       weight, fails here.
     *
       **Its boundary, written down rather than left to be found:** a rule in ANOTHER
       sheet is not seen. `.chip__lengths` is written nowhere else today, and what a
       browser resolves is a question for a browser; what this holds is that the sheet
       the row is drawn by does not contradict itself. */
    const said = everyRule(calendar, 'Calendar.css')
      .filter((rule) => rule.selectorText.includes('.chip__lengths'))
      .flatMap((rule) => {
        const margins = [...rule.style].filter((property) => property.startsWith('margin'))
        /* The shorthand and the four sides it sets are ONE declaration: jsdom hands back
           `margin` and `margin-top` and the rest of them for a rule that wrote the
           shorthand, and reporting five is reporting the same `-1px` five times. The
           logical longhands are not among them, so `margin-inline-start` still answers
           for itself, which is the one this case exists for. */
        const whole = margins.includes('margin')

        return margins
          .filter((property) => !whole || !/^margin-(top|right|bottom|left)$/.test(property))
          .map(
            (property) =>
              `${rule.selectorText.replaceAll(/\s+/g, ' ')} { ${property}: ${rule.style.getPropertyValue(property)} }`,
          )
      })

    expect(said.sort()).toEqual([
      '.chip--continues .chip__lengths { margin-inline-start: auto }',
      '.chip--continues .chip__name, .chip--runs-on .chip__lengths { margin: -1px }',
    ])
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
    expect(loose).not.toContain('.chip--continues .chip__name, .chip--runs-on .chip__lengths')
    expect(loose).not.toContain('.chip--continues .chip__lengths')
    expect(loose).not.toContain('.chip--scale.chip--runs-on:not(.chip--continues) .chip__name')
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
