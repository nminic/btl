import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The results table on a profile, added up at every width and text size.
 *
 * Five of the faults found in this table were the same fault: a sum. Its columns
 * are pinned in `rem`, which grows with the reader's text, while the window does
 * not, so the two meet somewhere and one of them loses. Which combination they
 * meet at is arithmetic, and arithmetic is exactly what nobody was doing: the
 * widths were measured in a browser, at one width and one text size, and the
 * combinations nobody opened were the ones that were wrong.
 *
 * - Pinned in `ch`, every column came out at 71 per cent of what it asked for.
 * - Measured in the ordinary weight, the length column was 96 where it needed
 *   97,48, and a thousand kilometres broke into two lines.
 * - With no floor at all, the event's column was ten pixels wide at 125% text
 *   and gone at 200%.
 * - With a floor of 21,25rem, the table was wider than a 360 screen at the
 *   ordinary text size and scrolled sideways where it must not.
 *
 * The first draft of this file then made the same mistake it was written to
 * catch. It named the numbers it should have derived: the room was `screen - 32`
 * with the shell's `max-width` and its `rem` padding both unknown to it, and the
 * columns a telephone hides were a list written here by hand. Three edits that
 * break the portal left all of it green. So nothing below is named that the
 * stylesheet or the markup already says: the shell is read from `Shell.css` and
 * `tokens.css`, the hidden columns from the `<th>`s that carry the class, and
 * every rule is filtered by the media query it actually sits in.
 *
 * What a browser is still needed for is what a sum cannot see: what the glyphs
 * actually measure, and whether anything overflows that is not in the flow.
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
 * everything was measured at 375, where the fault did not show. 375 and 1280 are
 * kept for what they document rather than what they catch: inside one branch of
 * the phone query neither can fail where its neighbour passes.
 */
const SCREENS = [360, 375, 768, 1280]

/** What the reader may do to the text. WCAG 2.2 SC 1.4.4 asks for 200%. */
const TEXT = [16, 20, 24, 32]

/** Below this width the stylesheet hides three columns (`table.css`). */
const NARROW = 699.98

/** What the event's name needs to still be a column and not a sliver. */
const EVENT_FLOOR_REM = 4.25

/**
 * What a desktop scrollbar takes, measured at 768 and at 1280.
 *
 * `:root { scrollbar-gutter: stable }` reserves it whether or not it is drawn,
 * so it comes off the window on every desktop width. A telephone draws its bar
 * over the content and takes nothing, which is why 360 has the full 360.
 */
const SCROLLBAR = 15

type Pinned = Map<string, number>

/** One piece of a stylesheet, with the widths it applies at. */
type Piece = { min: number; max: number; body: string }

/**
 * A stylesheet split into the plain rules and each `@media` block.
 *
 * Rule by rule and query by query, because both shortcuts have already cost a
 * finding: a pattern running from one selector to the width swallowed the
 * second of two columns sharing a rule, and slicing the file at the phone query
 * put an unrelated `max-width: 620px` block among the rules for a desktop.
 */
function pieces(sheet: string): Piece[] {
  const found: Piece[] = []
  let plain = ''
  let at = 0

  for (;;) {
    const query = sheet.indexOf('@media', at)

    if (query === -1) {
      plain += sheet.slice(at)
      break
    }

    plain += sheet.slice(at, query)

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
    const min = /min-width:\s*([\d.]+)px/.exec(condition)
    const max = /max-width:\s*([\d.]+)px/.exec(condition)

    found.push({
      min: min === null ? 0 : Number(min[1]),
      max: max === null ? Infinity : Number(max[1]),
      body: sheet.slice(opens + 1, closes),
    })

    at = closes + 1
  }

  return [{ min: 0, max: Infinity, body: plain }, ...found]
}

/** Everything in a stylesheet that applies at one width, in cascade order. */
function appliesAt(sheet: string, screen: number): string {
  return pieces(sheet)
    .filter((piece) => screen >= piece.min && screen <= piece.max)
    .map((piece) => piece.body)
    .join('\n')
}

/**
 * Every column pinned at one width.
 *
 * The width pattern refuses a `-` in front of it, so `min-inline-size` and
 * `max-inline-size` cannot answer for `inline-size`. Writing a column as
 * `max-inline-size: 6.75rem; inline-size: 20rem;` used to be read as 6,75.
 */
function pinnedAt(screen: number): Pinned {
  const found: Pinned = new Map()

  for (const rule of appliesAt(profileCss, screen).split('}')) {
    const width = /(?:^|[\s;{])inline-size:\s*([\d.]+)rem;/.exec(rule)

    if (width === null) {
      continue
    }

    for (const column of rule.matchAll(/\.table td:nth-child\((\d)\)/g)) {
      found.set(column[1] ?? '', Number(width[1]))
    }
  }

  return found
}

/**
 * The floor under the whole table at one width.
 *
 * The last rule that sets one, not the first: a telephone is told the floor
 * twice, once with everything else and once again in its own query, and the
 * cascade means the second wins. Reading the first gave a 360 phone the desktop
 * floor of 38,5rem and reported a sideways scroll that does not happen.
 */
function floorAt(screen: number): number {
  const rules = appliesAt(profileCss, screen)
  const written = [
    ...rules.matchAll(/\.profile__results \.table \{[^}]*?min-inline-size:\s*([\d.]+)rem;/g),
  ]

  expect(written.length, `the table has no floor at ${screen}`).toBeGreaterThan(0)

  return Number(written[written.length - 1]?.[1])
}

/**
 * The columns a telephone hides, taken from the markup.
 *
 * The class sits on the `<th>`s, so a header's place in the row is its column
 * number. Naming them here instead let the stylesheet stop hiding them with
 * every test still green, and a 360 phone render a table 472px wide in a 328px
 * box with the race name squeezed to nothing.
 */
function hiddenColumns(): string[] {
  const head = profileTsx.slice(profileTsx.indexOf('<thead>'), profileTsx.indexOf('</thead>'))
  const hides = tableCss.includes('.table__hide-phone')

  return [...head.matchAll(/<th\b([^>]*)>/g)]
    .map((header, place) => ({ column: String(place + 1), off: (header[1] ?? '').includes('table__hide-phone') }))
    .filter((header) => hides && header.off)
    .map((header) => header.column)
}

/** What stands between the window and the table, read from the shell. */
function shellBox(): { limit: number; padRem: number } {
  const rule = /\.shell__main,\s*\r?\n\.shell__footer \{([^}]*)\}/.exec(shellCss)

  expect(rule, 'the shell no longer bounds the content').not.toBeNull()

  const limit = /max-width:\s*(\d+)px;/.exec(rule?.[1] ?? '')
  const pad = /padding-inline:\s*var\(--(space-\d+)\);/.exec(rule?.[1] ?? '')

  expect(limit, 'the shell has no width limit').not.toBeNull()
  expect(pad, 'the shell has no side padding').not.toBeNull()

  const token = new RegExp(`--${pad?.[1] ?? ''}:\\s*([\\d.]+)rem;`).exec(tokensCss)

  expect(token, 'the padding is not measured in rem').not.toBeNull()

  return { limit: Number(limit?.[1]), padRem: Number(token?.[1]) }
}

/** What the table is, at one width and one size, in pixels. */
function tableAt(screen: number, text: number) {
  const narrow = screen <= NARROW
  const hidden = hiddenColumns()
  const shown = [...pinnedAt(screen).entries()].filter(([column]) => !(narrow && hidden.includes(column)))
  const columns = shown.reduce((all, [, one]) => all + one, 0) * text

  const { limit, padRem } = shellBox()
  const window = screen - (narrow ? 0 : SCROLLBAR)
  const room = Math.min(window, limit) - 2 * padRem * text

  /* Never narrower than the columns it pins: a table cannot give back width it
     has already promised, so that is the third thing the box is measured
     against, not just the floor. */
  const table = Math.max(room, floorAt(screen) * text, columns)

  return { room, columns, table, event: table - columns, scrolls: table > room }
}

describe('the results table, added up rather than looked at', () => {
  it('fits the page at the ordinary text size, on every screen the portal answers for', () => {
    /* PDL P24: a table on a telephone has no horizontal scroll. That is written
       for the ordinary text size, which is the only size it was ever measured
       at. A floor set four fifths of a rem too high broke it on a 360 screen
       and nothing said so, because 375 was where it was measured. */
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

  it('keeps the columns pinned, which is what makes any of the sums true', () => {
    /* `table-layout: fixed` is the load-bearing declaration: without it the
       browser sizes columns by content and every width above is fiction. Taking
       it away renders the first column at 62px where 108 is pinned, which is
       the columns-move-when-you-press-a-filter fault this was written for, and
       every other test here stays green through it. */
    const rule = /\.profile__results \.table \{[^}]*\}/.exec(appliesAt(profileCss, 1280))

    expect(rule?.[0]).toContain('table-layout: fixed;')
  })

  it('leaves the scrolling to the box, and every box, not only the first', () => {
    /* Wider than its box is allowed and wider than the page is not, so the box
       has to be both the thing that scrolls and the thing everything inside is
       measured against.
     *
       The second half is what was missing. Words put off the screen for the eye
       and left in the page for a reader are `position: absolute`, so with no
       positioned box around them they were measured against the page: once the
       table was wider than its box, they sat forty pixels past the right edge
       and the page gained a sideways scroll to nothing. `position: relative`
       here is what makes `overflow-x` reach them.
     *
       Read with the comments stripped and across every rule that styles the
       class, because as a substring search over one block it passed when both
       declarations were commented out, and passed again when a later rule set
       `position: static` back. */
    const bare = tableCss.replace(/\/\*[\s\S]*?\*\//g, ' ')
    const rules = [...bare.matchAll(/\.table-scroll\s*\{([^}]*)\}/g)].map((rule) => rule[1] ?? '')

    expect(rules.length, 'nothing styles .table-scroll').toBeGreaterThan(0)
    expect(rules.some((rule) => /overflow(-x)?:\s*auto;/.test(rule))).toBe(true)
    expect(rules.some((rule) => /position:\s*relative;/.test(rule))).toBe(true)
    expect(rules.some((rule) => /position:\s*(static|initial);/.test(rule))).toBe(false)
  })

  it('reserves the scrollbar the sums take off the window', () => {
    /* The room above comes off the window by a constant, and a constant is only
       honest while the rule that causes it is still there. */
    expect(rootCss).toContain('scrollbar-gutter: stable;')
  })

  it('hides on a telephone exactly the columns the markup marks', () => {
    /* Both halves have to hold: the class on the headers, and a stylesheet that
       still turns it off. Either one alone is a list agreeing with itself. */
    const phone = appliesAt(tableCss, 360)

    expect(hiddenColumns()).not.toEqual([])
    expect(/\.table__hide-phone \{\s*display: none;/.test(phone)).toBe(true)
    expect(/\.table__hide-phone \{\s*display: none;/.test(appliesAt(tableCss, 1280))).toBe(false)
  })
})
