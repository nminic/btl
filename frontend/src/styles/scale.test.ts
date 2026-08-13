import { at } from '../test/at'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/* The scale, and the thing that keeps it a scale.
 *
 * Space and corner radii were written as numbers where they were used. They
 * spread: thirty near values for space, nine for a corner. Nobody chose 0,35
 * over 0,4 over 0,45; they were each typed once, next to each other, and then
 * copied.
 *
 * Putting them on a grid is a morning's work. Keeping them there is this file:
 * without it the next hurried rule writes 0,45rem again and nothing says so.
 *
 * What this does not cover is written down rather than left to be discovered.
 * Sizes are not swept: about a hundred and forty widths and heights are still
 * written out, and several of them are on the same rhythm as the padding beside
 * them. That is the next pass, not this one, and saying so here is cheaper than
 * a reader assuming the portal is tidier than it is.
 */

const SRC = join(process.cwd(), 'src')

/** Every stylesheet under `src`, with its path relative to it. */
function stylesheets(dir = SRC, prefix = ''): { path: string; css: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return stylesheets(at, name)
    }

    /* Line endings normalised, because the value a declaration is written on
       becomes part of the key a value is allowed under, and git hands these
       files out with CRLF on Windows and LF elsewhere. Without this the guard
       passes or fails by how the working copy was checked out, which is a fact
       about a machine and not about the stylesheet. */
    return entry.name.endsWith('.css')
      ? [{ path: name, css: readFileSync(at, 'utf-8').replaceAll('\r\n', '\n') }]
      : []
  })
}

/* Both ways of writing the same thing. `inset-block-start` and `top` are one
   measurement, and a sweep that asks for a token from one and not the other
   makes the scale a matter of which spelling somebody reached for. */
const SPACING =
  /(?<![-\w])((?:padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left|scroll-margin)[a-z-]*)\s*:\s*([^;{}]+);/g

/* Every fixed number with a unit. Percentages and viewport units are left out
   on purpose: they are relative to something that moves, so they are not steps
   of a grid and putting them on one would mean nothing. */
const VALUE = /(-?\d*\.?\d+)(rem|px|em|ch)/g

/**
 * What may stay a number, keyed by where it is.
 *
 * Keyed on the rule and not on the value alone: keyed on the value, allowing
 * `7,5rem` once allows it everywhere, and the reason written beside it stops
 * being true the moment somebody uses it for something else.
 */
const ALLOWED = new Map([
  ['index.css | margin | -1px', 'a hairline pulled back over its own border'],
  [
    'pages/TopBoards.css | margin | -1px',
    'not a space: the recipe that takes a surname off the screen without taking it out of the page, written out because a container query switches whether it applies and cannot put a class on anything',
  ],
  ['components/DucatGallery.css | margin | -1px', 'a hairline pulled back over its own border'],
  ['app/Shell.css | left | -9999px', 'not a distance: the old way of putting a thing off the screen'],
  ['pages/Home.css | inset-inline-start | -0.2rem', 'a mark pulled out over the corner it sits on'],
  ['pages/Home.css | inset-block-start | -0.2rem', 'a mark pulled up over the corner it sits on'],
  [
    'pages/league/League.css | inset-inline-start | 7.5rem',
    'the second sticky column starts where the first one ends, so it is that column measured, not a step',
  ],
  [
    'pages/league/League.css | inset-inline-start | 11rem',
    'the same, at the width the wide layout gives that column',
  ],
  [
    'components/Markdown.css | padding | 0.05em 0.3em',
    'in em on purpose: the padding around code inside a sentence grows with the code, not with the page',
  ],
  [
    'components/ColumnChart.css | padding-block-start | 3.1rem',
    'the measured clearance that keeps the pause control off the tenth face, and kept only on the one chart that has a control',
  ],
  [
    'pages/admin/SectionNav.css | padding | 0.05rem var(--space-6)',
    'under the smallest step the grid has, on the tallest thing in its row',
  ],
  [
    'forms/FieldHint.css | inset-block-start | calc(1.5rem + var(--space-4))',
    'not a step: the letter that opens the rule is 1.5rem tall (.hint__ask), and on the one field whose head runs to several lines the rule hangs under the letter rather than under the head, so the height of the letter is what is written',
  ],
  /* Four offsets that pull a thing back over the corner it sits on. Each is one
     more value nobody chose, and each is invisible; they are named here rather
     than swept because moving them is a decision about how far a counter hangs
     off an icon, which is not what this pass is. */
  ['app/Shell.css | top | -0.35rem', 'a counter pulled up over the icon it counts'],
  ['app/Shell.css | right | -0.35rem', 'the same, sideways'],
  ['app/Shell.css | right | -0.5rem', 'the same, on the wider one'],
  ['pages/Profile.css | right | 0.85rem', 'a mark set in from the corner of a card'],
  [
    'components/ColumnChart.css | inset-inline | -0.5rem',
    'the name over a bar reaches past it on both sides, because a name is wider than a bar',
  ],
  [
    'components/ColumnChart.css | padding | var(--space-10) var(--space-10)\n    max(var(--space-12), calc(var(--count-chars, 2) * 0.24rem + var(--space-6)))',
    'the step under the bars is half the circle that hangs into it, and the circle is as wide as the longest number in the chart, so this one is arithmetic and not a step off the scale',
  ],
])

/**
 * Every way of asking a stylesheet about a width, in either syntax.
 *
 * The old form spells it `(min-width: 35em)` and the one that replaced it spells
 * the same question `(width >= 35em)`. Both are read, because a guard that knows
 * one spelling is a guard somebody steps around without meaning to.
 */
const WIDTH = /\(\s*(?:(?:min|max)-width\s*:\s*|width\s*[<>]=?\s*)([\d.]+)([a-z]+)\s*\)/g

/**
 * The width queries that stay in pixels, keyed by sheet and by the width in
 * pixels, each with what it takes away.
 *
 * Everything else is in em, so that the width the portal changes shape at moves
 * with the text the reader asked for. They were all in px until 13.08.2026, on a
 * reason that was the wrong way round: that a breakpoint in em would move with
 * the reader's text size while every other width here does not. Every other
 * width here does. The spacing scale is rem on purpose, "so that somebody who
 * has made their text bigger gets bigger gaps" (tokens.css), and so are the
 * widths the breakpoints are picked from. The breakpoint alone stood still, so
 * at enlarged text it stopped describing what it was picked for: 900 was picked
 * because sixteen columns of checkboxes fit in it beside a twelve rem column of
 * names, and at 200 per cent that content wants about 1800 while the query still
 * said 1280 would do.
 *
 * These four are the other case. In em, at 200 per cent text, a 1280 desktop
 * counts as 640, so each of them would take something off a screen with room for
 * it, for no reason but that the reader made the letters bigger. That is what
 * WCAG 2.2 SC 1.4.4 is about, and PDL P24 settled the same question the same way
 * on 12.08.2026: at enlarged text the table on a profile scrolls inside its box
 * rather than losing the name of the race.
 *
 * Taking away is not always `display: none`, which is the whole reason two of
 * these four were nearly missed: a column narrowed onto an ellipsis loses just
 * as many letters as one that is not drawn. The test below this one reads for
 * that shape rather than for the declaration.
 *
 * A hidden control is not content taken away, which is why five sheets hide
 * something behind a query that is in em: the button that folds the navigation,
 * the three that fold a panel open, and the words beside each checkbox in the
 * rights matrix. What goes there is a control whose whole job is to reach a
 * layout that is now on the screen anyway, or a label the column heading now
 * carries.
 */
const IN_PIXELS = new Map([
  [
    'components/ColumnChart.css 559.98',
    'drops the seventh column of the chart and everything past it',
  ],
  [
    'styles/table.css 699.98',
    'drops the columns marked `table__hide-phone`, which is what the row holds',
  ],
  [
    'pages/Profile.css 699.98',
    'cuts the name of a race to an ellipsis (PDL P24, 12.08.2026, says this table scrolls instead)',
  ],
  [
    'pages/league/League.css 699.98',
    'cuts a competitor name and a race name to an ellipsis, both already clipped above',
  ],
])

describe('space and corners are chosen from the scale, not typed', () => {
  const sheets = stylesheets().filter((one) => one.path !== 'styles/tokens.css')

  it('reads every stylesheet in the portal', () => {
    /* Without this the checks below pass on an empty list, which is the shape
       every sweeping test fails in. */
    expect(sheets.length).toBeGreaterThan(30)
    expect(sheets.some((one) => one.path === 'pages/Home.css')).toBe(true)
    expect(sheets.some((one) => one.path === 'app/Shell.css')).toBe(true)
  })

  it('leaves no bare space value outside the ones named here', () => {
    const bare: string[] = []

    for (const sheet of sheets) {
      for (const rule of sheet.css.matchAll(SPACING)) {
        const property = at(rule, 1)
        const value = at(rule, 2).trim()
        /* The whole value, so a failure names what is actually written rather
           than the first number a reader of the regex happens to reach. */
        const key = `${sheet.path} | ${property} | ${value}`

        if (ALLOWED.has(key) || !VALUE.test(value)) {
          VALUE.lastIndex = 0
          continue
        }
        VALUE.lastIndex = 0

        /* A value is clean when every number in it came from a token. */
        if (value.replaceAll(/var\(--[a-z0-9-]+\)/g, '').match(VALUE) !== null) {
          bare.push(key)
        }
      }
    }

    expect(bare).toEqual([])
  })

  it('leaves no bare corner outside a circle and two measured ones', () => {
    const measured = new Set([
      'app/Shell.css | border-radius | 2.5px',
      'components/ColumnChart.css | border-radius | 2px 2px 0 0',
      /* The foot of a two-level bar, which is the foot of the bar: the same two
         pixels, the other way up. */
      'components/ColumnChart.css | border-radius | 0 0 2px 2px',
    ])
    const bare: string[] = []

    for (const sheet of sheets) {
      for (const rule of sheet.css.matchAll(/(?<![-\w])([a-z-]*radius[a-z-]*)\s*:\s*([^;{}]+);/g)) {
        const value = at(rule, 2).trim()
        const key = `${sheet.path} | ${rule[1]} | ${value}`

        if (measured.has(key)) {
          continue
        }

        /* A circle is a shape and not a step, so 50% stays written out. */
        const left = value.replaceAll(/var\(--[a-z0-9-]+\)|50%|(?<![\d.])0(?![\d.])/g, '')

        if (left.match(VALUE) !== null) {
          bare.push(key)
        }
      }
    }

    expect(bare).toEqual([])
  })

  it('changes shape only at the widths listed here, each of which says why', () => {
    /* A custom property cannot be used in a media query, so these are the one
       thing here that cannot become a token. They are held instead.
     *
     * They also turned out not to be the drift the rest of this was: eleven
     * widths went to ten, because six of the eight moves changed a layout and
     * had to go back. Each width that is not one of the four the page uses
     * carries a comment where it is written saying what sets it.
     *
     * The pattern is deliberately loose about how the query is spelled: `@media
     * screen and (...)`, a second condition in the same query, and a missing
     * space all used to slip past a stricter one. */
    const widths: string[] = []

    const seen: string[] = []

    for (const sheet of sheets) {
      /* Only `@media`. A container query asks the same question of a box rather
         than of the window, so its widths are a property of one component and
         not a place where the portal changes shape.
       *
       * Read with the comments blanked out. A query explained in prose is not a
       * query: the note above the container query in TopBoards.css says why it
       * is not an `@media` one, and saying so made this guard count a width the
       * sheet does not have and fail on a sentence. */
      const conditions = [...unremarked(sheet.css).matchAll(/@media([^{]*)\{/g)].map((one) => one[1] ?? '').join(' ')
      const found = [...conditions.matchAll(WIDTH)]

      /* Every way of asking about a width, or the guard is a guard against one
         spelling. `@media (width >= 25em)` is the same question in the syntax
         that replaced this one, and it used to walk straight past: no unit
         checked, no width checked, and a breakpoint off the scale below with
         nothing said. Counted rather than matched loosely, so the next spelling
         that arrives fails here instead of being waved through. */
      expect(
        found.length,
        `${sheet.path} asks about a width in a way this guard cannot read`,
      ).toBe((conditions.match(/width/g) ?? []).length)

      for (const query of found) {
        /* Read as pixels whichever unit it is written in. Sixteen is the initial
           font size, which is what a width query in em is measured against: not
           the root font size, which a stylesheet can set, but the one the
           reader's browser starts from. */
        const written = Number(query[1])
        const unit = query[2]
        const at = Math.round((unit === 'em' ? written * 16 : written) * 1e5) / 1e5
        const key = `${sheet.path} ${at}`
        const wanted = IN_PIXELS.has(key) ? 'px' : 'em'

        expect(unit, `${sheet.path} sets the breakpoint at ${at} in ${unit}`).toBe(wanted)

        if (wanted === 'px') {
          seen.push(key)
        }

        widths.push(String(at))
      }
    }

    /* And every exception is a live one. Keyed by sheet and width rather than by
       sheet, because three of those four sheets hold other queries that only
       change shape and are in em like everything else; keyed by sheet alone, one
       exception would have dragged all of Profile.css back to pixels. Checked
       for rather than assumed, so that deleting the query leaves the reason
       written here failing instead of standing as documentation for a rule that
       is no longer anywhere. */
    expect(seen.sort()).toEqual([...IN_PIXELS.keys()].sort())

    expect([...new Set(widths)].map(Number).sort((left, right) => left - right)).toEqual([
      // A telephone stops being a telephone. Its other half, so the two do not
      // both fire on the pixel where they meet.
      559.98, 560,
      // A narrow window, where a table gives up its columns. Same, and its half.
      620, 699.98, 700,
      // The wide layout, and the navigation stops folding away, with its half.
      780, 819.98, 820,
      // Set by their own content, each said where it is written: the front page
      // at 860, the rights table and the Top liste at 900.
      860, 900, 1000,
    ])
  })

  /**
   * And nothing goes off the screen behind a query that moves with the text.
   *
   * The sorting above is a judgement, and it was made by hand and made wrong
   * twice: the first pass looked for `display: none` and nothing else, so two
   * queries that narrow a column onto an ellipsis went into em, where at 200 per
   * cent text they would have cut the name of a race off a 1280 screen. An
   * independent read caught them. This is that read, mechanised, so the next one
   * is caught by the suite instead of by luck.
   *
   * Two shapes count as taking something away. One is a declaration that removes
   * it outright, `display: none` and its neighbours. The other is a width put on
   * a box that is clipped somewhere else in the same sheet, which is how the two
   * that were missed were written: the ellipsis is in the base rule and the
   * query only makes the column narrower.
   *
   * Everything found has to be named below with a reason, and the reason has to
   * be that nothing readable stops being readable.
   */
  it('takes nothing off the screen behind a width that moves with the text', () => {
    /* Read by the value and not by the property, because the same property
       undoes what it does: the half of a label swap that puts the short name
       back on the screen says `clip-path: none`, and a rule that reveals is not
       a rule that takes away.
     *
     * The look-ahead sits against the colon with no `\s*` in front of it. Given
       one, the engine backtracks the space away, asks "is `none` here?" at the
       space instead of at the word, is told no, and every `clip-path: none` on
       the portal reads as a rule that hides something. */
    const TAKING_AWAY =
      /display\s*:\s*none|visibility\s*:\s*hidden|clip-path\s*:(?!\s*none\b)|overflow\s*:\s*hidden|text-overflow\s*:\s*ellipsis/
    /* A measured width, not `auto`: the reveal half of a label swap says
       `width: auto`, which is the opposite of narrowing a column. */
    const NARROWS = /(?:max-)?(?:inline-size|width)\s*:\s*[\d.]/
    const CLIPS = /overflow\s*:\s*hidden|text-overflow\s*:\s*ellipsis/

    /* Read as `sheet selector`, each with why it costs the reader nothing. */
    const ALLOWED_TO_HIDE = new Map([
      ['app/Shell.css .shell__menu-button', 'the button that opens the navigation, which is now on the screen'],
      ['pages/admin/SectionNav.css .adminsection__toggle', 'the control that opens a panel that is now open'],
      ['pages/admin/Verification.css .pending__toggle', 'the same, on the queue of things to verify'],
      ['pages/Rulebook.css .rulebook__toggle', 'the same, on the table of contents'],
      ['pages/admin/Rights.css .rights__inline', 'the words beside a checkbox, which the column heading now carries and which are aria-hidden either way'],
      ['pages/admin/Verification.css .member:not(:has(.pending__card--open .field__required)) .pending__legend',
        'the line saying what the star means, on a screen where every card is folded and no star is drawn'],
      ['pages/Profile.css .profile__length-full', 'the long name of a length, swapped for the short one; both are in the accessible name, so nothing is lost to anybody'],
    ])

    const taken: string[] = []

    for (const sheet of sheets) {
      /* Comments blanked, here as above: a note explaining why a column is cut
         is not a rule that cuts one. */
      const css = unremarked(sheet.css)

      /* What this sheet clips wherever it says so, for the second shape. */
      const clipped = new Set(
        [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
          .filter((rule) => CLIPS.test(rule[2] ?? ''))
          .map((rule) => (rule[1] ?? '').trim().replaceAll(/\s+/g, ' ')),
      )

      for (const query of css.matchAll(/@media([^{]*)\{/g)) {
        const at = query.index + query[0].length

        if (![...(query[1] ?? '').matchAll(WIDTH)].some((one) => one[2] === 'em')) {
          continue
        }

        for (const rule of sheet.css.slice(at, closes(css, at)).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          const selector = (rule[1] ?? '').trim().replaceAll(/\s+/g, ' ')
          const body = rule[2] ?? ''

          if (TAKING_AWAY.test(body) || (NARROWS.test(body) && clipped.has(selector))) {
            taken.push(`${sheet.path} ${selector}`)
          }
        }
      }
    }

    expect([...new Set(taken)].filter((one) => !ALLOWED_TO_HIDE.has(one))).toEqual([])
  })
})

/**
 * A copy of the stylesheet with the inside of every comment blanked out, and the
 * same length as what went in, so a position in it is a position in the original.
 *
 * Every sheet here explains itself, and the explanations name the very things
 * these guards read for. A comment saying why one query is not an `@media` one
 * is not an `@media` query, and a comment about `display: none` hides nothing.
 */
function unremarked(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
}

/** Where the block that opens at `at` closes, counted rather than searched for:
 *  the first `}` after a media query ends the first rule inside it. */
function closes(css: string, at: number): number {
  let depth = 1

  for (let index = at; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1
    } else if (css[index] === '}') {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }
  }

  throw new Error(`the block at ${at} is never closed`)
}

describe('the width prose is allowed', () => {
  it('gives the written pages the whole width, with no measure of their own', () => {
    /* Owner, 12.08.2026: „Sve strane treba da koriste punu širinu strane za
       prikaz teksta. Dakle tekst se lomi tek na kraju redova." A measure of
       78ch stood on both of the rules that draw prose, and it is what made the
       rulebook break its lines halfway across the screen.
     *
       Held as text, because jsdom lays nothing out: what is asked is that
       neither rule name a width at all, so a measure put back anywhere in
       either sheet fails here rather than on somebody's screen. */
    for (const sheet of ['src/pages/StaticPage.css', 'src/components/Markdown.css']) {
      const css = readFileSync(join(process.cwd(), sheet), 'utf-8')

      expect(css).not.toMatch(/max-(width|inline-size):\s*\d+(ch|rem|px)/)
    }
  })
})

describe('the columns of the results table on a profile', () => {
  it('are pinned, and pinned in a unit the head and the body agree on', () => {
    /* Owner, 12.08.2026: „Kad se na strani takmičara klikće po filterima za
       dužinu trke, kolone njegovih rezultata mrdaju levo desno. Treba ih
       zakucati." A table sizes its columns to what is in them, so every filter
       moved the whole row.
     *
       Two things are held. That the table is `fixed`, without which the widths
       are only a suggestion. And that they are written in `rem`: `ch` is the
       width of a digit in the font of the element it is written on, and with a
       fixed layout the row that decides a column is the head, whose letters are
       smaller, so every column came out at seventy one per cent of what it asked
       for. Measured in a browser, not here: jsdom lays nothing out. */
    const css = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')
    const at = css.indexOf('.profile__results .table {')

    expect(css.slice(at, css.indexOf('}', at))).toContain('table-layout: fixed')

    const pinned = [...css.matchAll(/\.profile__results \.table td:nth-child\(\d\)[^{]*\{([^}]*)\}/g)]

    /* Five rules holding six of the seven columns: the fourth and the fifth are
       the same width and share a rule. The one left out is the second, the
       event, which takes what the other six do not and is the only one that
       wraps.

       Six rules and not five, because the length is pinned twice: once for every
       width, and once again on a telephone, where the coloured dot leaves the
       cell and the column narrows by what the dot was taking. */
    expect(pinned).toHaveLength(6)

    for (const rule of pinned) {
      expect(rule[1]).toMatch(/inline-size:\s*[\d.]+rem;/)
    }
  })

  it('leaves the event a column even when the reader makes the text bigger', () => {
    /* Every pinned width is in `rem` and grows with the reader's text; the page
       does not. The one column that is not pinned takes what is left, and what
       was left ran out: at 125% text the event's column was ten pixels wide with
       eight of padding on each side, so the name was clipped away entirely, and
       at 200% the column had no width at all. That is loss of content under
       WCAG 2.2 SC 1.4.4, and it arrived with the pinning.

       So the table has a floor of its own, and the floor is the pinned columns
       plus room for the event. Past it the table is wider than the page and
       scrolls inside its own box, which is what it did before the columns were
       pinned and what `.table-scroll` is for. Measured in Chrome at 360, 375 and
       1280: at 200% text the event keeps 4,25 rem on a telephone and eight where
       the table is wide, and the box scrolls rather than the page. The whole of
       that arithmetic is walked at every supported width and text size in
       `tableWidths.test.ts`, which is where a fault of this kind belongs: both
       times it happened, it was a sum nobody had added up.

       Held as a sum rather than as a number, or the floor and the widths drift
       apart and the floor stops meaning anything. */
    const css = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')
    const wide = css.slice(0, css.indexOf('@media (max-width: 699.98px)'))
    const onPhone = css.slice(css.indexOf('@media (max-width: 699.98px)'))

    /* Rule by rule, and every column named in each rule.
     *
       Written as one pattern from the selector to the width, it swallowed the
       fourth and the fifth: those two share a rule, and a global match starting
       at the fourth ran past the fifth to the width they share. The pinned sum
       came out four rem short and the floor had four rem of slack it did not
       know about, so the guard could not fail on the one drift it exists for.
       Doubling that shared rule to 8rem left the event nothing at all and the
       test stayed green. */
    const pinnedIn = (part: string) =>
      part.split('}').flatMap((rule) => {
        const width = /inline-size:\s*([\d.]+)rem;/.exec(rule)
        const columns = [...rule.matchAll(/\.table td:nth-child\((\d)\)/g)]

        return width === null
          ? []
          : columns.map((column): [string, number] => [column[1] ?? '', Number(width[1])])
      })

    /* The wide layout pins six columns; a telephone hides three of them and pins
       the length again, narrower. */
    const wideColumns = new Map(pinnedIn(wide))
    const phoneColumns = new Map([...wideColumns, ...pinnedIn(onPhone)])
    const hidden = ['4', '5', '6']

    /* Which six, by name. A column that drops out of the reading falls out of
       the sum as well, and a sum that is quietly short is a floor that passes
       whatever happens above it. */
    expect([...wideColumns.keys()].sort()).toEqual(['1', '3', '4', '5', '6', '7'])

    const floorIn = (part: string) => {
      const written = /\.profile__results \.table \{[^}]*min-inline-size:\s*([\d.]+)rem;/.exec(part)

      expect(written, 'the table has no floor').not.toBeNull()

      return Number(written?.[1])
    }

    const wideSum = [...wideColumns.values()].reduce((all, one) => all + one, 0)
    const phoneSum = [...phoneColumns.entries()]
      .filter(([column]) => !hidden.includes(column))
      .reduce((all, [, one]) => all + one, 0)

    /* Eight rem for the event where the table is wide, and 4,25 on a telephone,
       which is what is left over there once the three columns it keeps have
       taken theirs.
     *
       The telephone floor is bounded on both sides, and the upper bound is the
       one that was missing: 20,5rem is the content column of a screen of 360,
       the narrowest this portal answers for (CLAUDE.md), so a floor above it
       makes the table scroll sideways at the ordinary text size on a plain
       Android phone, which PDL P24 forbids. */
    expect(floorIn(wide) - wideSum).toBeGreaterThanOrEqual(8)
    expect(floorIn(onPhone) - phoneSum).toBeGreaterThanOrEqual(4.25)
    expect(floorIn(onPhone)).toBeLessThanOrEqual(20.5)
  })

  it('is never narrower than the widest thing the league can put in it', () => {
    /* Which is the whole point of the numbers, and what nothing held: the rule
       above is happy with any number of `rem`, so the date column could be cut
       to five and „31. 12. 2027." would be broken across two lines with nothing
       to say why.

       Measured in Chrome, in the cell's own font at 16 pixels with its 8 and 8
       of padding, against the widest the owner named on 12.08.2026: a date in
       full, a thousand kilometres, a climb of 88.888 metres, a time of 888:59:59
       and 200,00 points. Three things go into each number and leaving any of
       them out is how this went wrong once already:

       - the value **as the portal writes it**, so a thousand kilometres is
         „1.000,00" and not „1000,00", a separator wider;
       - the **weight the cell is set in**: the length and the points are
         `table__points`, which is bold, and „1.000,00" is 63,89 pixels there
         against 58,69 at the ordinary weight. Measured at the ordinary weight,
         the length was pinned at 96 and needed 97,48, so a thousand kilometres
         went on breaking into two lines under a floor that said it did not;
       - **whatever else stands in the cell**, which for the length is a coloured
         dot and the space after it, 17,59 pixels the number never sees;
       - the **head**, where it is wider than anything the body can hold, which
         is the points column.

       Measured with the first two left out, the length asked for 55,22 and was
       given 72, and every distance from a hundred kilometres up wrapped to a
       second line: the fault the owner reported, still there, under a floor that
       said it was not.

       A floor and not the number itself: wider than needed costs a few pixels of
       the event's column and is a judgement, narrower cuts a value in half and
       is a fault. */
    const css = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')
    const floors = [
      { column: 1, need: 104.17, of: 'a date in full' },
      { column: 3, need: 97.48, of: 'a dot and 1.000,00 kilometres, in bold' },
      { column: 4, need: 62.59, of: 'a climb of 88.888' },
      { column: 5, need: 62.59, of: 'a fall of 88.888' },
      { column: 6, need: 83.31, of: '888:59:59' },
      { column: 7, need: 66.36, of: '200,00 in bold, wider than the word Bodovi' },
    ]
    /* And the same column again on a telephone, where the dot is gone and the
       number is all that is left to hold: 16 of padding and 63,89 of „1.000,00"
       in bold. Measured the same way and written here as well, or the narrower
       rule could be cut to anything and the first floor would go on passing,
       since it reads the wider rule above it. */
    const onPhone = css.slice(css.indexOf('@media (max-width: 699.98px)'))
    const narrow = /\.table td:nth-child\(3\)[^{]*\{[^}]*inline-size:\s*([\d.]+)rem;/.exec(onPhone)

    expect(narrow, 'the length column is not pinned on a telephone').not.toBeNull()
    expect(Number(narrow?.[1]) * 16, 'a telephone cuts 1.000,00').toBeGreaterThanOrEqual(79.89)

    /* And that floor holds only while the dot is out of the cell. Written
       without this, the dot could come back on a telephone and the number would
       spill 17,59 pixels past a column the test went on calling wide enough. */
    expect(onPhone).toContain('.profile__results .table .profile__dot {')
    expect(onPhone.slice(onPhone.indexOf('.profile__dot {'))).toContain('display: none;')

    for (const { column, need, of } of floors) {
      const at = css.indexOf(`.profile__results .table td:nth-child(${column})`)


      expect(at, `column ${column} is not pinned`).toBeGreaterThan(-1)

      const written = /inline-size:\s*([\d.]+)rem;/.exec(css.slice(at, css.indexOf('}', at)))

      expect(written, `column ${column} has no width`).not.toBeNull()
      expect(Number(written?.[1]) * 16, `column ${column} cuts ${of}`).toBeGreaterThanOrEqual(need)
    }
  })
})
