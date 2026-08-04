import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sr from '../i18n/sr.json'

/* The gold band that names a board, and the one thing about it no screen test
 * can see.
 *
 * Two widgets on the front page put their title on a block of gold: the top ten
 * and the column chart. The block is painted straight on the gold scale rather
 * than through a token that flips, so it is the same gold in both themes. Its
 * ink therefore has to be one value too.
 *
 * It was briefly not. A tidy-up replaced the literal ink with the token that
 * inks the gold disc, which is white on the light theme because the disc under
 * it is the deep gold-600. Over this band, on the light theme, that put white on
 * gold-400: 2,14:1, against the 4,5:1 that normal text owes (WCAG 2.2 SC 1.4.3).
 * It read as a tidy-up and it shipped as a defect, because nothing here fails
 * when a colour is merely wrong.
 *
 * jsdom computes no custom properties and paints no gradient, so the rules are
 * read as text and the arithmetic is done here. The gradient is measured at both
 * of its stops, because text sits across the whole band and not on its lightest
 * end (ADL A7).
 */

const BANDS = [
  { file: 'src/pages/Home.css', rule: '.top10__block .card__title' },
  { file: 'src/components/ColumnChart.css', rule: '.colchart__caption' },
]

const FLOOR = 4.5

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf-8')
}

/** The body of one rule, from its selector to the brace that closes it. */
function bodyOf(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`)
  expect(at, `${selector} is not in the stylesheet`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('}', at))
}

/** WCAG relative luminance of an `#rrggbb` colour. */
function luminance(hex: string): number {
  const linear = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (linear[0] as number) + 0.7152 * (linear[1] as number) + 0.0722 * (linear[2] as number)
}

function contrast(one: string, other: string): number {
  const [high, low] = [luminance(one), luminance(other)].sort((left, right) => right - left)
  return ((high as number) + 0.05) / ((low as number) + 0.05)
}

describe('the ink on the gold band', () => {
  const tokens = read('src/styles/tokens.css')

  /** The one value a token carries, and proof that it carries only one. */
  function value(name: string): string {
    const found = tokens.match(new RegExp(`${name}: (#[0-9a-f]{6});`, 'g')) ?? []
    /* Declared once, so the band is the same colour in both themes. A second
       declaration means somebody gave it a dark variant, and then the pairs
       below stop being the whole story and this test has to grow a theme. */
    expect(found, `${name} should be declared exactly once`).toHaveLength(1)
    return found[0]?.slice(-8, -1) as string
  }

  it('clears 4,5:1 against every stop of the band it is painted on', () => {
    const pairs: { rule: string; stop: string; ratio: number }[] = []

    for (const band of BANDS) {
      const body = bodyOf(read(band.file), band.rule)

      const ink = body.match(/color: var\((--[a-z-]+)\)/)?.[1]
      expect(ink, `${band.rule} sets no colour through a token`).toBeDefined()

      const stops = [...body.matchAll(/linear-gradient\([^)]*?((?:var\(--[a-z0-9-]+\)[,\s]*)+)/g)]
        .flatMap((match) => [...(match[1] ?? '').matchAll(/var\((--[a-z0-9-]+)\)/g)])
        .map((match) => match[1] as string)
      expect(stops.length, `${band.rule} paints no gradient through tokens`).toBeGreaterThan(1)

      for (const stop of stops) {
        pairs.push({
          rule: band.rule,
          stop,
          ratio: contrast(value(ink as string), value(stop)),
        })
      }
    }

    /* Nothing was found by accident: two rules, two stops each. Without this the
       whole test passes on an empty parse. */
    expect(pairs).toHaveLength(4)

    for (const pair of pairs) {
      expect(
        pair.ratio,
        `${pair.rule} on ${pair.stop} is ${pair.ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(FLOOR)
    }
  })

  it('measures what the old ink would have measured', () => {
    /* The arithmetic itself, against values worked by hand, so a mistake in it
       cannot quietly pass the test above. White on gold-400 is what shipped. */
    expect(contrast('#ffffff', '#d9ab2e')).toBeCloseTo(2.14, 2)
    expect(contrast('#ffffff', '#b8901f')).toBeCloseTo(2.98, 2)
    expect(contrast('#3a2a02', '#d9ab2e')).toBeCloseTo(6.49, 2)
    expect(contrast('#3a2a02', '#b8901f')).toBeCloseTo(4.66, 2)
  })
})

describe('the name that has to be cut', () => {
  it('leaves the focus ring more room than it reaches', () => {
    const home = read('src/pages/Home.css')
    const index = read('src/index.css')

    const width = Number(index.match(/outline: (\d+)px solid/)?.[1])
    const offset = Number(index.match(/outline-offset: (\d+)px/)?.[1])
    expect(Number.isFinite(width + offset)).toBe(true)

    const margin = Number(bodyOf(home, '.extract__name').match(/overflow-clip-margin: (\d+)px/)?.[1])
    /* The ring is drawn `width` wide, `offset` outside, so its outer edge is at
       the sum. Cutting exactly there leaves nothing for rounding at a
       fractional device pixel ratio. Raise the outline in index.css without
       raising this and the test says so. */
    expect(margin).toBeGreaterThan(width + offset)
  })
})

/* The sentence that stood above the standing and above the Top liste.
 *
 * It had a gold edge down its left side, which made a line of plain explanation
 * read as something to act on; gold is reserved for the podium, for medals and
 * for badges (tokens.css). The owner had the edge taken off on 01.08.2026 and
 * the sentence itself on 04.08.2026, so what is held now is that neither the
 * rule nor the words came back.
 */
describe('the sentence above a table of places', () => {
  it('is gone from both screens, and out of the dictionary with them', () => {
    expect(read('src/pages/Rankings.css')).not.toContain('rankings__note')
    expect(read('src/pages/TopBoards.css')).not.toContain('boards__intro')
    expect(sr.rankings).not.toHaveProperty('historyNote')
    expect(sr.topBoards).not.toHaveProperty('intro')
  })
})

/* The column a telephone does not have room for.
 *
 * Every table on the portal drops columns below 700px, and what a phone keeps is
 * the place, the name, one column of its own and the measure (PDL P12). All of
 * that rests on one declaration, and nothing was holding it: turned into
 * `opacity: 1` the whole suite stayed green while every such table showed every
 * column on a telephone again, sideways scroll and all.
 */
/**
 * Everything inside the one query that means a telephone, and nothing after it.
 *
 * Proximity is not containment: a rule sitting under a query rather than in it
 * applies at every width, and reads the same from a few characters away.
 *
 * The brace is part of what is looked for, because the query's own text is a
 * prefix of a narrower one. `@media (max-width: 699.98px) and (min-width: 500px)`
 * is a query no telephone ever matches, and a search for the shorter string
 * finds it and reports the rule safely inside it.
 */
function onTelephone(css: string): string {
  const at = css.indexOf('@media (max-width: 699.98px) {')

  expect(at, 'there is no telephone query').toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('\n}', at))
}

describe('a column hidden on a telephone', () => {
  it('is taken out of the page, and only on a telephone', () => {
    const query = onTelephone(read('src/styles/table.css'))

    expect(query).toContain('.table__hide-phone')
    expect(bodyOf(query, '.table__hide-phone')).toMatch(/display:\s*none/)
  })

  /* And the room those four leave behind is not spent on the padding of the
   * ones that stay.
   *
   * It came out once on the reading that it is inert, because the table does fit
   * at 360px without it. It does. What it holds is the room behind the fit:
   * measured on the worst season, the board of best races asks for 275,4px of
   * the 294px its card gives it, and 291,4px without this, which is two and a
   * half pixels of margin at the width the portal promises to work at. It was
   * not free to look at either, because what does not fit wraps instead: the
   * same board stood sixty-two pixels taller.
   */
  it('leaves the reserve behind that in the padding of the cells that stay', () => {
    expect(onTelephone(read('src/pages/TopBoards.css'))).toMatch(
      /\.boards \.table th,\s*\.boards \.table td \{\s*padding-inline: var\(--space-6\)/,
    )
  })
})

/**
 * The declarations that answer a request in as many words.
 *
 * Six notes came in on 04.08.2026 about how these screens are laid out, and the
 * answer to most of them is one line of a stylesheet. jsdom lays nothing out, so
 * every one of them could be deleted with the whole suite staying green: the
 * calculator would go back to the height of the prose beside it, the board of
 * best races back to two thirds of the page, and the band of empty pixels back
 * over the bars of all six charts.
 *
 * A declaration read as text is a weaker thing than a measurement, and it is
 * what this project has (ADL A7): a rule that is present can still be beaten by
 * another. It holds the one failure that actually happened here, which is a line
 * disappearing in a later tidy-up, and it names the request it answers so
 * whoever takes it out knows whose it was.
 */
describe('what the owner asked for on 04.08.2026', () => {
  for (const { of: file, rule, holds, why } of [
    {
      of: 'src/pages/Home.css',
      rule: '.home__calc',
      holds: /align-self:\s*start/,
      why: 'the calculator ends where it ends, not where the president\'s word does',
    },
    {
      of: 'src/pages/TopBoards.css',
      rule: '.boards__board--best-races',
      holds: /grid-column:\s*1 \/ -1/,
      why: 'the whole of a result takes the whole width of the page',
    },
    {
      of: 'src/pages/TopBoards.css',
      rule: '.boards__grid',
      holds: /margin-block-start:\s*var\(--space-16\)/,
      why: 'the boards start off the line of the heading, as the cards do',
    },
    {
      of: 'src/pages/Rankings.css',
      rule: '.rankings--tooled > .rankings__empty',
      holds: /margin-block-start:\s*var\(--space-16\)/,
      why: 'and so does a table with a control beside its heading',
    },
    {
      of: 'src/pages/TopBoards.css',
      rule: '.boards .table .boards__figure',
      holds: /text-align:\s*right/,
      why: 'a figure reads from the right, whichever column it is in',
    },
    {
      of: 'src/pages/TopBoards.css',
      rule: '.boards .table td.boards__detail',
      holds: /overflow-wrap:\s*anywhere/,
      why: 'one long name breaks rather than pushing the card sideways',
    },
    {
      of: 'src/components/ColumnChart.css',
      rule: '.colchart__columns',
      /* The whole shorthand, because it is the shorthand that carries the step
         under the bars and the absence of a band over them: written back as four
         values, or with a `padding-block-start` after it, the band returns and a
         rule that merely mentions padding would still be here. */
      holds: /padding:\s*var\(--space-10\) var\(--space-10\) var\(--space-12\);/,
      why: 'a step under the bars, and nothing kept over them',
    },
    {
      of: 'src/components/ColumnChart.css',
      rule: '.colchart--control .colchart__columns',
      holds: /padding-block-start:\s*3\.1rem/,
      why: 'except on the one chart that has a control to put there',
    },
    {
      of: 'src/components/ColumnChart.css',
      rule: '.colchart__count',
      holds: /max-inline-size:\s*100%/,
      why: 'and a number that runs long stays inside its own bar',
    },
    {
      of: 'src/components/ColumnChart.css',
      rule: '.colchart__count',
      /* The other half of the same thought. The box is placed with `inset: 0`
         and `margin: auto`, so a width left to itself is the whole of the bar:
         without these two every count in every chart on the portal is a pill the
         width of its column rather than a disc. */
      holds: /inline-size:\s*fit-content;\s*min-inline-size:\s*1\.7rem/,
      why: 'a count is as wide as the number in it, and no wider',
    },
    {
      of: 'src/components/ColumnChart.css',
      rule: '.colchart__count',
      holds: /padding-inline:\s*var\(--space-6\)/,
      why: 'with the room on its sides that the cap above spends first',
    },
  ]) {
    it(`${why} (${rule})`, () => {
      expect(bodyOf(read(file), rule)).toMatch(holds)
    })
  }

  it('starts the table itself off that line, not only the sentence standing in for it', () => {
    /* Both selectors of one rule, and the rule is found by the last of them, so
       the first was carried by nothing: taken out, the standing on the teams
       goes from 28px under its heading to 12px, which is the state the note was
       about, while the half that was held draws only in a season that has no
       teams in it. */
    expect(read('src/pages/Rankings.css')).toMatch(
      /\.rankings--tooled > \.table-scroll,\s*\.rankings--tooled > \.rankings__empty \{/,
    )
  })

  it('keeps the count round while it is round, and a pill once it is not', () => {
    /* At 50% a box stretched by a long number is an ellipse, which is neither a
       disc nor a pill. Both circles are drawn the same way, so both are read. */
    const css = read('src/components/ColumnChart.css')

    expect(bodyOf(css, '.colchart__count')).toMatch(/border-radius:\s*var\(--radius-round\)/)
    expect(bodyOf(css, '.colchart__count--quiet')).not.toMatch(/border-radius/)
  })
})

/* Two more places where gold says something, and one where a figure has to sit
 * on the line of the words beside it. All three are invisible to a screen test,
 * because jsdom applies no stylesheet and works out no colour.
 */
describe('the marks on a day of the calendar', () => {
  const css = () => read('src/pages/Calendar.css')

  it('puts the gold on the number of a weekend and the ring on today', () => {
    /* Owner, 04.08.2026, in his own words: "obojiš boju dana u zlatno kao što je
       na Danas, a da današnji dan bude samo zaokružen zlatnim (osim ako je
       vikend, tad da ima i zlatni broj)". Two marks that said one thing between
       them now say two, so a reader can tell a Saturday from today. */
    expect(bodyOf(css(), '.day--weekend .day__number')).toMatch(/color:\s*var\(--gold-text\)/)
    expect(bodyOf(css(), '.day--today')).toMatch(/border-color:\s*var\(--gold-text\)/)
    // And today's number is not gold on its own account any more.
    expect(css()).not.toContain('.day--today .day__number')
  })

  it('draws the gold that flips with the theme, not the one that does not', () => {
    /* `--gold-text` is a token with a value per theme; gold-500 is a step of the
       scale and measures 2,98:1 against a white card, which is under the 4,5:1
       a number owes as text (WCAG 2.2 SC 1.4.3). */
    expect(bodyOf(css(), '.day--weekend .day__number')).not.toMatch(/gold-[0-9]/)
  })
})

describe('the answer of the calculator', () => {
  it('sits on the line of the words that name it', () => {
    /* Owner, 04.08.2026: the figure "stood above" them. Both are laid along the
       bottom of the row, and what a bottom is depends on the size of the text:
       under a baseline sits half the leading and the depth of the descenders,
       and both are a share of the font. The figure's font is more than twice the
       label's, so its baseline was four and a half pixels above the label's
       while the two boxes ended level.

       `line-height: 1` takes the leading out of the figure's box, which is most
       of that difference, and two pixels under the figure are the rest; neither
       of the two beside it is nudged up by a padding of its own any more. */
    const css = read('src/pages/Home.css')

    expect(bodyOf(css, '.calc__result strong')).toMatch(/line-height:\s*1;/)
    /* And two pixels of the smallest step there is, which is the rest of it:
       measured on the page, the leading alone left the figure 1,8px low. */
    expect(bodyOf(css, '.calc__result strong')).toMatch(
      /padding-block-end:\s*var\(--space-2\)/,
    )
    // Nothing lifts the two beside it any more; they carry the row's own bottom.
    expect(bodyOf(css, '.calc__label')).not.toMatch(/padding/)
    expect(bodyOf(css, '.calc__waiting')).not.toMatch(/padding/)
    /* And the row is still laid along the bottom rather than on a shared
       baseline: the answer swaps between a large figure and a short italic line,
       and on a shared baseline the label would move every time it did (owner,
       01.08.2026). */
    expect(bodyOf(css, '.calc__result')).toMatch(/align-items:\s*flex-end/)
  })
})

/* The search on the competitors' page, which is a rule about a shape rather than
 * a colour, and lands here for the same reason: jsdom applies no stylesheet, so
 * a screen test cannot see that a label and its box are side by side.
 *
 * Stacked, the label took the line of the heading and the box hung below it, so
 * the page opened with a band of empty space beside its own title (owner,
 * 03.08.2026).
 */
describe('the search beside the heading', () => {
  const RULE = '.rankings__head-tool .rankings__field'
  const hint = sr.competitors.searchPlaceholder

  it('lays the label and its box along one line', () => {
    const body = bodyOf(read('src/pages/Rankings.css'), RULE)

    expect(body).toMatch(/flex-direction:\s*row/)
    expect(body).not.toMatch(/flex-direction:\s*column/)
  })

  it('gives the box room for the whole of the hint it shows', () => {
    /* Measured in `ch`, the width of a nought in the box's own font, so the
       number follows the text rather than a guess about it. Against the hint as
       it is written rather than against the number it happens to be today, so
       rewording it to something longer fails here rather than on the page.

       `ch` is the nought and not the average letter, so this is the safe side of
       the comparison by some way: twenty-nine characters of that hint measure
       172px and twenty-nine noughts measure 225px. */
    const body = bodyOf(
      read('src/pages/Rankings.css'),
      ".rankings__head-tool .rankings__field input[type='search']",
    )
    const width = /inline-size:\s*(\d+)ch/.exec(body)

    expect(width, 'the box has no width in ch').not.toBeNull()
    expect(Number(width?.[1])).toBeGreaterThanOrEqual(hint.length)

    /* And the width is a width and not a floor. A flex item will not shrink
       below its content, so without this the row goes off the left edge, where
       there is no scrollbar to bring it back: at 360px with the text at 200% the
       label started 320px off screen. On the label as well as the box, because
       either one refusing to shrink is enough. */
    expect(body).toMatch(/min-inline-size:\s*0/)
    expect(bodyOf(read('src/pages/Rankings.css'), RULE)).toMatch(/min-inline-size:\s*0/)
  })
})

/* Three things about the calendar's own row of controls and the chart on the
 * front page, all of them shapes rather than colours, and all here for the same
 * reason: jsdom applies no stylesheet, so nothing a screen test can see says
 * whether two things line up.
 */
describe('the row above the month grid', () => {
  const css = () => read('src/pages/Calendar.css')

  it('leaves one gap for the whole row, so both ends of it match', () => {
    /* "Danas" carried a margin of its own, so the step beside it stood sixteen
       pixels away while the month stood eight from the step at the other end
       (owner, 03.08.2026). */
    expect(bodyOf(css(), '.calendar__today')).not.toMatch(/margin-inline-end/)
    expect(bodyOf(css(), '.calendar__bar')).toMatch(/gap:\s*var\(--space-8\)/)
  })

  it('names the days over the middle of their columns', () => {
    expect(bodyOf(css(), '.calendar__weekday')).toMatch(/text-align:\s*center/)
  })
})

describe('the legend under the month grid', () => {
  it('is an aside in italics, with nothing in it heavier than the rest', () => {
    /* Bold on the first word made it read as a heading over the five colours
       rather than a label in front of them (owner, 03.08.2026). */
    const css = read('src/pages/Calendar.css')

    expect(bodyOf(css, '.legend')).toMatch(/font-style:\s*italic/)
    expect(css).not.toMatch(/\.legend__title\s*\{/)
  })

  it('ends the word with a colon, in the dictionary where the punctuation lives', () => {
    expect(sr.calendar.legend).toBe('Legenda:')
  })
})

describe('the name over a column of the column chart', () => {
  it('is placed from the bar it stands on rather than from the top of the page', () => {
    /* The face rides on top of the bar, so where the face is depends on how tall
       the bar came out. The name sat at a fixed distance from the top of the
       column, which is right for the tallest column and for no other: measured
       on the page, eight of ten names were between a hundred and a hundred and
       fifty pixels above the face they name (owner, 03.08.2026).

       `100%` is the bar's own drawn height, which is the only number that is
       true: the tallest bar asks for the whole column and then gives room back
       to the face standing on it, so the height in the style and the height on
       the screen are fifty pixels apart. */
    const body = bodyOf(read('src/components/ColumnChart.css'), '.colchart__who')

    expect(body).toMatch(/inset-block-end:\s*calc\(100% \+ var\(--face-gap\) \+ var\(--face\) \/ 2\)/)
    expect(body).toMatch(/transform:\s*translateY\(50%\)/)
    /* And nothing else nudging it off that middle. */
    expect(body).not.toMatch(/margin-block-end/)
  })

  it('sizes the face through the same variable the name is placed by', () => {
    /* Otherwise the phone's smaller face moves and the name does not. That rule
       had in fact never applied: `.home .portrait` sets a size at the same
       weight and lands later in the one bundled sheet, so the face stayed wide
       and nothing said so. */
    const css = read('src/components/ColumnChart.css')

    expect(bodyOf(css, '.colchart .colchart__column .portrait')).toMatch(/inline-size:\s*var\(--face\)/)
    expect(bodyOf(css, '.colchart__link')).toMatch(/--face:\s*2\.9rem/)
    expect(css).toMatch(/--face:\s*2\.2rem/)
  })
})

/* The bars of the column chart, which have to agree with the numbers in them.
 *
 * They were laid out in the same column as the face that stands on them, so the
 * tallest bar asked for the whole column and then gave room back to the face
 * while the shorter ones gave nothing back: five races and four came out the
 * same height. A floor under every bar did the rest, making one race and two
 * races the same again at the other end (owner, 03.08.2026).
 */
describe('the height of a bar on the column chart', () => {
  const css = () => read('src/components/ColumnChart.css')

  it('is a share of a ground that holds still', () => {
    /* The column less the face and the gap under it. Fixed, so a share of it is
       a share of the same thing for every column. */
    expect(bodyOf(css(), '.colchart__track')).toMatch(
      /block-size:\s*calc\(100% - var\(--face\) - var\(--face-gap\)\)/,
    )
  })

  it('is that share and nothing else, with no floor under it', () => {
    /* The rule that starts a line, not the hover rule above it, whose selector
       ends in the same name and would be found first. */
    const body = bodyOf(css(), `\n.colchart__bar`)

    expect(body).toMatch(/block-size:\s*var\(--bar\)/)
    expect(body).not.toMatch(/min-block-size/)
  })

  it('carries its face rather than standing under it', () => {
    /* In the flow the face took height away from the bar it stands on, which is
       what made the bars disagree with their own numbers. */
    const body = bodyOf(css(), '.colchart__column .portrait')

    expect(body).toMatch(/position:\s*absolute/)
    expect(body).toMatch(/inset-block-end:\s*calc\(var\(--bar\) \+ var\(--face-gap\)\)/)
  })
})

/* The head of an event, which becomes a row only when there is something to put
 * in its second column.
 *
 * Without the condition it was a two-column grid whatever was in it, and the
 * buttons are drawn for an administrator and for a member and for nobody else:
 * every visitor who was not signed in got a head laid out in two columns with
 * nothing in the second, so its four lines paired off into a grid two by two and
 * the name of the event stood beside the way back to the calendar. A screen test
 * cannot see it, because jsdom lays nothing out.
 */
describe('the head of an event', () => {
  const css = () => read('src/pages/event/EventActions.css')

  it('becomes a row only where the buttons are', () => {
    expect(css()).toMatch(/\.profile__head--acting:has\(> \.event__actions\) \{/)
    /* And never on the class alone, which is on the head whatever is inside it. */
    expect(css()).not.toMatch(/\n {2}\.profile__head--acting \{/)
  })

  it('runs the buttons down whatever the head holds, rather than a counted number of rows', () => {
    expect(bodyOf(css(), '.profile__head--acting:has(> .event__actions) > .event__actions')).toMatch(
      /grid-row:\s*1 \/ -1/,
    )
  })
})
