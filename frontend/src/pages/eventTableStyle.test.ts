import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../test/at'
import { ruleFor, ruleInMedia, rulesInMedia, unconditionalRules } from '../test/stylesheet'

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

/**
 * The two numbers the width of the race table is made of, read out of the rule
 * rather than written here a second time.
 *
 * Anchored at both ends on purpose. Held as „the value contains `min(100%` and
 * contains `7.5rem`" for one day, and a round put back exactly the fault the rule
 * was written for: `min(100%, calc(var(--race-columns) * 7.5rem))` carries both of
 * those strings, turns the floor into a second ceiling, and left this file green
 * while the button „Unesi rezultat" stood 70,78px outside its cell at 200% text.
 * A rule of any other shape does not match here, and the failure says so.
 */
const SHAPE =
  /^max\( min\(100%, calc\(var\(--race-columns\) \* 100% \/ var\(--race-full\)\)\), calc\(var\(--race-columns\) \* ([\d.]+)rem\) \)$/

/**
 * The share of the box one column takes while the ceiling wins, and the width a
 * column may never fall under, in `rem`.
 *
 * The share is no longer a number in the sheet. It was a fifth written by hand, and
 * a round measured what that cost once the count could reach six: on an event over
 * two mornings the visitor's five columns and the member's six were both the whole
 * box, so nothing stayed where it was and the first column moved by up to 35,59px.
 * How many columns the fullest reading has is now worked out beside the count itself
 * (`EventDetail.tsx`), so what is read here is the **relationship**: one column is
 * one part of however many parts there are.
 */
function knobs(): { share: number; floor: number } {
  /* In the query that says every column is drawn, and named as such: under 700px
     the climb and the descent are hidden (styles/table.css), so a width worked out
     from the count of columns would describe a table that is not there. */
  const races = ruleInMedia(profile, '(min-width: 700px)', '.table.table--races', 'Profile.css')
  const written = races.getPropertyValue('inline-size').replace(/\s+/g, ' ').trim()
  const read = SHAPE.exec(written)

  expect(read, `the width reads \`${written}\`, which is not a shape this guard knows`).not.toBeNull()

  const [, floor] = must(read, 'the width of the race table')

  /* One part of however many the fullest reading has. Six is what `EventDetail.tsx`
     hands over for an event that runs over more than one morning, which is the widest
     this table ever gets. */
  return { share: 100 / 6, floor: Number(floor) }
}

/** What that rule works out to, in px, for a box of `box` px at a root of `root`. */
function widthOf(
  { share, floor }: { share: number; floor: number },
  columns: number,
  box: number,
  root: number,
): number {
  return Math.max(Math.min(box, (columns * share * box) / 100), columns * floor * root)
}

/**
 * How wide the column of content is, read off the shell rather than written here.
 *
 * `.shell__main` is what every screen draws inside, and it carries both numbers:
 * `padding-inline` on each side, and a `max-width` past which the column stops
 * growing. Written by hand as „32" for a day, and a round measured the cost on
 * 23.08.2026: one step of the scale added to that padding put 11px of the race table
 * outside its box at a screen of 700, on the ordinary text size, while this guard
 * said nothing.
 *
 * The padding is a token, so the token is read too. Both come back in pixels at a
 * 16px root, which is the size every sum here is written at.
 */
function shellBox(): { padding: number; ceiling: number } {
  const shell = readFileSync(join(process.cwd(), 'src/app/Shell.css'), 'utf-8')
  const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')
  const main = must(
    unconditionalRules(shell, 'Shell.css').find((rule) =>
      rule.selectorText.split(',').some((one) => one.trim() === '.shell__main'),
    ),
    'the rule every screen is drawn inside',
  ).style
  const named = main.getPropertyValue('padding-inline').replace('var(', '').replace(')', '')
  const step = must(new RegExp(`${named}:\\s*([\\d.]+)rem`).exec(tokens), `the token ${named}`)
  const ceiling = must(/^(\d+)px$/.exec(main.getPropertyValue('max-width')), 'the ceiling')

  return { padding: Number(step[1]) * 16 * 2, ceiling: Number(ceiling[1]) }
}

describe('the table of races on an event', () => {
  it('is laid out in columns of one width', () => {
    expect(
      ruleInMedia(profile, '(min-width: 700px)', '.table.table--races', 'Profile.css')
        .getPropertyValue('table-layout'),
    ).toBe('fixed')
  })

  it('gives a column the same width whether or not the way in is drawn', () => {
    /* Owner, 23.08.2026: „tabela ostaje kraca za tu kolonu, pa se prethodne cetiri
       zavrsavaju gde i kad ih ima 5". A column takes one part of however many parts
       the fullest reading of that event has, so the table simply stops short of the
       box when a column is missing rather than spreading the rest over it.

       Asked of both readings the portal can draw. An event of one morning goes from
       four to five, and one of more than one from five to six; a round measured that
       asking only about the first hides the second, because a share written as one
       fifth is right for the one and wrong for the other, and on the two-morning
       event the first column moved by up to 35,59px. */
    const read = knobs()

    /* To within a rounding step, because a sixth of a thousand is not a number that
       ends: what is asked is that the width per column is the same, not that two
       floating point sums are the same bits. */
    expect(widthOf(read, 5, 1000, 16) / 5, 'a column of five is not a column of six').toBeCloseTo(
      widthOf(read, 6, 1000, 16) / 6,
      9,
    )
    expect(widthOf(read, 4, 1000, 16) / 4).toBeCloseTo(widthOf(read, 5, 1000, 16) / 5, 9)
    /* And the fullest reading fills the box exactly: six parts of six. */
    expect(widthOf(read, 6, 1000, 16), 'the fullest table does not fill its box').toBe(1000)
  })

  it('stays inside its box at the ordinary text size', () => {
    /* The fault a round measured on 23.08.2026 and the reason the floor is not a
       number picked to be safe: at 7,5rem, an event over two mornings read by a
       signed-in member is six columns of 120px, which is 720px of table against
       668px of box at a screen of 700. 55px of it stood outside, the „Unesi
       rezultat" button was what stood there, and the page did not scroll, so
       nothing on the screen said anything had been cut.

       Worked out rather than rendered, because jsdom lays nothing out (ADL A18)
       and a browser shows one width at a time. The arithmetic is `max`/`min`/`calc`
       and nothing else, and it was held against Chrome on this branch at both ends
       of the range: 668px of table in 668px of box at 700, and 1068 in 1068 at
       1280. Both agreed to the pixel.

       Every count of columns the render can produce (EventDetail.tsx: four, five or
       six) and every box from the narrowest the query covers up to a wide desk.

       The box is the screen less the shell's padding **and less the scrollbar**.
       `index.css` sets `scrollbar-gutter: stable` on the root, so the room is
       reserved whether or not the page is long enough to need it, and a round
       measured on 23.08.2026 what leaving it out costs: with the box read as
       `screen − 32`, a floor of 6,9rem passed this guard and put 9,39px of the
       table outside its box at a screen of 700 on the ordinary text size, with the
       „Unesi rezultat" button cut. Measured in Chrome on Windows: 653px of box at
       a screen of 700, 721 at 768, 1068 at 1280, none of them `screen − 32`.

       17 and not the 15 that Chrome on Windows draws, because the widest classic
       scrollbar among the engines is what makes this hold everywhere; a browser
       with overlay scrollbars reserves nothing and has more room than this asks
       for, never less.

       The padding and the ceiling are **read from the shell** rather than written
       here. Held as a bare 32 for a day, and a round measured what that costs on
       23.08.2026: widen `.shell__main` by one step of the scale and the table stands
       11px outside its box at a screen of 700 on the ordinary text size, with this
       guard silent. The ceiling matters at the other end: past 1132px the column
       stops growing, so a screen of 1920 has the room of 1100 and no more. */
    const read = knobs()
    const GUTTER = 17
    const shell = shellBox()
    const room = (screen: number) => Math.min(screen - GUTTER, shell.ceiling) - shell.padding
    const tooWide = []

    for (const columns of [4, 5, 6]) {
      for (let screen = 700; screen <= 1920; screen += 1) {
        const box = room(screen)

        if (widthOf(read, columns, box, 16) > box) {
          tooWide.push(`${columns} columns at ${screen}px`)
        }
      }
    }

    expect(tooWide).toEqual([])
  })

  it('holds the widest date unbroken wherever the floor wins', () => {
    /* What the floor is for. Both sides of it are `rem`, so one measurement at a
       16px root holds at every text size: „31. 12. 2022." is 88,17px of type, and
       the cell keeps var(--space-8) either side, which is 1rem of the column. */
    const DATE = 88.17 / 16
    const CELL = 1

    expect(knobs().floor - CELL, 'a column at the floor breaks the date in two').toBeGreaterThanOrEqual(
      DATE,
    )
  })

  it('is narrower than the button in it, which is why the button folds', () => {
    /* The two rules are one arrangement and this is the seam between them. „Unesi
       rezultat" on one line is 114,75px at a 16px root, more than a column at the
       floor has to give, so the button has to fold; folded it needs 76,86px and
       fits. Raising the floor to hold it unbroken is the other way out and it is
       the wrong one: 8,17rem puts six columns at 785px against 668px of box, which
       is the scroll the test above refuses.

       The fold is written outside the query, because under 700px the table is laid
       out by its content instead and the column grows for the button rather than
       cutting it. It grows the table with it: measured on a 360px screen, the box
       scrolled 41px with the button on one line and 3px with it folded. */
    const BUTTON = 114.75 / 16
    const FOLDED = 76.86 / 16
    const CELL = 1
    const { floor } = knobs()
    const button = ruleFor(profile, '.table--races .button--compact', 'Profile.css')

    expect(floor - CELL).toBeLessThan(BUTTON)
    expect(floor - CELL).toBeGreaterThanOrEqual(FOLDED)
    expect(button.getPropertyValue('white-space'), 'the button cannot fold').toBe('normal')
    /* And a height that grows with the second line. `.button--compact` is 2,4rem
       tall exactly, and left alone the two lines write themselves over the border
       of their own button. */
    expect(button.getPropertyValue('block-size'), 'the second line has nowhere to go').toBe('auto')
    expect(button.getPropertyValue('min-block-size')).toBe('2.4rem')
  })

  it('folds its headings on a phone as well, where the table grows instead', () => {
    /* Written inside the query for one day, and a round measured what that cost:
       at 360px „KATEGORIJA TRKE" on one line took 121,33px of a table 331px wide
       in a box of 313, so 18px stood outside and what was cut was the „Unesi
       rezultat" button. PDL P24 forbids a table that scrolls sideways on a phone
       at the ordinary text size. Measured after: 313 in 313.

       Held as „unconditional", which is the whole of the change: `ruleFor` refuses
       a rule that lives inside a query (test/stylesheet.ts), so putting it back
       under `min-width: 700px` fails here. */
    expect(ruleFor(profile, '.table.table--races th', 'Profile.css').getPropertyValue('white-space'))
      .toBe('normal')
  })

  it('lets the cells keep their words whole under 700px', () => {
    /* The other half of it, and the reason breaking is not the answer on a phone:
       a fixed column above 700px cannot grow, so a word longer than it has to
       break; under 700px the table grows and the box scrolls instead, which is
       what every table on the portal does above the ordinary text size. Measured
       with the cells breaking there too: at 200% the date „14. 3. 2022." came
       apart into ten pieces to make the table fit. */
    const breaking = (rules: { selectorText: string }[]) =>
      rules
        .map((rule) => rule.selectorText.replace(/\s+/g, ' '))
        .filter((one) => one.includes('.table.table--races td'))

    expect(
      breaking(rulesInMedia(profile, '(min-width: 700px)', 'Profile.css')),
      'the cells no longer break their words even where a column cannot grow',
    ).toEqual(['.table.table--races th, .table.table--races td'])
    expect(
      breaking(unconditionalRules(profile, 'Profile.css')),
      'the cells break their words everywhere, dates on a phone included',
    ).toEqual([])
  })
})

describe('the head of a competitor', () => {
  it('keeps the face beside the name until the text is twice its size', () => {
    /* Owner, 23.08.2026: „sa leve strane povelika okrugla slika". A flex line
       breaks on the hypothetical size of its items and not on what they could
       shrink to, so a basis of `auto` reads the whole line under the name and asks
       for more than a phone has: measured on the 313px a 360px phone really gives,
       the circle stood above the name at 100%, 125%, 150% and 200% alike.

       A basis of 8rem is the block's own smallest usable width rounded down to the
       scale: its `min-content` is 129,73px at a 16px root and 8rem is 128. A hair
       under, on purpose and at no cost, because `min-inline-size: 0` lets the block
       shrink past its basis anyway and the basis is read for whether the row breaks
       rather than for how narrow the block may get. Measured after: beside the name
       at 100%, 125% and 150%, and above it at 200%, where breaking is what keeps the
       page from scrolling sideways. */
    const identity = ruleFor(profile, '.profile__identity', 'Profile.css')

    expect(identity.getPropertyValue('flex-basis'), 'the row breaks on the length of the line')
      .toBe('8rem')
    expect(identity.getPropertyValue('flex-shrink')).toBe('1')
  })

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
