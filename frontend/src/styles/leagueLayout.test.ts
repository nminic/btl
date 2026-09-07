import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { first, must } from '../test/at'
import {
  everyRule,
  ruleFor,
  ruleInMedia,
  sheetsOf,
  unconditionalRules,
  unremarked,
} from '../test/stylesheet'

/**
 * The two things the owner asked for on 07.09.2026 that live only in a stylesheet.
 *
 * **Why they need a guard at all.** Both are decisions, both are one line, and both were measured
 * by a review to be undoable with the whole gate staying green: `border-collapse` put back to
 * `collapse`, and the two-column query put back on the list of competitions. jsdom applies no
 * stylesheet, so nothing that draws a screen can see either (ADL A33, `styles/tableScroll.test.ts`
 * and `styles/outsideHost.test.ts` exist for the same reason and are the shape copied here).
 *
 * **What this holds and what it cannot, written as a boundary rather than discovered round by
 * round.** These cases read what a **sheet says**, through the browser's own parser, at every depth
 * and under every condition it is written in (`everyRule`). Three rounds of review each found one
 * more place a sheet can say something — a media block, a nested rule, a second rule further down —
 * and each was closed by widening the reading rather than by naming the place.
 *
 * What they cannot hold is the **cascade between sheets**: a rule in another stylesheet, of higher
 * specificity or later in the bundle, that overrides one of these. jsdom applies no stylesheet and
 * computes no cascade (ADL A33), so nothing here can see it, and the portal has been bitten by
 * exactly that before (`pages/league/League.css` documents it twice). That half is measured in a
 * real browser and written down: at 360 with the grid scrolled 260px sideways the horizontal rules
 * of the scrolling half no longer cross „Član" and „Bodovi"; the list of competitions is one box
 * of 328px; the main standing draws no circle and its rows are 75px again, while the top boards on
 * the same width still draw all thirty of theirs.
 */
const SRC = join(process.cwd(), 'src')
const LEAGUE = join(SRC, 'pages/league/League.css')
const LEAGUES = join(SRC, 'pages/Leagues.css')
const PLATE = join(SRC, 'components/NamePlate.css')

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

describe('the name of a competitor beside their circle', () => {
  /* Owner, 07.09.2026: „Imena i prezimena ne treba da budu sva velikim slovima, nego kružni logo
   * sa slikom ili inicijalima, i pored u dva reda Ime i Prezime."
   *
   * The capitals are not written by the standing; they come from `.table th`, which dresses every
   * heading on the portal, and the name of a competitor in the standing of a competition is a `th`
   * so that a screen reader can say whose row a number belongs to. Undone on the plate rather than
   * on that one cell, so the sixth screen that draws a name is right without being told.
   *
   * jsdom applies no stylesheet, so nothing that draws a screen can see any of this (ADL A33). It
   * was measured in a browser at 360, at 1280 and at 200 per cent text; what is held here is that
   * the rule is in the sheet and says what it was measured saying. */
  it('is written the way a name is written, and not the way a column heading is', () => {
    const rule = ruleFor(readFileSync(PLATE, 'utf-8'), '.plate', 'NamePlate.css')

    expect(rule.getPropertyValue('text-transform')).toBe('none')
    expect(rule.getPropertyValue('letter-spacing')).toBe('normal')
    expect(rule.getPropertyValue('font-weight')).toBe('400')
    /* And it reads from the left, in a cell the shared table rule would align right. */
    expect(rule.getPropertyValue('text-align')).toBe('start')
  })

  it('lays the two halves one under the other where a screen writes them', () => {
    /* The breaking is the sheet's, and only the standing of a competition writes the two halves
       (`components/NamePlate.tsx`, `OverTwoLines`). Both halves are named in one rule, because a
       rule that laid out one of them would leave the other on the line it was on; the selector is
       spelt the way the browser's own parser gives it back. */
    const laid = unconditionalRules(readFileSync(PLATE, 'utf-8'), 'NamePlate.css').filter(
      (rule) =>
        rule.selectorText.includes('.plate__given') &&
        rule.selectorText.includes('.plate__family'),
    )

    expect(laid.length, 'the two halves are not laid out together').toBe(1)
    expect(must(first(laid), 'the rule').style.getPropertyValue('display')).toBe('block')
  })

  it('lays the words beside the circle in a line, and only a pair in rows', () => {
    /* **Measured by a review on 07.09.2026, and it was a high finding.** `.plate__words` was a
       grid, and a grid makes every child its own row. Two of the five screens hand over three
       children — the given name, the surname, and the initial a narrow card swaps in
       (`pages/TopBoards.tsx`, `NameOrInitial`) — so „Strahinja" and „Vukićević" stood one under
       the other on „Najviše kilometara" and „Najduže na stazi", at every width. That is the
       opposite of what the owner asked for, and on a narrow card it was worse than the wrap the
       container query exists to prevent: the given name with a lone „V." beneath it.

       Nothing drawn could see it: the fault is a height, and jsdom lays nothing out (ADL A33).
       What is held here is the one declaration that caused it. Measured in a browser afterwards:
       at 1280 not one of the thirty names on those boards is on two lines. */
    /* **What puts the words beside the circle is the plate itself**, and that was the half this
       case was missing (review, 07.09.2026): with `display: inline-flex` gone from `.plate`, the
       circle stands **above** the name on all five screens and the name takes the whole column,
       and nothing said a word. Measured in a browser at 1280: the circle at `top 148,8 left 8` and
       the name at `top 146,4 left 51,6` becomes the circle at `top 204,4` and the name at
       `top 238 left 8`, 200px wide. */
    expect(
      ruleFor(readFileSync(PLATE, 'utf-8'), '.plate', 'NamePlate.css').getPropertyValue('display'),
      'the circle and the name no longer stand side by side',
    ).toBe('inline-flex')

    /* **And nowhere else in the sheet is it said otherwise.** Read unconditionally alone, the same
       declaration written inside this sheet's own telephone block put the circle above the name on
       every telephone with the whole gate green, and a review measured exactly that. `everyRule`
       reads the sheet wherever a rule is written. */
    expect(
      everyRule(readFileSync(PLATE, 'utf-8'), 'NamePlate.css')
        .filter((rule) => /[.]plate(?![-_])/.test(rule.selectorText))
        .map((rule) => rule.style.getPropertyValue('display'))
        .filter((said) => said !== '' && said !== 'inline-flex'),
      'the plate is laid out some other way at some width',
    ).toEqual([])

    const words = unconditionalRules(readFileSync(PLATE, 'utf-8'), 'NamePlate.css').filter(
      (rule) => rule.selectorText === '.plate__words',
    )

    expect(words.length, 'the words beside the circle have no rule at all').toBe(1)
    expect(
      must(first(words), 'the rule').style.getPropertyValue('display'),
      'the words beside the circle are laid out in rows again',
    ).toBe('')

    /* And a pair is the one thing that is: two circles above one another, and a name beside each
       (owner, 07.09.2026). */
    const pair = unconditionalRules(readFileSync(PLATE, 'utf-8'), 'NamePlate.css').filter(
      (rule) => rule.selectorText === '.plate--pair .plate__words',
    )

    expect(pair.length, 'a pair lays its two names nowhere').toBe(1)
    expect(must(first(pair), 'the rule').style.getPropertyValue('display')).toBe('grid')

    /* And at every width, not only unconditionally: the same declaration written inside this
       sheet's telephone block would bring the fault back exactly where a review measured it worst,
       ten of thirty names on 360. */
    expect(
      everyRule(readFileSync(PLATE, 'utf-8'), 'NamePlate.css')
        /* Selector by selector, and not over the whole list of them (review, 07.09.2026): a rule
           written `.plate--pair .plate__words, .plate__words` mentions the pair and lays every
           plate in rows, and an exception asked of the whole string let it through. */
        .flatMap((rule) =>
          rule.selectorText.split(',').map((one) => ({ one: one.trim(), style: rule.style })),
        )
        .filter(({ one }) => one.includes('.plate__words'))
        .filter(({ one }) => !one.includes('.plate--pair'))
        .map(({ style }) => style.getPropertyValue('display'))
        .filter((said) => said !== ''),
      'the words beside the circle are laid out in rows at some width',
    ).toEqual([])
  })

  it('has no weight of its own on either half of a name', () => {
    /* **A decision from 13.08.2026 that this component can undo silently.** The name of a
       competitor in the standing of a competition is written at 400 (`pages/league/League.css`)
       because a review measured that day that every name in that grid was bold while the same
       names on the ranking table were not. The plate draws inside that cell, so a weight written
       on either half brings back half of that fault, and the rule above reads the weight off
       `.plate` — where a declaration on a child never shows.
     *
       Measured when a review put the weight back: the surname came out at 700 against the given
       name's 400, and the row grew from 62,2 to 66,7 pixels, with the whole gate green. */
    /* Read wherever a rule is written, not only where it is written unconditionally: a review put
       the weight back inside this sheet's telephone block and the whole gate stayed green. */
    const dressed = everyRule(readFileSync(PLATE, 'utf-8'), 'NamePlate.css')
      .filter((rule) => /[.]plate__(given|family|words)/.test(rule.selectorText))
      .filter((rule) => rule.style.getPropertyValue('font-weight') !== '')
      .map((rule) => rule.selectorText)

    expect(dressed, 'a half of the name carries a weight of its own').toEqual([])
  })

  it('gives the circle up on a telephone, so the name keeps its letters', () => {
    /* In the standing of a competition the first column is frozen and capped at 7,5rem
       (`pages/league/League.css`), and the circle stands inside that cap. Measured in a browser at
       360 with the circle at its full size: the given name fitted and every long surname was cut,
       „Milovanović" and „Stanojlović" both ending in an ellipsis. At 1,7rem none of the six is
       cut. Nine pixels of circle are worth about a letter and a half of surname, and the circle
       says nothing the name does not.

       The width is the one the whole portal narrows its tables at, and it is written in pixels for
       the reason `styles/scale.test.ts` records beside it: it has to fire at the same window width
       as the cap it stands inside. */
    const rule = ruleInMedia(
      readFileSync(PLATE, 'utf-8'),
      '(max-width: 699.98px)',
      '.plate .portrait',
      'NamePlate.css',
    )

    expect(rule.getPropertyValue('inline-size')).toBe('1.7rem')
    expect(rule.getPropertyValue('block-size')).toBe('1.7rem')
  })

  it('is not drawn at all in the main standing on a telephone, which the owner chose', () => {
    /* **The owner's answer, with the measurement in front of him** (07.09.2026): „Krug se ne crta
       ispod 700px." The circle takes about thirty four pixels of a column that is 167 wide at 360,
       and a long name then wraps of its own accord — nine of seventeen names ran to two lines
       where one did before, and the row grew from 75 to 100 pixels. This screen is one of the four
       he expects to be easiest on a telephone (PDL P24), so the circle is the half that gives way.
     *
       **Two hand-written facts hold that answer and neither was read by anything** (review,
       07.09.2026): the class on the table, and the rule that hangs off it. Either could be deleted
       with the whole gate green, and the circle would be back at 360. Both are asked here.
     *
       Measured in a browser after the change: at 360 the main standing draws no circle, one of
       seventeen names is on two lines as before, and the row is 75 pixels again; the top boards on
       the same width still draw all thirty of theirs; at 1280 the circle is back. */
    const sheet = readFileSync(join(SRC, 'pages/Rankings.css'), 'utf-8')

    expect(
      ruleInMedia(
        sheet,
        '(max-width: 699.98px)',
        '.rankings__table .plate__faces',
        'Rankings.css',
      ).getPropertyValue('display'),
    ).toBe('none')

    /* **And the sheet nowhere says otherwise**, which one rule read on its own cannot tell
       (review, 07.09.2026). The same selector written again after that block, unconditionally,
       wins on order at every width, and a review measured it: the circle back at 360, the name
       wrapping again, the row back from 75 to 100 pixels, with 2701 cases green. Read through
       `everyRule`, a second rule about that circle is a second answer and fails here. */
    expect(
      everyRule(sheet, 'Rankings.css')
        .filter((one) => one.selectorText.includes('.plate__faces'))
        .map((one) => one.style.getPropertyValue('display'))
        .filter((said) => said !== 'none'),
      'the circle is given back at some width',
    ).toEqual([])

    /* That the table really wears this name is the other home of the same fact, and it is asked of
       the **drawn screen** rather than of the source (`pages/namePlateOnScreens.test.tsx`): read
       off the text of the file, a mention of the name in a comment answered for it, which a review
       measured. */
  })

  it('reaches the sheet that makes the circle a circle', () => {
    /* `NamePlate` draws `.portrait` and does not define it: the circle is one decision in one
       place (ADL A7, `components/Portrait.css`). A class whose sheet nobody asks for is a class
       the bundle may leave out, and the portal has been bitten by exactly that. */
    const screen = join(SRC, 'components/NamePlate.tsx')
    const sheets = sheetsOf(screen, readFileSync(screen, 'utf-8'))

    expect([...sheets].some((one) => one.endsWith(join('components', 'Portrait.css')))).toBe(true)
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
