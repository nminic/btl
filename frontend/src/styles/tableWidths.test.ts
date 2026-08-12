import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The results table on a profile, added up at every width and text size.
 *
 * Five of the faults found in this table were the same fault: a sum. Its columns
 * are pinned in `rem`, which grows with the reader's text, while the page does
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
 * Every one of those is caught here in a second, without a browser, at all
 * twenty combinations at once. What a browser is still needed for is what a sum
 * cannot see: what the glyphs actually measure, and whether anything overflows
 * that is not in the flow.
 */
const css = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')

/** Where the stylesheet stops speaking about wide screens. */
const PHONE = '@media (max-width: 699.98px)'
const wide = css.slice(0, css.indexOf(PHONE))
const onPhone = css.slice(css.indexOf(PHONE))

/**
 * The widths this portal answers for.
 *
 * 360 is the floor written into `CLAUDE.md`, and it is the one that was missed:
 * everything was measured at 375, where the fault did not show.
 */
const SCREENS = [360, 375, 768, 1280]

/** What the reader may do to the text. WCAG 2.2 SC 1.4.4 asks for 200%. */
const TEXT = [16, 20, 24, 32]

/** `.shell__main` holds the content off both edges by `--space-16`. */
const PAGE_PADDING = 16 * 2

/** Below this width the stylesheet hides three columns (`table.css`). */
const NARROW = 699

/** What the event's name needs to still be a column and not a sliver. */
const EVENT_FLOOR_REM = 4.25

type Pinned = Map<string, number>

/** Every column pinned in a part of the stylesheet, read rule by rule.
 *
 *  Rule by rule and not in one pass: the fourth and the fifth share a rule, and
 *  a pattern running from one selector to the width swallowed the second of
 *  them. */
function pinnedIn(part: string): Pinned {
  const found: Pinned = new Map()

  for (const rule of part.split('}')) {
    const width = /inline-size:\s*([\d.]+)rem;/.exec(rule)

    if (width === null) {
      continue
    }

    for (const column of rule.matchAll(/\.table td:nth-child\((\d)\)/g)) {
      found.set(column[1] ?? '', Number(width[1]))
    }
  }

  return found
}

function floorIn(part: string): number {
  const written = /\.profile__results \.table \{[^}]*min-inline-size:\s*([\d.]+)rem;/.exec(part)

  expect(written, 'the table has no floor').not.toBeNull()

  return Number(written?.[1])
}

/** The three columns a telephone hides (`Profile.css`, the same query). */
const HIDDEN = ['4', '5', '6']

/** What the table is, at one width and one size, in pixels. */
function tableAt(screen: number, text: number) {
  const narrow = screen <= NARROW
  const pinned = narrow ? new Map([...pinnedIn(wide), ...pinnedIn(onPhone)]) : pinnedIn(wide)
  const shown = [...pinned.entries()].filter(([column]) => !(narrow && HIDDEN.includes(column)))
  const columns = shown.reduce((all, [, one]) => all + one, 0) * text
  const floor = floorIn(narrow ? onPhone : wide) * text
  const room = screen - PAGE_PADDING
  const table = Math.max(room, floor)

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

  it('leaves the scrolling to the box, and the box holds everything inside it', () => {
    /* Wider than its box is allowed and wider than the page is not, so the box
       has to be both the thing that scrolls and the thing everything inside is
       measured against.
     *
       The second half is what was missing. Words put off the screen for the eye
       and left in the page for a reader are `position: absolute`, so with no
       positioned box around them they were measured against the page: once the
       table was wider than its box, they sat forty pixels past the right edge
       and the page gained a sideways scroll to nothing. `position: relative`
       here is what makes `overflow-x` reach them. */
    const table = readFileSync(join(process.cwd(), 'src/styles/table.css'), 'utf-8')
    const box = table.slice(table.indexOf('.table-scroll {'), table.indexOf('}', table.indexOf('.table-scroll {')))

    expect(box).toContain('overflow-x: auto;')
    expect(box).toContain('position: relative;')
  })
})
