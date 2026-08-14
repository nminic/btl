import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The results table on a profile, added up rather than looked at.
 *
 * Its columns are pinned in `rem`, which grows with the reader's text, while the
 * window does not, so the two meet somewhere and one of them loses. Which
 * combination they meet at is arithmetic, and arithmetic is what nobody was
 * doing: the widths were measured in a browser at one width and one text size,
 * and the combinations nobody opened were the ones that were wrong. Five faults
 * in a row were that same sum.
 *
 * This file has now been rewritten twice after reviews took it apart, and both
 * times for the same reason: **it named a fact the stylesheet already stated.**
 *
 * - The first version fixed the room at `screen - 32`, so widening the shell's
 *   padding broke a 360 telephone with every test green.
 * - The second read the columns a telephone hides out of the markup, but wrote
 *   the width it hides them at by hand. Moving that breakpoint to 360px left the
 *   race name rendering zero pixels wide at 375, with every test green.
 *
 * So the rule this file lives by: **nothing is written here that source already
 * says.** Where a fact has two homes, both are read and required to agree.
 *
 * What it cannot know, said plainly rather than pretended away:
 *
 * - **Whether the text fits.** These widths were measured in a browser against
 *   the longest value the league can show. A sum cannot see a glyph, so
 *   narrowing a column is invisible to it. `MEASURED` below therefore records
 *   what was measured, and changing a width means measuring again.
 * - **What padding does inside a cell.** The pinned width includes it, so a
 *   change to cell padding changes what fits without changing any number here.
 * - **Anything not in the flow**: a browser is still needed for that.
 */
function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf-8')
}

const profileCss = read('src/pages/Profile.css')
const tableCss = read('src/styles/table.css')
const shellCss = read('src/app/Shell.css')
const tokensCss = read('src/styles/tokens.css')
const rootCss = read('src/index.css')
const profileTsx = read('src/pages/CompetitorProfile.tsx')

/**
 * The widths this portal answers for.
 *
 * 360 is the floor written into `CLAUDE.md`, and it is the one that was missed:
 * everything was measured at 375. The three between 375 and 768 are here because
 * a review moved the phone breakpoint to 375 and nothing noticed: no screen the
 * test knew about sat in the stretch that broke.
 */
const SCREENS = [360, 375, 480, 600, 700, 768, 1024, 1280]

/**
 * The widths measured as a telephone would be.
 *
 * A telephone draws its scrollbar over the content and takes no width for it; a
 * desktop reserves it, and `:root { scrollbar-gutter: stable }` reserves it
 * whether or not it is drawn. Measured at 15 pixels at 768 and at 1280.
 *
 * Deliberately its own list rather than the stylesheet's breakpoint. That
 * breakpoint decides which columns are drawn; this decides how the window is
 * measured. The two carry the same number today and are not the same thing, and
 * a review found the test had welded them together.
 */
const PHONE_SCREENS = [360, 375, 480, 600]
const SCROLLBAR = 15

/** What the reader may do to the text. WCAG 2.2 SC 1.4.4 asks for 200%. */
const TEXT = [16, 20, 24, 32]

/**
 * What an `em` in a media query is worth when nobody has touched the text.
 *
 * The root size the reader's browser starts from, which is theirs to change and
 * the whole reason the portal moved its breakpoints to `em` (#78, ADL A7). Only
 * a default: every sum here answers its queries at the size being tested, so a
 * rule behind `43.75em` is reached at 700 pixels for a reader on the default and
 * at 1400 for one at 200 per cent.
 *
 * Written as „never the reader's, sixteen everywhere that matters", it was the
 * opposite of the decision it cited, and the code followed the comment: a floor
 * moved behind an `em` query vanished at 200 per cent with every test green, and
 * the event column went with it.
 */
const ROOT_TEXT = 16

/** What the event's name needs to still be a column and not a sliver. */
const EVENT_FLOOR_REM = 4.25

/**
 * The pinned widths as they were measured, and the sum they make.
 *
 * Recorded because no reading of the source can tell whether a column still fits
 * its longest value: „27. 6. 2026." at 6,75rem, „1000,00 km" at 6,25rem, and
 * „200,00" at 4,25rem were each measured in a browser. A sum sees none of that,
 * so narrowing a column was invisible to every earlier version of this file.
 *
 * Changing a width here is allowed and expected. It means measuring again, in a
 * browser, at the ordinary text size and at 200%, and writing the new number in
 * both places. The point is that it cannot happen by accident.
 */
const MEASURED: Record<string, number> = {
  'profile.columns.date': 6.75,
  'profile.columns.distance': 6.25,
  'rankings.columns.ascent': 4,
  'rankings.columns.descent': 4,
  'profile.columns.time': 5.25,
  'profile.columns.points': 4.25,
}

/** And the same for the telephone, which narrows the distance and hides three. */
const MEASURED_ON_PHONE: Record<string, number> = {
  ...MEASURED,
  'profile.columns.distance': 5.25,
}

/**
 * Which column each heading is, read from the markup.
 *
 * Keyed by the heading rather than by the position it happens to hold today.
 * Written as `'1'`, `'3'`, `'4'`, nothing tied a width to the thing it was
 * measured against: swapping the date and the event in `CompetitorProfile.tsx`
 * left every test green while all six widths moved onto other columns and each
 * heading stopped naming what was under it.
 */
function columnOf(heading: string): string {
  const head = profileTsx.slice(profileTsx.indexOf('<thead>'), profileTsx.indexOf('</thead>'))
  const at = [...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].findIndex((one) =>
    (one[1] ?? '').includes(`'${heading}'`),
  )

  expect(at, `no heading reads ${heading}`).toBeGreaterThan(-1)

  return String(at + 1)
}

/** The measured widths against the columns they were measured on. */
function byColumn(measured: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(measured).map(([heading, width]) => [columnOf(heading), width]),
  )
}

type Pinned = Map<string, number>

/** A width a query names, in the unit it was written in. */
type Bound = { value: number; em: boolean }

/** One piece of a stylesheet, with the widths it applies at and where it sat. */
type Piece = {
  min: Bound | null
  max: Bound | null
  /** Whether the bound excludes the width it names (`>` rather than `>=`). */
  strictMin: boolean
  strictMax: boolean
  body: string
  at: number
}

/**
 * A stylesheet split into its plain rules and each `@media` block, in the order
 * they are written.
 *
 * In order, because the cascade is an order: an earlier version gathered every
 * plain rule ahead of every query, so a plain rule written after a query looked
 * overridden by it while the browser had it winning. A floor added at the end of
 * the file that made a telephone scroll sideways was read as harmless.
 */
function pieces(sheet: string): Piece[] {
  const found: Piece[] = []
  let plain = ''
  let plainFrom = 0
  let at = 0

  const keepPlain = (text: string, from: number): void => {
    if (text.trim() !== '') {
      found.push({ min: null, max: null, strictMin: false, strictMax: false, body: text, at: from })
    }
  }

  for (;;) {
    const query = sheet.indexOf('@media', at)

    if (query === -1) {
      keepPlain(plain + sheet.slice(at), plainFrom)
      break
    }

    plain += sheet.slice(at, query)
    keepPlain(plain, plainFrom)
    plain = ''

    const opens = sheet.indexOf('{', query)
    let depth = 0
    let closes = opens

    for (; closes < sheet.length; closes += 1) {
      if (sheet[closes] === '{') {
        depth += 1
      } else if (sheet[closes] === '}') {
        depth -= 1

        if (depth === 0) {
          break
        }
      }
    }

    const condition = sheet.slice(query, opens)
    /* Every spelling of a query, in both units, and kept in the unit it was
       written in.
     *
       `(min-width: 700px)` and `(width >= 700px)` are the same condition, and
       stylelint's own `media-feature-range-notation` rule asks for the second.
       The strict forms count too: `(width > 62.5em)` matched neither pattern
       when only `>=` and `<=` were read, so the block was taken to apply at
       every width at once, which is the very fault reading the new syntax was
       meant to close. A sibling guard (`scale.test.ts`) reads `[<>]=?`, so the
       two files disagreed about what a query even is.
     *
       And the unit is carried rather than converted here, because an `em` in a
       media query is resolved against the root size the reader's browser starts
       from, which is the whole reason the portal moved to `em` (#78, ADL A7).
       Converted at 16 once, every query answered as though nobody had ever
       enlarged their text: a floor written behind `(width >= 43.75em)` simply
       vanished at 200 per cent, and the event column with it. */
    const bound = (property: string, arrow: string): RegExp =>
      new RegExp(`(?:${property}-width:|width\\s*${arrow})\\s*([\\d.]+)(px|em)`)

    const read = (found: RegExpExecArray | null): Bound | null =>
      found === null ? null : { value: Number(found[1]), em: found[2] === 'em' }

    const min = read(bound('min', '>=?').exec(condition))
    const max = read(bound('max', '<=?').exec(condition))
    /* A strict bound excludes the width it names; a browser answers
       `(width > 62.5em)` false at exactly 62.5em. */
    const strict = (arrow: string): boolean => new RegExp(`width\\s*${arrow}(?!=)`).test(condition)

    found.push({
      min,
      max,
      strictMin: strict('>'),
      strictMax: strict('<'),
      body: sheet.slice(opens + 1, closes),
      at: query,
    })

    at = closes + 1
    plainFrom = at
  }

  return found
}

/** Everything in a stylesheet that applies at one width, in the order written. */
function appliesAt(sheet: string, screen: number, text = ROOT_TEXT): string {
  const inPixels = (bound: Bound): number => bound.value * (bound.em ? text : 1)

  return pieces(sheet)
    .filter((piece) => {
      const over =
        piece.min === null ||
        (piece.strictMin ? screen > inPixels(piece.min) : screen >= inPixels(piece.min))
      const under =
        piece.max === null ||
        (piece.strictMax ? screen < inPixels(piece.max) : screen <= inPixels(piece.max))

      return over && under
    })
    .map((piece) => piece.body)
    .join('\n')
}

/**
 * The class the markup uses to drop columns on a telephone, found rather than
 * named.
 *
 * Every class on a header, crossed with the ones a width query turns off. There
 * is exactly one, and requiring exactly one is the point: named here as a
 * literal, renaming it in both files at once changed nothing and failed three
 * tests, which is a guard people learn to work around.
 */
function hidingClass(): string {
  const head = profileTsx.slice(profileTsx.indexOf('<thead>'), profileTsx.indexOf('</thead>'))
  const onHeaders = new Set(
    [...head.matchAll(/className="([^"]+)"/g)].flatMap((one) => (one[1] ?? '').split(/\s+/)),
  )
  const turnedOff = [...onHeaders].filter((name) =>
    pieces(tableCss).some(
      (piece) =>
        piece.max !== null && new RegExp(`\\.${name}\\s*\\{[^}]*display:\\s*none`).test(piece.body),
    ),
  )

  expect(turnedOff, 'no class on a header is turned off at any width').toHaveLength(1)

  return turnedOff[0] ?? ''
}

/**
 * The width this portal hides those columns at, read from the stylesheet.
 *
 * Written here by hand it was the one fact left to guess, and moving it in
 * `table.css` to 360px rendered the race name zero pixels wide at 375 with every
 * test green.
 */
function phoneUpTo(text = ROOT_TEXT): number {
  const hiding = pieces(tableCss).find((piece) =>
    new RegExp(`\\.${hidingClass()}\\s*\\{[^}]*display:\\s*none`).test(piece.body),
  )

  expect(hiding, 'nothing hides those columns any more').toBeDefined()
  expect(hiding?.max, 'the columns are hidden with no upper width').not.toBeNull()

  /* Worked out in the size being asked about, since this breakpoint may be
     written in either unit: it is in pixels today and on purpose, because it
     takes content away (#78), while the sheet around it is not. */
  const edge = hiding?.max

  return edge === null || edge === undefined ? 0 : edge.value * (edge.em ? text : 1)
}

/**
 * Every column pinned at one width, read from both selectors that pin it.
 *
 * Both, and required to agree: with `table-layout: fixed` a column takes its
 * width from the first row, which is the header, so a rule that pins `td` alone
 * pins nothing. Reading `td` only, deleting the `th` half of a pair left the
 * date column sizing itself to its content again, which is the columns-move-when
 * -you-press-a-filter fault the pinning was written for, with every test green.
 *
 * `width` counts as well as `inline-size`. They render the same, and reading
 * only the logical spelling meant a column rewritten the other way vanished out
 * of every sum here without a word.
 */
function pinnedAt(screen: number, cell: 'th' | 'td', text = ROOT_TEXT): Pinned {
  const found: Pinned = new Map()

  for (const rule of appliesAt(profileCss, screen, text).split('}')) {
    const width = /(?:^|[\s;{])(?:inline-size|width):\s*([\d.]+)rem;/.exec(rule)

    if (width === null) {
      continue
    }

    for (const column of rule.matchAll(new RegExp(`\\.table ${cell}:nth-child\\((\\d)\\)`, 'g'))) {
      found.set(column[1] ?? '', Number(width[1]))
    }
  }

  return found
}

/** The floor under the whole table at one width, last one written wins. */
function floorAt(screen: number, text = ROOT_TEXT): number {
  const written = [
    ...appliesAt(profileCss, screen, text).matchAll(
      /\.profile__results \.table \{[^}]*?min-(?:inline-size|width):\s*([\d.]+)rem;/g,
    ),
  ]

  expect(written.length, `the table has no floor at ${screen}`).toBeGreaterThan(0)

  return Number(written[written.length - 1]?.[1])
}

/**
 * The columns a telephone hides, read from the markup, header and body alike.
 *
 * Both rows, and required to agree: taking the class off the three `<td>`s while
 * leaving it on the `<th>`s draws four headings over seven cells, so the ascent
 * sits under „Bodovi" and every column after it collapses. Read from the header
 * alone, that passed.
 */
function hiddenColumns(cell: 'th' | 'td'): string[] {
  const head =
    cell === 'th'
      ? profileTsx.slice(profileTsx.indexOf('<thead>'), profileTsx.indexOf('</thead>'))
      : profileTsx.slice(profileTsx.indexOf('<tbody>'), profileTsx.indexOf('</tbody>'))

  return [...head.matchAll(new RegExp(`<${cell}\\b([^>]*)>`, 'g'))]
    .map((one, place) => ({ column: String(place + 1), off: (one[1] ?? '').includes(hidingClass()) }))
    .filter((one) => one.off)
    .map((one) => one.column)
}

/** How many columns the table draws at all, headers and cells alike. */
function columnCount(cell: 'th' | 'td'): number {
  const part =
    cell === 'th'
      ? profileTsx.slice(profileTsx.indexOf('<thead>'), profileTsx.indexOf('</thead>'))
      : profileTsx.slice(profileTsx.indexOf('<tbody>'), profileTsx.indexOf('</tbody>'))

  return [...part.matchAll(new RegExp(`<${cell}\\b`, 'g'))].length
}

/**
 * What stands between the window and the table, read from the shell.
 *
 * Read by finding the rule that mentions `.shell__main` rather than by matching
 * one exact line of it: written as one literal, reordering the selectors or
 * spelling `max-width` as `max-inline-size` failed the test over a stylesheet
 * that renders identically. A guard that refuses a harmless edit is a guard
 * people learn to work around.
 */
function shellBox(): { limit: number; padRem: number } {
  const rule = pieces(shellCss)
    .flatMap((piece) => piece.body.split('}'))
    .find((one) => one.includes('.shell__main') && /max-(?:width|inline-size):/.test(one))

  expect(rule, 'nothing bounds the width of the content any more').toBeDefined()

  const limit = /max-(?:width|inline-size):\s*(\d+)px;/.exec(rule ?? '')
  const pad = /padding-inline:\s*var\(--(space-\d+)\)/.exec(rule ?? '')

  expect(limit, 'the shell has no width limit').not.toBeNull()
  expect(pad, 'the shell has no side padding').not.toBeNull()

  const token = new RegExp(`--${pad?.[1] ?? ''}:\\s*([\\d.]+)rem;`).exec(tokensCss)

  expect(token, 'the padding is not measured in rem').not.toBeNull()

  return { limit: Number(limit?.[1]), padRem: Number(token?.[1]) }
}

/** What the table is, at one width and one size, in pixels. */
function tableAt(screen: number, text: number) {
  const narrow = screen <= phoneUpTo(text)
  const hidden = hiddenColumns('th')
  const shown = [...pinnedAt(screen, 'th', text).entries()].filter(
    ([column]) => !(narrow && hidden.includes(column)),
  )
  const columns = shown.reduce((all, [, one]) => all + one, 0) * text

  const { limit, padRem } = shellBox()
  const window = screen - (PHONE_SCREENS.includes(screen) ? 0 : SCROLLBAR)
  const room = Math.min(window, limit) - 2 * padRem * text

  /* Never narrower than the columns it pins: a table cannot give back width it
     has already promised, so that is the third thing the box is measured
     against, not just the floor. */
  const table = Math.max(room, floorAt(screen, text) * text, columns)

  return { room, columns, table, event: table - columns, scrolls: table > room }
}

describe('the results table, added up rather than looked at', () => {
  it('fits the page at the ordinary text size, on every screen the portal answers for', () => {
    /* PDL P24: a table on a telephone has no horizontal scroll. That is written
       for the ordinary text size, which is the only size it was ever measured
       at. A floor set four fifths of a rem too high broke it on a 360 screen and
       nothing said so, because 375 was where it was measured. */
    const scrolling = SCREENS.filter((screen) => tableAt(screen, 16).scrolls)

    expect(scrolling).toEqual([])
  })

  it('leaves the event a column of its own at every text size', () => {
    /* And when the reader enlarges the text the table gives up fitting rather
       than giving up the name: it scrolls inside its own box, and the event
       keeps its floor. Written the other way round, the name went first. */
    const squeezed = SCREENS.flatMap((screen) =>
      TEXT.filter((text) => tableAt(screen, text).event < EVENT_FLOOR_REM * text).map(
        (text) => `${screen} at ${text}px`,
      ),
    )

    expect(squeezed).toEqual([])
  })

  it('pins every column at the width it was measured at, and one column at none', () => {
    /* The arithmetic above cannot see a glyph, so a column made narrower than
       its longest value is invisible to it: the date broke into three lines and
       every test stayed green. What is checkable is that the numbers are the
       ones somebody measured, so changing one is a decision rather than an
       accident, and re-measuring is the price.
     *
       And exactly one column carries no width of its own, because every sum here
       hands the whole remainder to the event. A second unpinned column shares
       that remainder in the browser and the model would not know. */
    expect(Object.fromEntries(pinnedAt(1280, 'th'))).toEqual(byColumn(MEASURED))
    expect(Object.fromEntries(pinnedAt(360, 'th'))).toEqual(byColumn(MEASURED_ON_PHONE))
    expect(columnCount('th') - Object.keys(MEASURED).length).toBe(1)
  })

  it('pins the header and the cell alike, and hides the same columns in both', () => {
    /* Two homes for one fact, so both are read and required to agree.
     *
       With `table-layout: fixed` a column takes its width from the first row,
       which is the header: a rule that pins `td` alone pins nothing at all, and
       deleting the `th` half of a pair let the date column size itself to its
       content again. And taking the hiding class off the three `<td>`s while
       leaving it on the `<th>`s draws four headings over seven cells. Both went
       through unseen. */
    expect(Object.fromEntries(pinnedAt(1280, 'td'))).toEqual(Object.fromEntries(pinnedAt(1280, 'th')))
    expect(Object.fromEntries(pinnedAt(360, 'td'))).toEqual(Object.fromEntries(pinnedAt(360, 'th')))
    expect(hiddenColumns('td')).toEqual(hiddenColumns('th'))
    expect(columnCount('td')).toBe(columnCount('th'))
  })

  it('keeps the columns pinned and the table filling its box', () => {
    /* Two load-bearing declarations, not one. `table-layout: fixed` is what
       makes the browser honour a pinned width instead of sizing by content, and
       `width: 100%` is what makes the table fill the box every sum here measures
       it against.
     *
       Only the first was guarded. Deleting the second, which reads as redundant
       beside a floor and six pinned columns, left the table 739 pixels wide in a
       box of 1068 at the ordinary text size, the event column at 251 instead of
       580, and every column shifting on each press of a length filter: the
       columns-move-when-you-press-a-filter fault this whole file exists for. All
       eight tests stayed green. */
    const pinned = /\.profile__results \.table \{[^}]*\}/.exec(appliesAt(profileCss, 1280))
    const shared = /(?:^|\})\s*\.table \{([^}]*)\}/.exec(tableCss)

    expect(pinned?.[0]).toContain('table-layout: fixed;')
    expect(shared?.[1], 'nothing sizes .table to its box').toMatch(/(?:width|inline-size):\s*100%;/)
  })

  it('is reached by the stylesheet at all, which is a fact with two homes', () => {
    /* Every rule above hangs off two class names, and both live in the markup as
       well as in the stylesheet. Read from the stylesheet alone, renaming either
       one in the markup detached the whole model without a single red test.
     *
       `profile__results` carries `table-layout: fixed`, all six pinned widths and
       both floors: renamed, a 360 telephone drew a 347 pixel table in a 328 pixel
       box, which is the sideways scroll PDL P24 forbids at the ordinary text
       size. `table-scroll` carries the scrolling and the positioning: renamed, at
       200% text the whole page scrolled sideways, 688 pixels against 360, taking
       the words meant only for a screen reader out past the right edge.
     *
       This is the third thing the file cannot work out for itself and now checks
       instead: not whether the numbers are right, but whether they reach the
       table at all. */
    const results = profileTsx.slice(profileTsx.indexOf('<section className="profile__results"'))

    expect(results, 'the results section is not named what the stylesheet styles').not.toBe('')
    expect(results).toContain('className="table-scroll"')
    expect(results).toContain('className="table"')
    expect(profileCss).toContain('.profile__results .table')
    expect(tableCss).toContain('.table-scroll {')
  })

  it('leaves the table nothing but the shell between it and the window', () => {
    /* The room above is the window less the shell's own padding, which is true
       only while nothing between the two adds any of its own. A single
       `padding-inline` on the section around the table takes eight pixels a side
       out of a box that has none to give: at 360 the box became 312 against a
       table of 328, and the telephone scrolled sideways at the ordinary text
       size with every test green.
     *
       Worth saying why this is so tight: at 360 the room is 328 and the floor is
       328, so the design has exactly nought pixels of slack there. Anything at
       all taken out of that chain shows immediately. */
    /* Every link in that chain, not one of them. Written for `padding` on
       `.profile__results` in one sheet alone, four edits walked past it and each
       broke a 360 telephone at the ordinary text size: padding on
       `.table-scroll`, a margin rather than a padding, the shell's own padding
       overridden inside a query, and a root font size that quietly grows every
       `rem` in the sums at once. */
    /* Every spelling of side spacing, including the long logical ones this code
       base actually prefers: `margin-inline-start` is already in `Shell.css` and
       `border-inline-start` in two more sheets. Written without them, half a rem
       of `padding-inline-start` on `.table-scroll` took the box's inside to 320
       against a table of 328 and the telephone scrolled sideways with every test
       green. Borders count too: they take width like padding does.
     *
       `-block` is deliberately absent: it takes height, not width. */
    const SIDES =
      /(?:padding|margin|border)(?:-inline(?:-start|-end)?|-left|-right)?(?:-width)?:\s*([^;]+)/g
    const SPACED = ['.profile__results', '.table-scroll']

    /* `auto` is not spacing: it centres what is already bounded and takes no
       width from it, which is exactly what the shell below does with
       `margin: 0 auto`. Counted regardless of value, the guard refused
       `margin-inline: auto`, a change that renders identically, and this file
       says twice over that a guard refusing a harmless edit is one people learn
       to work around. Nor is a zero. */
    const takesWidth = (value: string): boolean =>
      !/^(?:auto|0)(?:\s+(?:auto|0))*$/.test(value.trim())

    const spacing = [profileCss, tableCss].flatMap((sheet) =>
      SPACED.flatMap((name) =>
        [...appliesAt(sheet, 360, 16).matchAll(new RegExp(`\\${name} \\{([^}]*)\\}`, 'g'))].flatMap(
          (rule) =>
            [...(rule[1] ?? '').matchAll(SIDES)]
              .filter((one) => takesWidth(one[1] ?? ''))
              .map(() => name),
        ),
      ),
    )

    expect(spacing).toEqual([])

    /* The shell's padding is read off the first rule that names it, so a second
       one inside a query would change the room without changing what is read.
       Its `margin: 0 auto` is not counted: `auto` centres what is already
       bounded and takes no width from it. */
    const shellRules = [...appliesAt(shellCss, 360, 16).matchAll(/\.shell__main[^{]*\{([^}]*)\}/g)]
    const shellSpacing = shellRules.flatMap((rule) => [
      ...(rule[1] ?? '').matchAll(/(?:padding(?:-inline|-left|-right)?|margin-(?:inline|left|right)):/g),
    ])

    expect(shellSpacing).toHaveLength(1)

    /* And the root leaves the reader's own size alone, which is what every `rem`
       in these sums is counted in. `100%` is that, said out loud, and the sheet
       explains why it is written as a size rather than inside the `font`
       shorthand. Put to `1.125rem` instead, the floor of 20,5rem becomes 369
       pixels in a box of 324 and every sum above is out by an eighth, silently. */
    /* Every `:root` rule, not the first. The first one carries `100%`, so a
       second one anywhere later, which is what wins in the cascade, was never
       read: `:root { font-size: 1.125rem }` appended to the file, or tucked
       inside a „bigger text on a telephone" query, made every `rem` eighteen
       pixels and the floor 369 in a box of 324, with all ten tests green. That
       is the fourth fault this very commit claims to have closed, closed only
       for the first rule in the sheet. */
    const rootSizes = [
      ...appliesAt(rootCss, 360, 16).matchAll(/:root[^{]*\{[^}]*?font-size:\s*([^;]+);/g),
    ].map((one) => (one[1] ?? '').trim())

    expect(rootSizes.filter((size) => size !== '100%')).toEqual([])
  })

  it('leaves the scrolling to the box, and lets nothing later take it back', () => {
    /* Wider than its box is allowed and wider than the page is not, so the box
       has to be both the thing that scrolls and the thing everything inside is
       measured against.
     *
       Words put off the screen for the eye and left in the page for a reader are
       `position: absolute`, so with no positioned box around them they were
       measured against the page: once the table was wider than its box they sat
       forty pixels past the right edge and the page gained a sideways scroll to
       nothing.
     *
       Read with comments stripped and across every rule that styles the class.
       Both halves are guarded against a later rule taking them back: written for
       `position` only, a later `overflow-x: hidden` left a reader unable to
       reach the last two columns at all, and a later `position: fixed` slipped
       past a ban that named only `static`. */
    const bare = tableCss.replace(/\/\*[\s\S]*?\*\//g, ' ')
    const rules = [...bare.matchAll(/\.table-scroll\s*\{([^}]*)\}/g)].map((rule) => rule[1] ?? '')

    /* Every value that is written, not the absence of a bad one. Written as a
       lookahead, `\s*` gave back the space it had taken and the guard passed on
       the very declaration it was reading. */
    const valuesOf = (property: RegExp): string[] =>
      rules.flatMap((rule) => [...rule.matchAll(property)].map((one) => one[1] ?? ''))

    const overflow = valuesOf(/overflow(?:-x)?:\s*([a-z]+)/g)
    const position = valuesOf(/position:\s*([a-z]+)/g)

    expect(rules.length, 'nothing styles .table-scroll').toBeGreaterThan(0)
    expect(overflow).not.toEqual([])
    expect(position).not.toEqual([])
    expect(overflow.filter((one) => one !== 'auto')).toEqual([])
    expect(position.filter((one) => one !== 'relative')).toEqual([])
  })

  it('reserves the scrollbar the sums take off the window', () => {
    /* The room above comes off the window by a constant, and a constant is only
       honest while the rule that causes it is still there. */
    expect(rootCss).toContain('scrollbar-gutter: stable;')
  })

  it('hides on a telephone exactly the columns the markup marks', () => {
    /* Both halves have to hold: the class on the cells, and a stylesheet that
       still turns it off. Either one alone is a list agreeing with itself. */
    expect(hiddenColumns('th')).not.toEqual([])
    expect(phoneUpTo()).toBeGreaterThan(0)
  })
})
