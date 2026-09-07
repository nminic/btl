import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { first, must } from '../test/at'
import { ruleFor, ruleInMedia, sheetsOf, unconditionalRules, unremarked } from '../test/stylesheet'

/**
 * The things the owner asked for on 07.09.2026 that live only in a stylesheet.
 *
 * **Why they need a guard at all.** Each is a decision, each is a line or two of CSS, and each was
 * measured by a review to be undoable with the whole gate staying green: `border-collapse` put back
 * to `collapse`, the two-column query put back on the list of competitions, the name put back in
 * capitals. jsdom applies no stylesheet, so nothing that draws a screen can see any of them (ADL
 * A33, `styles/tableScroll.test.ts` and `styles/outsideHost.test.ts` exist for the same reason).
 *
 * **The shape below is the answer to six rounds of review, five of which were about this file and
 * none about the screen** (07.09.2026). Every one of the five was the same finding in a different
 * coat: a declaration written **somewhere else in the same sheet** that the reading did not look
 * at. A property off the list (`width` where the case asked for `inline-size`); a selector off the
 * filter (`.plate__words` where the filter asked for `.plate`); a selector spelt another way
 * (`&:not(.plate--pair)`, which a parser hands back unresolved); a second sheet (`NamePlate.css`
 * hiding a circle a case only looked for in `Rankings.css`). Each round closed one and left the
 * next open, because a reading that has to enumerate which selectors, which properties and which
 * sheets could say the opposite has no floor: there is always one more.
 *
 * So the question is turned around, and this is the repo's own rule for a guard whose rounds are
 * all about itself (`CLAUDE.md`, „čuvar se uprošćava do oblika koji ne može da bude u krivu"):
 *
 * - **The cases below say what each decision is**, by reading the one rule that carries it. They
 *   are the readable half and they fall when that rule is deleted or changed. None of them claims
 *   to know what the rest of the sheet says.
 * - **`dressed by the sheet a browser was measured against` is the floor**, and it cannot be asked
 *   incompletely: every declaration that acts is in it, at any depth, under any condition, under
 *   any name. A sixth way to undo one of these decisions is still a change to that text.
 *
 * That is the shape `pages/publicData.test.tsx` already uses: a hand-written table of what is
 * expected, and a derived floor that fails the day the table is short.
 *
 * **What is still outside all of it**, written as a boundary rather than left for a review: the
 * **cascade between sheets**. A rule in another stylesheet, of higher specificity or later in the
 * bundle, overrides one of these and nothing here can see it, because jsdom computes no cascade
 * (ADL A33) and the portal has been bitten by exactly that (`pages/league/League.css` records it
 * twice). That half is measured in a real browser and written down: at 360 with the grid scrolled
 * 260px sideways the horizontal rules of the scrolling half no longer cross „Član" and „Bodovi";
 * the list of competitions is one box of 328px; the main standing draws no circle and its rows are
 * 75px again, while the top boards on the same width still draw all thirty of theirs.
 */
const SRC = join(process.cwd(), 'src')
const LEAGUE = join(SRC, 'pages/league/League.css')
const LEAGUES = join(SRC, 'pages/Leagues.css')
const PLATE = join(SRC, 'components/NamePlate.css')
const RANKINGS = join(SRC, 'pages/Rankings.css')

/**
 * Every property a stylesheet can lay a track of columns with.
 *
 * A list, and one that can be complete: it is the CSS property set and not anything this portal
 * happens to write today. Four names cover both ways of asking for more than one column, the grid
 * (`grid-template-columns`, and the two shorthands that contain it) and the multi-column layout
 * (`column-count`, and the shorthand that contains it).
 */
const COLUMNS = ['grid-template-columns', 'grid-template', 'grid:', 'column-count', 'columns:']

/**
 * The whole of the sheet that dresses a name beside a circle, as it stood when a browser was
 * measured against it on 07.09.2026.
 *
 * Comments are blanked and empty lines dropped, so prose does not churn this and what is compared
 * is the CSS that acts. Kept here rather than in a `.snap` file on purpose: this repo checks out
 * with CRLF on one machine and LF on another, and a golden text nobody can regenerate with a flag
 * is a golden text nobody regenerates without reading it.
 *
 * **Five of the owner's sentences are in here**, so the moment this fails is the moment to say
 * whether the edit keeps them: no capitals and no weight on a name (07.09.2026, and 13.08.2026 for
 * the weight); the circle beside the words rather than above them; two lines in the standing of a
 * competition and one in the tables; a pair as two circles above one another with a name beside
 * each; and the circle smaller where the frozen column is capped.
 */
const PLATE_SHEET = `@import './Portrait.css';
.plate {
  display: inline-flex;
  align-items: center;
  gap: var(--space-10);
  text-align: start;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 400;
}
.plate .portrait {
  inline-size: 2.1rem;
  block-size: 2.1rem;
  font-size: 0.68rem;
}
.plate__words {
  min-inline-size: 0;
}
.plate__given,
.plate__family {
  display: block;
  line-height: 1.2;
}
.plate--pair .plate__faces {
  display: grid;
  gap: var(--space-4);
}
.plate--pair .plate__words {
  display: grid;
  gap: var(--space-4);
}
@media (max-width: 699.98px) {
  .plate {
    gap: var(--space-6);
  }
  .plate .portrait {
    inline-size: 1.7rem;
    block-size: 1.7rem;
    font-size: 0.55rem;
  }
}`

/** A sheet with its prose and its empty lines gone: what is left is what acts. `trimEnd` also takes
 *  the carriage return this repo checks out with on Windows, so the text is the same on either. */
function acting(css: string): string {
  return unremarked(css)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .join('\n')
}

/** Every stylesheet the portal has, found rather than listed. */
function everySheet(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return everySheet(join(dir, entry.name))
    }

    return entry.name.endsWith('.css') ? [join(dir, entry.name)] : []
  })
}

/** The sheets that dress a plate: those that write one of its classes outside a comment. */
function dressers(): string[] {
  return everySheet(SRC)
    .filter((path) => acting(readFileSync(path, 'utf-8')).includes('.plate'))
    .map((path) => relative(SRC, path).split(sep).join('/'))
    .sort((one, two) => one.localeCompare(two))
}

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
   * was measured in a browser at 360, at 1280 and at 200 per cent text; what the cases below hold
   * is that each rule is in the sheet and says what it was measured saying, and what the golden
   * text holds is that the sheet says nothing else. */
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
       children – the given name, the surname, and the initial a narrow card swaps in
       (`pages/TopBoards.tsx`, `NameOrInitial`) – so „Strahinja" and „Vukićević" stood one under
       the other on „Najviše kilometara" and „Najduže na stazi", at every width. That is the
       opposite of what the owner asked for, and on a narrow card it was worse than the wrap the
       container query exists to prevent: the given name with a lone „V." beneath it.

       Nothing drawn could see it: the fault is a height, and jsdom lays nothing out (ADL A33).
       Measured in a browser afterwards: at 1280 not one of the thirty names on those boards is on
       two lines. */
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
       and a long name then wraps of its own accord: nine of seventeen names ran to two lines where
       one did before, and the row grew from 75 to 100 pixels. This screen is one of the four he
       expects to be easiest on a telephone (PDL P24), so the circle is the half that gives way.
     *
       **The answer has two halves and both are asked.** „Below 700px" is the rule read here.
       „**And only in the main standing**" is the other half, and it is undone from the other side:
       `.plate__faces { display: none }` written into `NamePlate.css` takes the circle off the top
       boards and the standing of a competition too. That half is held by the golden text below,
       where such a rule is a change to the sheet.
     *
       Measured in a browser after the change: at 360 the main standing draws no circle, one of
       seventeen names is on two lines as before, and the row is 75 pixels again; the top boards on
       the same width still draw all thirty of theirs; at 1280 the circle is back. */
    const sheet = readFileSync(RANKINGS, 'utf-8')

    expect(
      ruleInMedia(
        sheet,
        '(max-width: 699.98px)',
        '.rankings__table .plate__faces',
        'Rankings.css',
      ).getPropertyValue('display'),
    ).toBe('none')

    /* **And this sheet says it once**, which the rule above cannot tell on its own (review,
       07.09.2026): the same selector written again after that block, unconditionally, wins on
       order at every width, and a review measured it - the circle back at 360, the name wrapping
       again, the row back from 75 to 100 pixels, with the whole gate green. Counted rather than
       filtered, over the sheet with its prose blanked, because a count has no list in it: a second
       mention of a plate class anywhere in this sheet, at any depth and in any shape, makes it
       two. The two directions meet here - move the rule out of the query and the case above fails,
       write a second one and this fails. */
    expect(
      acting(sheet).split('.plate').length - 1,
      'the sheet of the main standing says more than one thing about a plate',
    ).toBe(1)
  })

  it('is dressed by these two sheets and by no others', () => {
    /* Found rather than listed, so the day a third sheet starts writing a plate class this fails
       and somebody says whether it keeps the decisions the other two carry. The one written
       boundary: a sheet that reaches the plate without spelling the class, through
       `[class~="plate__faces"]` or such, is outside this. Nothing on the portal is written that
       way, and if something one day is, this is the sentence that was wrong. */
    expect(dressers()).toEqual(['components/NamePlate.css', 'pages/Rankings.css'])
  })

  it('is dressed by the sheet a browser was measured against, and nothing else', () => {
    /* **The floor under every case above** (07.09.2026, and the reason is written at the head of
       this file). The cases say what each decision is; this says the sheet is the text those
       measurements were taken from. It is the one question about a stylesheet that cannot be asked
       incompletely, and it is what five rounds of narrowing filters were reaching for.

       When this fails, the diff is the answer: read the change against the five sentences listed
       beside `PLATE_SHEET` and, if it keeps them, write the new text there. */
    expect(acting(readFileSync(PLATE, 'utf-8'))).toBe(PLATE_SHEET)
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
