import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { first, must } from '../test/at'
import { PLATE_CLASSES } from '../test/plate'
import { ruleFor, ruleInMedia, sheetsOf, unconditionalRules, unremarked } from '../test/stylesheet'

/**
 * The things the owner asked for on 07.09.2026 that live only in a stylesheet.
 *
 * **Why they need a guard at all.** Each is a decision, each is a line or two of CSS, and each was
 * measured by a review to be undoable with the whole gate staying green: `border-collapse` put back
 * to `collapse`, the two-column query put back on the list of competitions, the name put back in
 * capitals, the circle taken away at every width. jsdom applies no stylesheet, so nothing that
 * draws a screen can see any of them (ADL A33, `styles/tableScroll.test.ts` and
 * `styles/outsideHost.test.ts` exist for the same reason).
 *
 * **This file has been rewritten twice by review, and both times for the same cause** (07.09.2026).
 * Five rounds went on filters: „is this property said anywhere else", asked by naming the selectors,
 * the properties and the sheets to look at. Each round found one more name off the list, because a
 * reading that has to enumerate has no floor. The filters were then replaced by a golden text, and
 * the very next round showed the golden text had the same disease one level up: **its scope** was
 * chosen by searching sheets for the word `plate`, and two of the owner's five sentences are about
 * the **circle**, which is called `portrait` and is defined in a shared sheet that the plate's own
 * sheet imports on its first line. `.rankings__table .portrait { display: none }` took the circle
 * off the main standing at every width with the whole gate green.
 *
 * So nothing here chooses its own scope by pattern any more. Three questions, each handed to
 * something that already answers it:
 *
 * - **Which sheets dress the plate:** the import graph (`sheetsOf`), not a search for a word. It
 *   follows `@import`, so the shared sheet of the circle is in whether or not anyone remembers it.
 * - **Which classes the plate wears:** the DOM (`PLATE_CLASSES`, floored in
 *   `components/namePlate.test.tsx` by rendering a plate and reading `classList`). The outer
 *   element writes its two classes through a template, so no reading of the source has them.
 * - **What those sheets say:** the whole of their text, compared. Not „is this property written
 *   somewhere else", which cannot be asked completely, but „is this sheet the text a browser was
 *   measured against", which cannot be asked incompletely.
 *
 * The named cases below still say **what each decision is**, by reading the one rule that carries
 * it; that is the readable half, and each falls when its rule is deleted or changed. The golden
 * text and the sweep are the floor under them.
 *
 * **What is outside all of it, written rather than left for a review to find:**
 *
 * - **The cascade between sheets.** A rule elsewhere of higher specificity, or later in the bundle,
 *   overriding one of these. jsdom computes no cascade (ADL A33) and the portal has been bitten by
 *   exactly that (`pages/league/League.css` records it twice). Measured in a real browser instead:
 *   at 360 with the grid scrolled 260px sideways the horizontal rules of the scrolling half no
 *   longer cross „Član" and „Bodovi"; the list of competitions is one box of 328px; the main
 *   standing draws no circle and its rows are 75px again, while the top boards on the same width
 *   still draw all thirty of theirs, and at 1280 the circle is back on both.
 * - **What an existing rule of another widget says.** The sweep sees that
 *   `components/ColumnChart.css` writes `.portrait` nine times and fails when that becomes ten; it
 *   does not read what those nine say. They dress the circles of a chart, which draws no plate. A
 *   sheet is only in that list because it names one of these classes at all.
 * - **A sheet reaching the plate without naming a class**, through `[class~="portrait"]` or such.
 *   Nothing on the portal is written that way.
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
 * The whole of what dresses a name beside a circle, as it stood when a browser was measured
 * against it on 07.09.2026.
 *
 * **Both sheets, because the component brings both:** its own, and the shared one that makes the
 * circle a circle, which its first line imports. The second was missing from the first draft of
 * this text and a review took the circle away from every screen by changing one word in it, with
 * the whole gate green.
 *
 * Comments are blanked and empty lines dropped, so prose does not churn this and what is compared
 * is the CSS that acts. Kept here rather than in a `.snap` file on purpose: this repo checks out
 * with CRLF on one machine and LF on another, and a golden text nobody can regenerate with a flag
 * is a golden text nobody regenerates without reading it.
 *
 * **Six of the owner's sentences are in here**, so the moment this fails is the moment to say
 * whether the edit keeps them: no capitals and no weight on a name (07.09.2026, and 13.08.2026 for
 * the weight); the circle beside the words rather than above them; two lines in the standing of a
 * competition and one in the tables; a pair as two circles above one another with a name beside
 * each; the circle smaller where the frozen column is capped; and the circle round, in white on
 * the member's own colour (PDL P13, and `styles/circle.test.ts` says the same in words).
 */
const PLATE_SHEETS = `=== components/NamePlate.css ===
@import './Portrait.css';
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
}

=== components/Portrait.css ===
.face-circle {
  border-radius: 50%;
  place-items: center;
  flex: none;
  overflow: hidden;
  background: hsl(var(--face-hue, 214) 45% 32%);
  color: var(--white);
  font-weight: 700;
  letter-spacing: 0.02em;
}
.portrait {
  display: grid;
  inline-size: 2.9rem;
  block-size: 2.9rem;
  font-size: 0.85rem;
}
.portrait--empty {
  background: transparent;
  border: 1px dashed var(--control-border);
}`

/**
 * Which sheets outside the plate's own name one of its classes, and how many times.
 *
 * Three of them dress the circle of another widget, which draws no plate: the chart on the top
 * boards, the ten faces on the front page, and the head of a profile. The fourth is the owner's
 * own decision of 07.09.2026, „Krug se ne crta ispod 700px", written against the main standing by
 * name, and it is read as a rule two cases below.
 *
 * A tenth mention in the chart fails this and is answered in one line. A **new** rule anywhere in
 * the portal aiming at a plate's class fails it too, and that is the thing this is for: that is
 * how the circle was taken off the main standing at every width with the gate green.
 */
const REACHED_FROM = [
  'components/ColumnChart.css: portrait x9',
  'pages/Home.css: portrait x2',
  'pages/Profile.css: portrait x2',
  'pages/Rankings.css: plate__faces x1',
]

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

/** Where a file sits under `src`, written the same way on either platform. */
function named(path: string): string {
  return relative(SRC, path).split(sep).join('/')
}

/** The sheets the plate brings, asked of the import graph and not of a search. */
function brought(): string[] {
  const screen = join(SRC, 'components/NamePlate.tsx')

  return [...sheetsOf(screen, readFileSync(screen, 'utf-8'))].map(named).sort()
}

/** How often one sheet names a class of the plate's, counted as a whole class and not as a prefix,
 *  so `.portrait--empty` is not a mention of `.portrait`. */
function mentions(css: string): string[] {
  return PLATE_CLASSES.flatMap((one) => {
    const found = css.match(new RegExp(`\\.${one}(?![\\w-])`, 'g'))

    return found ? [`${one} x${found.length}`] : []
  })
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
   * text holds is that the sheets say nothing else. */
  it('is written the way a name is written, and not the way a column heading is', () => {
    const rule = ruleFor(readFileSync(PLATE, 'utf-8'), '.plate', 'NamePlate.css')

    expect(rule.getPropertyValue('text-transform')).toBe('none')
    expect(rule.getPropertyValue('letter-spacing')).toBe('normal')
    expect(rule.getPropertyValue('font-weight')).toBe('400')
    /* And it reads from the left, in a cell the shared table rule would align right. */
    expect(rule.getPropertyValue('text-align')).toBe('start')
  })

  it('lays the two halves one under the other where a screen writes them', () => {
    /* The breaking is the sheet's, and two screens write the two halves
       (`components/NamePlate.tsx`, `OverTwoLines`): the standing of a competition, and each half of
       a pair on the board of best pairs. Both halves are named in one rule, because a
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
       grid, and a grid makes every child its own row. Two of the six screens hand over three
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
       circle stands **above** the name on all six screens and the name takes the whole column,
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
       **The answer has two halves and both are asked, but not both here.** „Below 700px, and above
       it drawn" is this rule. „**And only in the main standing**" is undone from two other sides,
       and each has its own floor: written into the plate's own sheets it changes the golden text,
       and written into any other sheet in the portal it changes the sweep two cases below. Both
       were measured undoing it with the gate green.
     *
       Measured in a browser after the change: at 360 the main standing draws no circle, one of
       seventeen names is on two lines as before, and the row is 75 pixels again; the top boards on
       the same width still draw all thirty of theirs; at 1280 the circle is back. */
    expect(
      ruleInMedia(
        readFileSync(RANKINGS, 'utf-8'),
        '(max-width: 699.98px)',
        '.rankings__table .plate__faces',
        'Rankings.css',
      ).getPropertyValue('display'),
    ).toBe('none')
  })

  it('is dressed by the sheets its own component brings, and by the text measured in a browser', () => {
    /* **The floor under every case above.** The cases say what each decision is; this says the
       sheets are the text those measurements were taken from. Two questions, both handed to
       something that answers them rather than to a pattern: which sheets, to the import graph;
       what they say, to the whole of their text.

       `sheetsOf` follows `@import`, so the shared sheet of the circle is in here whether or not
       anybody remembers that the circle is not called `plate`. A review took it away from all six
       screens by changing `display: grid` to `display: none` in it, and the first draft of this
       case, scoped by searching sheets for the word `plate`, stayed green.

       When this fails, the diff is the answer: read the change against the six sentences listed
       beside `PLATE_SHEETS` and, if it keeps them, write the new text there. */
    const found = brought().map((one) => `=== ${one} ===\n${acting(readFileSync(join(SRC, one), 'utf-8'))}`)

    expect(found.join('\n\n')).toBe(PLATE_SHEETS)
  })

  it('is reached into from these sheets and no others', () => {
    /* Every stylesheet of the portal except the two above, asked which of the plate's classes it
       names and how often. Found rather than listed on both sides: the sheets from the file
       system, the classes from the DOM (`test/plate.ts`, floored in
       `components/namePlate.test.tsx`).

       This is the half a golden text cannot hold, because a sheet that reaches in is not one of
       the plate's own. It is also the half that was missing when a review wrote
       `.rankings__table .portrait { display: none }` into `pages/Rankings.css`: the main standing
       drew no circle at any width, and the whole gate stayed green. */
    const own = new Set(brought())

    const found = everySheet(SRC)
      .filter((path) => !own.has(named(path)))
      .flatMap((path) => {
        const said = mentions(acting(readFileSync(path, 'utf-8')))

        return said.length > 0 ? [`${named(path)}: ${said.join(', ')}`] : []
      })
      .sort((one, two) => one.localeCompare(two))

    expect(found, 'a sheet outside the plate has begun to dress it').toEqual(REACHED_FROM)
  })

  it('reaches the sheet that makes the circle a circle', () => {
    /* `NamePlate` draws `.portrait` and does not define it: the circle is one decision in one
       place (ADL A7, `components/Portrait.css`). A class whose sheet nobody asks for is a class
       the bundle may leave out, and the portal has been bitten by exactly that. This is also what
       the two cases above stand on: drop the import and the plate is dressed by one sheet, which
       is a different golden text and a different sweep. */
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
