import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { at, must } from '../test/at'
import { bodyOf, closes, ruleAt, unremarked } from '../test/stylesheet'
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


/* The two readers above, on stylesheets written here rather than on the real
 * ones.
 *
 * Everything else in this file leans on them, so a mistake in either is a dozen
 * guards quietly reporting that a rule is where it is not. The real sheets prove
 * they work today; these prove why they are written the way they are, and they
 * are the only place the awkward shapes can be tried without writing an awkward
 * shape into a stylesheet somebody has to read.
 */
describe('reading a rule out of a stylesheet', () => {
  it('takes the selector whole, not the end of a longer one', () => {
    const css = `.rankings .mark {\n  color: red;\n}\n\n.mark {\n  color: blue;\n}\n`

    /* The scoped rule is written first and ends in the same name. Found by the
       tail, it would answer for the plain one and say red. */
    expect(bodyOf(css, '.mark')).toContain('color: blue')
    expect(bodyOf(css, '.rankings .mark')).toContain('color: red')
  })

  it('says a scoped rule is not the plain one it ends with', () => {
    expect(ruleAt('.rankings .mark {\n  color: red;\n}\n', '.mark')).toBe(-1)
    /* A compound, which has no space in it, and a selector reached through a
       pseudo-class. Both end in the name and neither is it. */
    expect(ruleAt('.wide.mark {\n  color: red;\n}\n', '.mark')).toBe(-1)
    expect(ruleAt('.card:hover .mark {\n  color: red;\n}\n', '.mark')).toBe(-1)
  })

  it('says a rule nested inside another is not a rule of its own', () => {
    /* Nesting puts a selector at the start of a line like any other, so nothing
       in front of it says it draws only where the rule around it draws. A rule
       inside an at-rule is a different thing and stays readable: four of the
       rules this file holds live inside a media query. */
    expect(ruleAt('.track {\n  .mark {\n    color: red;\n  }\n}\n', '.mark')).toBe(-1)
    expect(ruleAt('@media print {\n  .mark {\n    color: red;\n  }\n}\n', '.mark')).toBeGreaterThan(
      -1,
    )
    /* And a rule after a nested one is still its own, so closing is counted too
       and not merely opening. */
    expect(
      ruleAt('.track {\n  .other {\n  }\n}\n\n.mark {\n  color: red;\n}\n', '.mark'),
    ).toBeGreaterThan(-1)

    /* An at-rule that ends in a semicolon rather than a block, which is how two
       of these sheets open. Counted into what follows it, the rule it stands
       above reads as an at-rule itself and everything nested inside that rule
       goes back to passing for its own. Four of the nine sheets read here open
       that way. */
    expect(
      ruleAt(`@import 'table.css';\n\n.track {\n  .mark {\n  }\n}\n`, '.mark'),
    ).toBe(-1)
  })

  it('reads a selector wherever a rule may put it', () => {
    /* At the start of the file, second in a list written on one line, against
       a closing brace with nothing between, and against the opening brace of a
       query. The list on one line is the case a newline does not cover: there
       the comma is the only thing saying the selector begins rather than
       continues. Inside a query is in the nesting test below, where it is the
       thing being told apart. */
    expect(ruleAt('.mark {\n}\n', '.mark')).toBe(0)
    expect(ruleAt('.other, .mark {\n}\n', '.mark')).toBeGreaterThan(-1)
    expect(ruleAt('.other {\n}.mark {\n}\n', '.mark')).toBeGreaterThan(-1)
    /* Against the brace of the query itself, which is the one mark a stylesheet
       written down the page never produces. */
    expect(ruleAt('@media print {.mark {\n  }\n}\n', '.mark')).toBeGreaterThan(-1)
  })

  it('closes a block on its own brace, wherever that brace is written', () => {
    /* The closing brace of the query indented onto the line above, and a rule
       of the same name outside it. Read by looking for a brace at the start of a
       line, the query would swallow everything down to the second rule and
       report it as being inside. */
    const css = `@media print {\n  .mark {\n    color: red;\n  } }\n\n.mark {\n  color: blue;\n}\n`

    expect(css.slice(0, closes(css, 0))).not.toContain('color: blue')
    expect(css.slice(0, closes(css, 0))).toContain('color: red')

    /* And it is the query's brace and not the first one, which is the rule's.
       Read too early the answer is still a slice that holds everything anybody
       looks for inside a query of one rule, and says nothing. */
    const tidy = `@media print {\n  .mark {\n    color: red;\n  }\n}\n`

    expect(closes(tidy, 0)).toBe(tidy.lastIndexOf('}'))
  })

  it('neither counts a brace written in prose nor reads a rule out of it', () => {
    /* One brace and not a pair, because a pair cancels itself out and would be
       counted right by accident. */
    const closer = `.mark {\n  /* Ends with a brace: } */\n  color: blue;\n}\n`

    expect(bodyOf(closer, '.mark')).toContain('color: blue')

    /* And a rule written inside a comment is not a rule. This one starts its own
       line, so nothing but the blanking tells it from the real one below. */
    const shown = `/*\n.mark {\n  color: red;\n}\n*/\n.mark {\n  color: blue;\n}\n`

    expect(bodyOf(shown, '.mark')).toContain('color: blue')
    expect(bodyOf(shown, '.mark')).not.toContain('color: red')
  })

  it('gives the telephone query its own end, not the first brace on a line', () => {
    /* The same shape as above, on the reader the guards below actually call.
       The real stylesheets both put the closing brace of a query at the start of
       a line, so nothing but this says which of the two ways of finding it is
       being used, and the other way lets a rule outside the query pass as one
       inside it. */
    const css = `@media (max-width: 699.98px) {\n  .mark {\n    display: none;\n  } }\n\n.mark {\n  display: block;\n}\n`

    expect(onTelephone(css)).toContain('display: none')
    expect(onTelephone(css)).not.toContain('display: block')

    /* And it is the query the sheet has, not the one a comment mentions. These
       rules are all explained by a comment beside them, and the shortest way to
       explain one is to write it out. */
    const quoted = `/* Everything under \`@media (max-width: 699.98px) {\` goes. */\n@media (max-width: 699.98px) {\n  .mark {\n    display: none;\n  }\n}\n`

    /* What comes back carries no end of a comment in it. Read in the comment
       instead, the answer begins at the same words and runs through the rest of
       the prose into the real query, so it looks right from either end and only
       the middle of it says which one was found. */
    expect(onTelephone(quoted)).not.toContain('*/')
    expect(onTelephone(quoted)).toContain('display: none')
  })

  it('says so rather than running to the end of the file when nothing closes', () => {
    /* Left to a search, an unclosed block reads as -1 and `slice(at, -1)` is a
       silent "everything after this", which is a guard that has stopped asking
       anything at all. */
    expect(() => closes('.mark {\n  color: red;\n', 0)).toThrow(/never closed/)
  })
})

/** WCAG relative luminance of an `#rrggbb` colour. */
function luminance(hex: string): number {
  const linear = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return 0.2126 * at(linear, 0) + 0.7152 * at(linear, 1) + 0.0722 * at(linear, 2)
}

function contrast(one: string, other: string): number {
  const sorted = [luminance(one), luminance(other)].sort((left, right) => right - left)
  return (at(sorted, 0) + 0.05) / (at(sorted, 1) + 0.05)
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
    return at(found, 0).slice(-8, -1)
  }

  it('clears 4,5:1 against every stop of the band it is painted on', () => {
    const pairs: { rule: string; stop: string; ratio: number }[] = []

    for (const band of BANDS) {
      const body = bodyOf(read(band.file), band.rule)

      const ink = body.match(/color: var\((--[a-z-]+)\)/)?.[1]
      expect(ink, `${band.rule} sets no colour through a token`).toBeDefined()

      const stops = [...body.matchAll(/linear-gradient\([^)]*?((?:var\(--[a-z0-9-]+\)[,\s]*)+)/g)]
        .flatMap((match) => [...(match[1] ?? '').matchAll(/var\((--[a-z0-9-]+)\)/g)])
        .map((match) => at(match, 1))
      expect(stops.length, `${band.rule} paints no gradient through tokens`).toBeGreaterThan(1)

      for (const stop of stops) {
        pairs.push({
          rule: band.rule,
          stop,
          ratio: contrast(value(must(ink, `a colour token on ${band.rule}`)), value(stop)),
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

/* Gold on the row that belongs to whoever is reading.
 *
 * A reader in the top three has a row that is both, and the two marks are drawn
 * by two rules that know nothing about each other: the tint comes from the mark,
 * the gold from the podium. Nothing on a screen says whether the number can
 * still be read on it, and the first tint chosen measured 4,40:1, which is under
 * the 4,5:1 a number owes as text (WCAG 2.2 SC 1.4.3).
 *
 * Both themes, and the dark one twice, because it is declared once for the
 * system setting and once for the switch on the page.
 */
describe('the gold on a row that belongs to the reader', () => {
  it('clears 4,5:1 in both themes', () => {
    const tokens = read('src/styles/tokens.css')

    /* Every value a token is given, in the order the file gives them: the light
       theme, then the dark one the system asks for, then the dark one the switch
       on the page sets. A token with one value has one, and the same one answers
       for every theme. */
    const given = (name: string) =>
      [...tokens.matchAll(new RegExp(`${name}: ([^;]+);`, 'g'))].map((one) => at(one, 1))

    /* Followed to a colour, because half of these are written as the name of
       another token. Read as text, `--accent: var(--blue-700)` is not a colour
       and a regex looking for a hex quietly skips it, so the light theme falls
       out of the check and the first hex it does find answers for it: written
       out by hand, the dark link was measured against the dark tint here while
       the value the portal actually draws was somewhere else entirely. */
    const colour = (value: string, seen: string[] = []): string => {
      const named = value.trim().match(/^var\((--[a-z0-9-]+)\)$/)

      if (named === null) {
        expect(value.trim(), `${value} is not a colour`).toMatch(/^#[0-9a-f]{6}$/)
        return value.trim()
      }

      const next = must(named[1], 'the name inside var()')

      expect(seen, `${next} is defined in terms of itself`).not.toContain(next)
      return colour(must(given(next)[0], `${next} has no value`), [...seen, next])
    }

    /** That token as the theme at `index` draws it, or as the light theme does. */
    const inTheme = (name: string, index: number) => {
      const values = given(name)

      return colour(must(values[index] ?? values[0], `${name} has no value`))
    }

    const tints = given('--mine-surface').map((one) => colour(one))

    /* One for the light theme and two for the dark, which is how every token
       with a value per theme is written here. Fewer means a theme has quietly
       lost its own value and is drawing another one instead. */
    expect(tints).toHaveLength(3)

    /* Every ink a marked row carries, not the gold alone. A row is a name that
       leads somewhere, so the accent is on it as often as the gold is, and the
       first dark tint chosen put the accent at 4,36:1 while the gold on it read
       8,41:1 and said nothing about it. */
    const inks = ['--gold-text', '--accent', '--text', '--text-muted']
    const pairs = inks.flatMap((ink) =>
      tints.map((on, index) => ({ ink: inTheme(ink, index), on, theme: `${ink}, theme ${index}` })),
    )

    for (const pair of pairs) {
      expect(
        contrast(pair.ink, pair.on),
        `${pair.ink} on ${pair.on} (${pair.theme}) is ${contrast(pair.ink, pair.on).toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(FLOOR)
    }
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
 * for ducats (tokens.css). The owner had the edge taken off on 01.08.2026 and
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
  /* Two spellings of the same width, and a sheet has one of them. A query that
     changes shape is written in em, so that it fires where the reader's text
     stops fitting rather than where the screen ends; a query that takes columns
     away is written in px, so that enlarged text never strips a desktop of its
     data. Which is which, and why, is in scale.test.ts. */
  const bare = unremarked(css)
  const found = ['@media (max-width: 43.74875em) {', '@media (max-width: 699.98px) {']
    /* Looked for where the comments are blanked, as a selector is, so a query
       quoted in prose is not the one that gets read. */
    .map((query) => bare.indexOf(query))
    .filter((one) => one > -1)

  expect(found, 'there is no telephone query').toHaveLength(1)

  const at = must(found[0], 'a telephone query in this sheet')

  return css.slice(at, closes(css, at))
}

/* The column a telephone does not have room for.
 *
 * Every table on the portal drops columns below 700px, and what a phone keeps is
 * the place, the name, one column of its own and the measure (PDL P12). All of
 * that rests on one declaration, and nothing was holding it: turned into
 * `opacity: 1` the whole suite stayed green while every such table showed every
 * column on a telephone again, sideways scroll and all.
 */
/* The surname that gives way to an initial where a card has no room for both
 * (owner, 05.08.2026).
 *
 * A container query and nothing else decides it, and jsdom evaluates none, so
 * the screen test beside this one can only hold that both halves are in the
 * markup. What is held here is that the swap is written down and that it is
 * asked of the card rather than of the window: read as a media query it would
 * shorten every name on the page at that width, including the ones on the board
 * that runs its whole width, and read against no container at all it would never
 * shorten anything.
 */
describe('a surname a card has no room for', () => {
  it('is swapped for an initial by the card it stands in, not by the window', () => {
    const css = read('src/pages/TopBoards.css')

    expect(bodyOf(css, '.boards__board')).toMatch(/container-type:\s*inline-size/)

    const at = css.indexOf('@container (max-width: 320px) {')

    expect(at, 'there is no question asked of the card').toBeGreaterThan(-1)

    const query = css.slice(at, closes(css, at))

    expect(bodyOf(query, '.boards__family')).toMatch(/position:\s*absolute/)
    expect(bodyOf(query, '.boards__initial')).toMatch(/display:\s*inline/)
    /* And drawn the other way round outside it. */
    expect(bodyOf(css, '.boards__initial')).toMatch(/display:\s*none/)
  })
})

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
/** What one media query holds, so a rule written twice can be read at the width
 *  it belongs to. */
function inside(css: string, query: string): string {
  const at = css.indexOf(query)

  expect(at, `there is no ${query}`).toBeGreaterThan(-1)

  return css.slice(at, closes(css, at))
}

describe('what the owner asked for on 04.08.2026', () => {
  for (const { of: file, rule, holds, why, within } of [
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
      of: 'src/pages/Rankings.css',
      rule: '.rankings--tooled > .rankings__head-tool + *',
      holds: /margin-block-start:\s*var\(--space-16\)/,
      why: 'and so does whatever comes first under a control beside a heading',
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
      holds: /padding:\s*var\(--space-10\) var\(--space-10\)\s*max\(var\(--space-12\), calc\(var\(--count-chars, 2\) \* 0\.24rem \+ var\(--space-6\)\)\);/,
      why: 'a step under the bars, and nothing kept over them',
    },
    {
      of: 'src/components/ColumnChart.css',
      rule: '.colchart--control .colchart__columns',
      holds: /padding-block-start:\s*3\.1rem/,
      why: 'except on the one chart that has a control to put there',
    },
    {
      of: 'src/pages/Rankings.css',
      rule: '.rankings--tooled:has(> .rankings__head-tool)',
      /* Only where there is a control to place. The event draws none for a
         visitor, and an unconditional grid laid the gutter beside a name with
         nothing on the other side of it. jsdom lays nothing out, so the
         condition is held where it is written. */
      holds: /display:\s*grid/,
      why: 'a row with nothing beside the heading is not a row of two',
    },
    {
      of: 'src/pages/Profile.css',
      rule: '.profile__head.rankings--tooled > h1',
      /* Two classes, so the six pixels win on weight rather than on the order
         two sheets landed in the bundle: the head of an event wears both. */
      holds: /margin-block-end:\s*var\(--space-6\)/,
      why: 'the name of an event ends where the buttons beside it end',
    },
    {
      of: 'src/pages/Rankings.css',
      rule: '.rankings--tooled',
      /* The one value both boxes on that row take. Written twice instead, they
         drift apart and centring draws the control off the heading by half the
         difference, which is how the top boards sat six pixels low and a profile
         three pixels high (owner, 05.08.2026). */
      holds: /--head-end:\s*var\(--space-12\)/,
      why: 'the heading and the control beside it end at the same distance',
    },
    {
      of: 'src/pages/Rankings.css',
      rule: '.rankings--tooled > .rankings__head-tool',
      holds: /margin-block-end:\s*var\(--head-end\)/,
      why: 'and both of them take it from the one place',
    },
    {
      of: 'src/pages/Profile.css',
      rule: '.profile__title.rankings--tooled',
      holds: /--head-end:\s*var\(--space-6\)/,
      why: 'a profile spends less of it, and its control moves with the heading',
    },
    {
      of: 'src/pages/Profile.css',
      rule: '.profile__head.rankings--tooled',
      /* The head of an event, which became the shared row when the two things
         that can be done with an event moved onto the name (owner, 06.08.2026).
         The six is what the heading above it already carries, and centring lines
         up margin boxes: the two have to be the one value or the buttons beside
         the name sit three pixels off it. */
      holds: /--head-end:\s*var\(--space-6\)/,
      why: 'an event spends the same as a profile, and its buttons move with the name',
    },
    {
      of: 'src/pages/TopBoards.css',
      rule: '.boards h1',
      /* Only what goes above it, and nothing about what goes under. Written as
         `margin: 0 0 …` this rule weighs the same as the shared one and is
         settled by whichever sheet the bundle puts last, so the two agreed by
         coincidence on the row and not at all below 560px. Written as nothing,
         the browser's own margin on an h1 returns and takes the control with
         it. */
      holds: /margin-block-start:\s*0/,
      why: 'a heading with a control beside it says only what goes above it',
    },
    {
      of: 'src/pages/Calendar.css',
      rule: '.calendar h1',
      holds: /margin-block-start:\s*0/,
      why: 'and the calendar says the same, for the same reason',
    },
    {
      of: 'src/pages/Profile.css',
      rule: '.profile__head > h1',
      /* An event and a league build their head like a profile but have no
         control beside the name, so they draw a bare h1 here. Their whole
         styling was a rule about `.profile__head h1`, and when the name of a
         competitor took its own size that rule went with it and both pages fell
         back to the browser's 2em. */
      holds: /font-size:\s*clamp\(26px, 4\.5vw, 36px\)/,
      why: 'a page built like a profile has a heading even with no control on it',
    },
    {
      of: 'src/pages/Profile.css',
      rule: '.profile__name',
      /* The same size as every other heading, or the control beside it is drawn
         at a height nothing else on the portal uses. */
      holds: /font-size:\s*clamp\(28px, 5vw, 40px\)/,
      why: 'the name of a competitor is the size a heading is',
    },
    {
      of: 'src/pages/Home.css',
      rule: ".button[aria-disabled='true']",
      /* Not `opacity`, which dims the focus ring with everything else: this
         control is deliberately still in the order of focus, so somebody lands
         on it and the ring has to be at full strength there (WCAG 2.2 SC
         1.4.11). Muted ink and a plain border say it cannot act. */
      holds: /color:\s*var\(--text-muted\)/,
      why: 'a button that cannot act says so without dimming its own focus ring',
    },
    {
      of: 'src/pages/Home.css',
      rule: ".button[aria-disabled='true']",
      /* The ground as well as the ink. The primary button is drawn on the accent
         and this state is not: muted text on the full accent reads as a button
         that works. */
      holds: /background:\s*transparent/,
      why: 'and it does not keep the ground of a button that does act',
    },
    {
      of: 'src/pages/admin/SectionNav.css',
      rule: '.adminsection__sectors',
      /* The two sectors are one column since 06.08.2026, and the space between
         them is written here: it used to fall out of a grid that had one child,
         and with two they stood flush against each other. */
      holds: /gap:\s*var\(--space-16\)/,
      why: 'the two sectors are not flush against each other',
    },
    {
      of: 'src/pages/admin/Entity.css',
      rule: '.entity-races',
      holds: /margin-block-start:\s*var\(--space-32\)/,
      why: 'the races of an event are set off from the form that names it',
    },
    {
      of: 'src/pages/admin/SectionNav.css',
      rule: '.adminsection__sectors',
      /* On the column of both sectors and not on either nav. Written on the nav
         it was one rule for one navigation, and there are two of them since
         06.08.2026: stuck separately they share a containing block and the
         second paints over the first. Inside the wide query, which is the only
         place it applies. */
      holds: /position:\s*sticky/,
      why: 'the two sectors are held as one column, not one over the other',
      within: '@media (min-width: 51.25em)',
    },
    {
      of: 'src/pages/admin/Verification.css',
      rule: '.pending__card',
      /* Folded on a telephone, where a card is a screenful and five of them mean
         scrolling through four to reach the third (owner, 06.08.2026). Written
         here because jsdom lays nothing out: the tests can press the control and
         watch the state, and only this can say the shut card is actually shut. */
      holds: /display:\s*none/,
      why: 'a card that has not been opened is not drawn on a telephone',
    },
    {
      of: 'src/pages/admin/Verification.css',
      rule: '.pending__card',
      holds: /display:\s*block/,
      why: 'and every card is open from the width where a card is not a screenful',
      within: '@media (min-width: 51.25em)',
    },
    {
      of: 'src/pages/admin/Verification.css',
      rule: '.pending__toggle',
      /* And the control goes, so nothing says "Prikaži" over a card that is
         already open. The two sectors of the navigation are drawn the same way
         (SectionNav.css). */
      holds: /display:\s*none/,
      why: 'nothing offers to open a card that is open',
      within: '@media (min-width: 51.25em)',
    },
    {
      of: 'src/components/Stars.css',
      rule: '.stars__pick',
      /* The box a finger is owed, which is the label around the star and not the
         star: the drawing is 1,35rem and would be a target of about 22px (WCAG
         2.2 SC 2.5.8 asks for 24). jsdom lays nothing out, so the size is held
         where it is written. */
      holds: /inline-size:\s*2rem/,
      why: 'a star is as big as a finger, without the drawing being told to be',
    },
    {
      of: 'src/components/Stars.css',
      rule: '.stars__pick',
      holds: /block-size:\s*2rem/,
      why: 'and as tall as it is wide',
    },
    {
      of: 'src/components/Stars.css',
      rule: '.stars__pick:has(:focus-visible)',
      /* The radio itself is off the screen, so without this a keyboard moving
         through five stars moves through nothing anybody can see (WCAG 2.2 SC
         2.4.7). The ring is drawn around the star that stands in for it. */
      holds: /outline:\s*2px solid var\(--accent\)/,
      why: 'a star the keyboard is on says so',
    },
    {
      of: 'src/styles/table.css',
      rule: '.table tbody tr.table__mine',
      /* The mark itself. Every screen puts the class on the right row, which the
         screen tests hold; nothing but this says the class paints anything. */
      holds: /background:\s*var\(--mine-surface\)/,
      why: 'the row of whoever is reading is tinted',
    },
    {
      of: 'src/styles/table.css',
      rule: '.table tbody tr.table__mine',
      /* And a shape as well as a colour, because a difference in colour alone is
         not one every reader can see (WCAG 2.2 SC 1.4.1). */
      holds: /box-shadow:\s*inset 3px 0 0 0 var\(--accent\)/,
      why: 'and carries a bar down its leading edge, not colour alone',
    },
    {
      of: 'src/components/ColumnChart.css',
      rule: '.colchart__count',
      /* One value on both axes, which is the whole of being a circle: written as
         two, a number of six characters draws the pill the owner asked to be rid
         of on 05.08.2026, and nothing else on the portal would say so. */
      holds: /inline-size:\s*var\(--diameter\);\s*block-size:\s*var\(--diameter\)/,
      why: 'a count is as wide as it is tall',
    },
    {
      of: 'src/components/ColumnChart.css',
      rule: '.colchart__count',
      /* And wide enough for the longest number the chart draws. Left at the
         floor, "286,25" is forty-one pixels of text in a circle of twenty-seven
         and stands half on the bar; the circle this asks for is fifty-three. */
      holds: /max\(var\(--floor\), calc\(var\(--count-chars, 2\) \* 1ch \+ var\(--space-8\)\)\)/,
      why: 'and wide enough for the longest number in its own chart',
    },
  ]) {
    it(`${why} (${rule})`, () => {
      /* Narrowed to one query where the same selector is written twice, once
         outside and once inside it: read over the whole sheet the wide rule and
         the narrow one are indistinguishable, and the one that matters is the
         one under the query. */
      const sheet = read(file)
      const looked = within === undefined ? sheet : inside(sheet, within)

      expect(bodyOf(looked, rule)).toMatch(holds)
    })
  }

  it('leaves what goes under a heading to the one rule that sets it', () => {
    /* Four headings set their own top margin and must not set the bottom. Each
       loses that argument in its own way and none of them by a rule anybody
       reads: two of them weigh the same as the shared rule and are settled by
       the order the bundle puts two sheets in, one by the order inside a single
       sheet, and the fourth by weight. A bottom margin written in any of them is
       either dead or a disagreement waiting for somebody to reorder an import,
       which is how these screens came to keep twelve pixels against everybody
       else's eight below 560px. */
    for (const [file, rule] of [
      ['src/pages/TopBoards.css', '.boards h1'],
      ['src/pages/Calendar.css', '.calendar h1'],
      ['src/pages/Rankings.css', '.rankings h1'],
      ['src/pages/Profile.css', '.profile__name'],
    ] as const) {
      /* Any bottom margin at all, however it is written: `margin`,
         `margin-block`, `margin-block-end`, `margin-bottom`, with a token or a
         number. Held to values off the space scale it let
         `margin-block-end: var(--head-end)` through, and held to those four
         spellings without `margin-block` it let the two-value shorthand through,
         which is the same fight in the same direction each time.
         `margin-block-start` is not a bottom margin and does not match: after
         `margin` the pattern wants either nothing or one of the three endings,
         then a colon. */
      expect(bodyOf(read(file), rule)).not.toMatch(/margin(-block|-block-end|-bottom)?:/)
    }
  })

  it('gives the heading and the control one rule, so neither can drift', () => {
    /* Both selectors of it, and the rule is found by the last of them. Written
       as two rules they hold the same value until somebody changes one, and
       centring then draws the control off the heading by half the difference
       without anything failing. */
    expect(read('src/pages/Rankings.css')).toMatch(
      /\.rankings--tooled > h1,\s*\.rankings--tooled > \.rankings__head-tool \{/,
    )
  })

  it('starts whatever comes first off that line, not a named few', () => {
    /* It was two selectors naming two classes, so the two screens nobody thought
       of started twelve pixels higher than the rest: the standing under its row
       of filters and the calendar under its month (owner, 05.08.2026). The
       sibling is what the rule is about, so the sibling is what it selects, and
       naming a class here again would be the same mistake with a longer list. */
    expect(read('src/pages/Rankings.css')).toMatch(
      /\.rankings--tooled > \.rankings__head-tool \+ \* \{/,
    )
    expect(read('src/pages/Rankings.css')).not.toMatch(/\.rankings--tooled > \.table-scroll/)
  })

  it('draws the count as a circle and not as a stadium', () => {
    /* 50% of a square is a circle; 50% of an oblong is an ellipse, and a large
       fixed radius on an oblong is the pill this used to be. The radius alone
       says nothing, so it is read beside the one diameter above, and the quieter
       circle is drawn by the same rule with a smaller floor and smaller type. */
    const css = read('src/components/ColumnChart.css')

    expect(bodyOf(css, '.colchart__count')).toMatch(/border-radius:\s*50%/)
    expect(bodyOf(css, '.colchart__count--quiet')).not.toMatch(/border-radius|block-size/)
    expect(bodyOf(css, '.colchart__count--quiet')).toMatch(/--floor:\s*1\.45rem/)
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
/* The ring on a star, and the reason it is written twice.
 *
 * The radio inside each star is clipped to a pixel by `visually-hidden`, so the
 * portal's own `:focus-visible` outline is clipped away with it: the rule in
 * Stars.css is the whole of the focus indicator on all fifteen radios (WCAG 2.2
 * SC 2.4.7, level A). Everywhere else on the portal `:has` is an improvement
 * that degrades into the old layout; here there is nothing to degrade into. */
describe('the focus ring on a star', () => {
  it('is drawn without `:has` as well as with it, in a rule of its own', () => {
    const css = read('src/components/Stars.css')

    /* Two rules, never one list of two selectors. An unrecognised pseudo-class
       throws away the whole selector list it stands in, so grouped with the
       `:has` rule the fallback would be dropped by exactly the browsers it is
       there for, and the ring would be gone with it. */
    expect(css).not.toMatch(/:focus-within,/)
    expect(css).not.toMatch(/,\s*\.stars__pick:focus-within/)
    expect(css).toMatch(/@supports not selector\(:has\(\*\)\) \{/)
    expect(bodyOf(css, '.stars__pick:focus-within')).toMatch(
      /outline:\s*2px solid var\(--accent\)/,
    )
  })
})

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
    /* The rule of that name and not the hover rule above it, whose selector ends
       in the same name. It used to be asked for with a newline in front of it,
       which is what `bodyOf` does for itself now. */
    const body = bodyOf(css(), '.colchart__bar')

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
