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
        const property = rule[1] as string
        const value = (rule[2] as string).trim()
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
        const value = (rule[2] as string).trim()
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
         not a place where the portal changes shape. */
      const conditions = [...sheet.css.matchAll(/@media([^{]*)\{/g)].map((one) => one[1] ?? '').join(' ')
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
      ['pages/Profile.css .profile__length-full', 'the long name of a length, swapped for the short one; both are in the accessible name, so nothing is lost to anybody'],
    ])

    const taken: string[] = []

    for (const sheet of sheets) {
      /* What this sheet clips wherever it says so, for the second shape. */
      const clipped = new Set(
        [...sheet.css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
          .filter((rule) => CLIPS.test(rule[2] ?? ''))
          .map((rule) => (rule[1] ?? '').trim().replaceAll(/\s+/g, ' ')),
      )

      for (const query of sheet.css.matchAll(/@media([^{]*)\{/g)) {
        const at = query.index + query[0].length

        if (![...(query[1] ?? '').matchAll(WIDTH)].some((one) => one[2] === 'em')) {
          continue
        }

        for (const rule of sheet.css.slice(at, closes(sheet.css, at)).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
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
