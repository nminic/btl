import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor, sheetsOf, unremarked } from '../test/stylesheet'

/**
 * The two things the owner asked for on 07.09.2026 that live only in a stylesheet.
 *
 * **Why they need a guard at all.** Both are decisions, both are one line, and both were measured
 * by a review to be undoable with the whole gate staying green: `border-collapse` put back to
 * `collapse`, and the two-column query put back on the list of competitions. jsdom applies no
 * stylesheet, so nothing that draws a screen can see either (ADL A33, `styles/tableScroll.test.ts`
 * and `styles/outsideHost.test.ts` exist for the same reason and are the shape copied here).
 *
 * **What this holds and what it cannot.** It reads the declarations out of the sheet and asks that
 * the sheet reaches the screen that wears the class. Where the cut actually falls at a given width
 * is a browser's question and was answered in one: at 360, with the grid scrolled 260px sideways,
 * the horizontal rules of the scrolling half no longer cross „Član" and „Bodovi", and the list of
 * competitions is one box of 328px.
 */
const SRC = join(process.cwd(), 'src')
const LEAGUE = join(SRC, 'pages/league/League.css')
const LEAGUES = join(SRC, 'pages/Leagues.css')

/**
 * Every property a stylesheet can lay a track of columns with.
 *
 * A list, and one that can be complete: it is the CSS property set and not anything this portal
 * happens to write today. Four names cover both ways of asking for more than one column, the grid
 * (`grid-template-columns`, and the two shorthands that contain it) and the multi-column layout
 * (`column-count`, and the shorthand that contains it).
 */
const COLUMNS = ['grid-template-columns', 'grid-template', 'grid:', 'column-count', 'columns:']

describe('the grid of a competition', () => {
  it('lets each cell paint its own edge, so the frozen columns are opaque', () => {
    /* Owner, 07.09.2026: „a ne … da se ostatak podvlači ispod Člana i Bodova."
     *
     * With `collapse`, which is what every other table on the portal uses and what this one
     * inherited, the table paints the collapsed grid itself, in its own layer, and that layer does
     * not move with a sticky cell. Every horizontal rule of the scrolling half was therefore drawn
     * straight through the two columns that are supposed to be over them.
     *
     * Read through the browser's own parser rather than off the text, because the question is
     * whether the rule applies and not whether it is written down: wrapped in `@media print` it is
     * still there to be found and no longer draws anything on a screen. */
    const rule = ruleFor(readFileSync(LEAGUE, 'utf-8'), '.table.league__grid', 'League.css')

    expect(rule.getPropertyValue('border-collapse')).toBe('separate')
    /* Nought, or `separate` puts a gutter between every pair of cells and the table stops looking
       like one table. */
    expect(rule.getPropertyValue('border-spacing')).toBe('0px')
  })
})

describe('the list of competitions', () => {
  it('is one box across the page at every width', () => {
    /* Owner, 07.09.2026: „Lige treba da imaju boksove koji su širine cele strane, a ne polovine,
     * tako da bi primera radi sada tri lige stale u 3 reda."
     *
     * Asked as „this sheet lays no track of columns", over the whole file with its comments
     * blanked, rather than as „this one media query is not there". A second column can be asked
     * for at any width and in any of the four properties below, so naming the query that used to
     * do it would hold against putting that query back and against nothing else. */
    const sheet = unremarked(readFileSync(LEAGUES, 'utf-8'))
    const found = COLUMNS.filter((property) => sheet.includes(property))

    expect(found, 'the list of competitions is laid out in columns again').toEqual([])
  })

  it('reaches the sheet that puts its control beside the heading', () => {
    /* The row of a heading and a control is defined in `Rankings.css`, and this screen wears its
       classes. A class whose sheet no screen asks for is a class the bundle may leave out, and the
       portal has been bitten by exactly that (`styles/outsideHost.test.ts`). */
    const screen = join(SRC, 'pages/Leagues.tsx')
    const sheets = sheetsOf(screen, readFileSync(screen, 'utf-8'))

    expect([...sheets].some((one) => one.endsWith(join('pages', 'Rankings.css')))).toBe(true)
  })
})
