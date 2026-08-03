import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sr from '../i18n/sr.json'

/* The gold band that names a board, and the one thing about it no screen test
 * can see.
 *
 * Two widgets on the front page put their title on a block of gold: the top ten
 * and the turning chart. The block is painted straight on the gold scale rather
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
  { file: 'src/pages/home/TopByCategory.css', rule: '.top-cat__caption' },
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

/* Where gold is not allowed, which is the other half of the same rule.
 *
 * Gold is reserved for the podium, for medals and for badges (tokens.css). The
 * sentence that stands above the standing and above the Top 10 boards had a gold
 * edge down its left side, which made a line of plain explanation read as
 * something to act on. The owner asked for it to go (01.08.2026, D1) and it was
 * read as being about the rows in the table instead, so the podium came off two
 * boards and the yellow line stayed on both for two days.
 *
 * Read off the sheet, because jsdom paints nothing and a screen test cannot see
 * a border that is not there.
 */
describe('the sentence above a table of places', () => {
  const PROSE = [
    { file: 'src/pages/Rankings.css', rule: '.rankings__note' },
    { file: 'src/pages/TopBoards.css', rule: '.boards__intro' },
  ]

  it.each(PROSE)('carries no gold in $rule', ({ file, rule }) => {
    expect(bodyOf(read(file), rule)).not.toMatch(/gold/)
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

describe('the name over a column of the turning chart', () => {
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
    const body = bodyOf(read('src/pages/home/TopByCategory.css'), '.top-cat__who')

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
    const css = read('src/pages/home/TopByCategory.css')

    expect(bodyOf(css, '.top-cat .top-cat__column .portrait')).toMatch(/inline-size:\s*var\(--face\)/)
    expect(bodyOf(css, '.top-cat__link')).toMatch(/--face:\s*2\.9rem/)
    expect(css).toMatch(/--face:\s*2\.2rem/)
  })
})

/* The bars of the turning chart, which have to agree with the numbers in them.
 *
 * They were laid out in the same column as the face that stands on them, so the
 * tallest bar asked for the whole column and then gave room back to the face
 * while the shorter ones gave nothing back: five races and four came out the
 * same height. A floor under every bar did the rest, making one race and two
 * races the same again at the other end (owner, 03.08.2026).
 */
describe('the height of a bar on the turning chart', () => {
  const css = () => read('src/pages/home/TopByCategory.css')

  it('is a share of a ground that holds still', () => {
    /* The column less the face and the gap under it. Fixed, so a share of it is
       a share of the same thing for every column. */
    expect(bodyOf(css(), '.top-cat__track')).toMatch(
      /block-size:\s*calc\(100% - var\(--face\) - var\(--face-gap\)\)/,
    )
  })

  it('is that share and nothing else, with no floor under it', () => {
    /* The rule that starts a line, not the hover rule above it, whose selector
       ends in the same name and would be found first. */
    const body = bodyOf(css(), `\n.top-cat__bar`)

    expect(body).toMatch(/block-size:\s*var\(--bar\)/)
    expect(body).not.toMatch(/min-block-size/)
  })

  it('carries its face rather than standing under it', () => {
    /* In the flow the face took height away from the bar it stands on, which is
       what made the bars disagree with their own numbers. */
    const body = bodyOf(css(), '.top-cat__column .portrait')

    expect(body).toMatch(/position:\s*absolute/)
    expect(body).toMatch(/inset-block-end:\s*calc\(var\(--bar\) \+ var\(--face-gap\)\)/)
  })
})
