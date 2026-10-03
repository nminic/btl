import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../test/at'
import { everyRule, ruleFor, rulesInMedia, unconditionalRules } from '../test/stylesheet'

/**
 * Arrangements that no rendered test can see, each found by an independent round and each
 * measured in Chrome rather than argued: the table of races on an event, the head of a
 * competitor, and the words an organiser writes under the name of an event.
 *
 * jsdom lays nothing out and applies no stylesheet (ADL A18), so what is asked here is that the
 * rules are written and declare what they are meant to declare. Whether they win is a question
 * for a browser, and the numbers each comment carries are what was measured there.
 */
const profile = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')
const shared = readFileSync(join(process.cwd(), 'src/styles/table.css'), 'utf-8')

/** Spaces and line breaks of a value or a selector, as one space: a sheet is laid out by whoever wrote it. */
const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/** The one query the table's wide shape is written behind: the wide layout (`styles/tokens.css`, 820px). */
const WIDE = '(min-width: 51.25em)'

/** Every rule of the sheet that is about the table of races, wherever it is written. */
const aboutTheTable = (rule: CSSStyleRule) => /event-races|table--races/.test(rule.selectorText)

/** The rule of the wide shape written for exactly this selector, and a failure naming it where there is
 *  none or more than one. */
function wide(selector: string): CSSStyleDeclaration {
  const found = rulesInMedia(profile, WIDE, 'Profile.css').filter((rule) => squash(rule.selectorText) === selector)

  expect(found.length, `${selector} is not one rule of ${WIDE} in Profile.css`).toBe(1)

  return must(found[0], `the rule ${selector}`).style
}

/** The one unconditional rule for this selector, spaces aside. */
function plain(selector: string): CSSStyleDeclaration {
  const found = unconditionalRules(profile, 'Profile.css').filter((rule) => squash(rule.selectorText) === selector)

  expect(found.length, `${selector} is not one unconditional rule of Profile.css`).toBe(1)

  return must(found[0], `the rule ${selector}`).style
}

const THE_TABLE = '.table.table--races'
const NAME = '.table--races .event-races__name'
const NAME_WITH_DAY = '.table--races:has(.event-races__day) .event-races__name'
const DAY = '.table--races .event-races__day'
const FIGURES =
  '.table--races .event-races__measure, .table--races .event-races__ascent, .table--races .event-races__descent'
const WAY_IN = '.table--races .event-races__way-in'

/* The widths are read out of the sheet in the three shapes it writes them, and a width of any other
   shape does not match, so the failure says so instead of the arithmetic going on with a number read
   wrong. Anchored at both ends on purpose: held as „the value contains `max(`" for a day on this table's
   predecessor, a round put back a rule of another shape that carried the string and was a second ceiling
   where a floor had been meant, and left the file green. */

/** A number of twelfths of the box: `calc(3 * var(--event-races-twelfth))` is 3. */
function share(written: string, what: string): number {
  const read = /^calc\((\d+) \* var\(--event-races-twelfth\)\)$/.exec(squash(written))

  expect(read, `${what} reads \`${written}\`, which is not a number of twelfths of the box`).not.toBeNull()

  return Number(must(read?.[1], `the twelfths of ${what}`))
}

/** A twelfth of the box and never less than a floor in `rem`: the floor. */
function floor(written: string, what: string): number {
  const read = /^max\(var\(--event-races-twelfth\), ([\d.]+)rem\)$/.exec(squash(written))

  expect(read, `${what} reads \`${written}\`, which is not a twelfth with a floor in rem`).not.toBeNull()

  return Number(must(read?.[1], `the floor of ${what}`))
}

/** A width in `rem`. */
function rem(written: string, what: string): number {
  const read = /^([\d.]+)rem$/.exec(squash(written))

  expect(read, `${what} reads \`${written}\`, which is not a width in rem`).not.toBeNull()

  return Number(must(read?.[1], `the rem of ${what}`))
}

type Reading = { day: boolean; wayIn: boolean }

/**
 * Every number the wide shape is made of, read out of the sheet once. Read once and not at every sum:
 * each reading of a rule is a parse of the whole sheet, and the sweep below asks four thousand times.
 */
function sheet() {
  return {
    name: share(wide(NAME).getPropertyValue('inline-size'), 'the name'),
    nameWithDay: share(wide(NAME_WITH_DAY).getPropertyValue('inline-size'), 'the name beside a day'),
    dayFloor: floor(wide(DAY).getPropertyValue('inline-size'), 'the day'),
    figureFloor: floor(wide(FIGURES).getPropertyValue('inline-size'), 'a figure'),
    wayIn: rem(wide(WAY_IN).getPropertyValue('inline-size'), 'the way in'),
    table: share(wide(THE_TABLE).getPropertyValue('inline-size'), 'the table'),
  }
}

/**
 * What the sheet makes of a table of this reading in a box of `box` px at a root of `root` px, worked
 * out the way a fixed table works it out: every column is its own width, and the table is as wide as
 * the greater of what it asks for and what its columns add up to.
 */
function columns(made: ReturnType<typeof sheet>, { day, wayIn }: Reading, box: number, root: number) {
  const twelfth = box / 12
  const name = (day ? made.nameWithDay : made.name) * twelfth
  const dayWidth = day ? Math.max(twelfth, made.dayFloor * root) : 0
  const figure = Math.max(twelfth, made.figureFloor * root)
  const way = wayIn ? made.wayIn * root : 0
  const sum = name + dayWidth + 3 * figure + way
  const half = made.table * twelfth

  return { name, day: dayWidth, figure, way, sum, half, table: Math.max(half, sum) }
}

/**
 * How wide the column of content is, read off the shell rather than written here.
 *
 * `.shell__main` is what every screen draws inside, and it carries both numbers:
 * `padding-inline` on each side, and a `max-width` past which the column stops
 * growing. Written by hand as „32" for a day, and a round measured the cost on
 * 23.08.2026: one step of the scale added to that padding put 11px of the race table
 * outside its box at a screen of 700, on the ordinary text size, while this guard
 * said nothing.
 *
 * The padding is a token, so the token is read too. Both come back in pixels at a
 * 16px root, which is the size every sum here is written at.
 */
function shellBox(): { padding: number; ceiling: number } {
  const shell = readFileSync(join(process.cwd(), 'src/app/Shell.css'), 'utf-8')
  const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')
  const main = must(
    unconditionalRules(shell, 'Shell.css').find((rule) =>
      rule.selectorText.split(',').some((one) => one.trim() === '.shell__main'),
    ),
    'the rule every screen is drawn inside',
  ).style
  const named = main.getPropertyValue('padding-inline').replace('var(', '').replace(')', '')
  const step = must(new RegExp(`${named}:\\s*([\\d.]+)rem`).exec(tokens), `the token ${named}`)
  const ceiling = must(/^(\d+)px$/.exec(main.getPropertyValue('max-width')), 'the ceiling')

  return { padding: Number(step[1]) * 16 * 2, ceiling: Number(ceiling[1]) }
}

/** Every reading the render can produce: the day is a column on an event of more than one morning, the way in
 *  for somebody who may report a result. */
const READINGS: Reading[] = [
  { day: false, wayIn: false },
  { day: false, wayIn: true },
  { day: true, wayIn: false },
  { day: true, wayIn: true },
]

describe('the table of races on an event', () => {
  it('is drawn as blocks first and as a table from the wide layout up, behind one query', () => {
    /* Owner, 03.10.2026: a block per race on a telephone, and from the wide layout up a table with
       the name wider than the figures. The phone shape is the plain one and the table comes back
       behind a query, which is what „mobile-first" means here and how the rights matrix does it
       (`pages/admin/Rights.css`).

       Asked two ways, because either alone is satisfied by a table that is the other way round:
       every rule about this table is written plainly or behind that one query, so none stands behind
       a `max-width` one, which is a second shape written against the first; and the plain ones are
       the blocks. The width is the one the portal calls the wide layout (`styles/tokens.css`), which
       the owner's „desktop" is taken to be. */
    const everything = everyRule(profile, 'Profile.css').filter(aboutTheTable)
    const written = unconditionalRules(profile, 'Profile.css').filter(aboutTheTable)
    const behind = rulesInMedia(profile, WIDE, 'Profile.css').filter(aboutTheTable)

    expect(written.length, 'nothing about the table is written plainly').toBeGreaterThan(0)
    expect(behind.length, 'nothing about the table is written behind the wide layout').toBeGreaterThan(0)
    expect(everything.length, 'a rule about the table stands behind a query that is not the wide layout').toBe(
      written.length + behind.length,
    )

    expect(plain('.table--races').getPropertyValue('display')).toBe('block')
    expect(plain('.table--races thead').getPropertyValue('display'), 'the head is drawn on a telephone').toBe('none')
    expect(plain('.table--races tbody').getPropertyValue('display')).toBe('block')
    expect(plain('.table--races tbody tr').getPropertyValue('display')).toBe('grid')
    expect(plain('.table.table--races td').getPropertyValue('display')).toBe('block')

    /* And everything it changed comes back, or the table shape is the blocks with columns written over
       them. `fixed` is what makes the widths widths: without it a table is as wide as its content and
       every number below is a suggestion. */
    expect(wide(THE_TABLE).getPropertyValue('display')).toBe('table')
    expect(wide(THE_TABLE).getPropertyValue('table-layout')).toBe('fixed')
    expect(wide('.table--races thead').getPropertyValue('display')).toBe('table-header-group')
    expect(wide('.table--races tbody').getPropertyValue('display')).toBe('table-row-group')
    expect(wide('.table--races tbody tr').getPropertyValue('display')).toBe('table-row')
    expect(wide('.table.table--races td').getPropertyValue('display')).toBe('table-cell')

    /* And no width is written for the blocks: a track of the row is what sizes a figure there, and a
       width on a cell is a width the table shape has to take off again. */
    expect(
      written.filter((rule) => rule.style.getPropertyValue('inline-size') !== '').map((rule) => squash(rule.selectorText)),
      'a block is given a width of its own',
    ).toEqual([])
  })

  it('puts the name over the row, the day beside it and the three figures in a row under them', () => {
    /* „Na mobilnom u prvom redu naziv i datum, u drugom ova tri podatka. Dugme u redu pored na
       Desktopu, a ispod podataka svake trke na mobilnom." Three tracks of one width: the name takes
       all of them, or two where there is a day, and the day takes the third. The figures follow in
       the order they are read, a track each, and the way in has the row after them to itself. */
    expect(squash(plain('.table--races tbody tr').getPropertyValue('grid-template-columns'))).toBe(
      'repeat(3, minmax(0, 1fr))',
    )
    expect(squash(plain(NAME).getPropertyValue('grid-column'))).toBe('1 / -1')
    expect(squash(plain(NAME_WITH_DAY).getPropertyValue('grid-column'))).toBe('1 / span 2')
    expect(squash(plain('.table--races .event-races__day').getPropertyValue('grid-column'))).toBe('3')
    expect(squash(plain(WAY_IN).getPropertyValue('grid-column'))).toBe('1 / -1')

    /* Nothing is placed out of the order it is read in, which is what a keyboard and a screen reader
       follow (WCAG 2.2 SC 1.3.2 and 2.4.3): no `order`, no row of its own, no areas, and no `dense`
       flow, which puts a later cell into an earlier hole. */
    const reordering = ['order', 'grid-row', 'grid-area', 'grid-template-areas', 'grid-auto-flow']
    const moved = everyRule(profile, 'Profile.css')
      .filter(aboutTheTable)
      .filter((rule) => reordering.some((property) => rule.style.getPropertyValue(property) !== ''))
      .map((rule) => squash(rule.selectorText))

    expect(moved, 'a cell is drawn out of the order it is read in').toEqual([])

    /* An empty cell costs nothing. A race that has not been run has an empty cell for the way in, and an
       empty cell has to be a row of no height: so the distance between the rows of a block is a margin on
       what is in them (the figures, and the way in where it has a button) and never a gap of the row,
       which is charged for a row with nothing in it all the same. */
    const row = plain('.table--races tbody tr')

    expect(row.getPropertyValue('row-gap'), 'the rows of a block are a gap apart').toBe('')
    expect(row.getPropertyValue('gap'), 'the rows of a block are a gap apart').toBe('')
    expect(
      plain('.table--races .event-races__way-in:not(:empty)').getPropertyValue('margin-block-start'),
      'a way in with a button stands no distance from the figures',
    ).not.toBe('')
    expect(
      plain(WAY_IN).getPropertyValue('margin-block-start'),
      'an empty way in is given a distance, which is a row of its own',
    ).toBe('')
  })

  it('is a quarter of its box for the name and a twelfth for each figure, which ends at the middle of it', () => {
    /* „Naziv trke četvrtina, ove tri kolonice po dvanaestina": a quarter and three twelfths, which
       is the half the owner asked for, and with a day „prve dve dvanaestine naziv, pa jedna datum",
       which is the same quarter between two columns. „Recimo" is his word, and what holds where the
       twelfths cannot be kept is the case on floors below.

       Worked out in a box where no floor decides (a twelfth of 200px, over what any floor asks at a
       16px root), so that what is held here is the share and nothing else. */
    const roomy = 12 * 200
    const read = sheet()

    for (const day of [false, true]) {
      const made = columns(read, { day, wayIn: false }, roomy, 16)

      expect(made.name + made.day + 3 * made.figure, `the columns do not add up to the half, with the day ${day}`).toBeCloseTo(
        roomy / 2,
        6,
      )
      expect(made.table, `the table does not end at the middle of its box, with the day ${day}`).toBeCloseTo(roomy / 2, 6)
      expect(made.figure).toBeCloseTo(roomy / 12, 6)
      expect(made.name + made.day, 'the name and the day are not a quarter between them').toBeCloseTo(roomy / 4, 6)
    }

    expect(columns(read, { day: false, wayIn: false }, roomy, 16).name, 'the name is not a quarter').toBeCloseTo(
      roomy / 4,
      6,
    )
    expect(columns(read, { day: true, wayIn: false }, roomy, 16).day, 'the day is not a twelfth').toBeCloseTo(
      roomy / 12,
      6,
    )
  })

  it('moves no column when the way in comes, which is a column on top of the half and not a part of it', () => {
    /* „Ko nije prijavljen vidi jednu manje, iste širine kao kad ih ima najviše, dakle tabela se ne
       razvlači preko oslobođenog mesta" (PDL, 23.08.2026). Asked in boxes where a floor decides and in
       ones where a share does, because a column that moves only in one of them is the fault that was
       measured on 23.08.2026: the first column moved by up to 35,59px between a visitor and a member. */
    const read = sheet()
    const way = read.wayIn * 16

    /* Nothing in the sheet is conditional on the way in. The widths above are read by the selectors the
       model knows, so a rule that narrows the name where a way in is drawn would be a rule the model never
       reads; asked of every rule instead, wherever it stands, so there is none to read. A fixed table is
       the greater of its own width and its columns', so the way in comes on top of the half without being
       told to. */
    const conditional = everyRule(profile, 'Profile.css')
      .filter((rule) => /:has\(\s*\.event-races__way-in\s*\)/.test(rule.selectorText))
      .map((rule) => squash(rule.selectorText))

    expect(conditional, 'a rule of the table changes with the way in').toEqual([])

    for (const day of [false, true]) {
      for (const box of [771, 977, 1068, 1100, 2400]) {
        const without = columns(read, { day, wayIn: false }, box, 16)
        const given = columns(read, { day, wayIn: true }, box, 16)

        expect(
          [given.name, given.day, given.figure],
          `a column moves when the way in comes, in a box of ${box}px with the day ${day}`,
        ).toEqual([without.name, without.day, without.figure])
        expect(given.table - without.table, 'the way in is not the width it is written as').toBeCloseTo(way, 6)
      }
    }
  })

  it('holds one width for the three figures, which the owner called three identical columns', () => {
    /* One rule gives all three their width, so there is no way to widen one of them: a second rule
       for any of them is the day the three stop being identical. */
    const widths = rulesInMedia(profile, WIDE, 'Profile.css')
      .filter(
        (rule) =>
          /event-races__(measure|ascent|descent)/.test(rule.selectorText) &&
          rule.style.getPropertyValue('inline-size') !== '',
      )
      .map((rule) => squash(rule.selectorText))

    expect(widths, 'the figures are given their widths by more than one rule').toEqual([FIGURES])
  })

  it('keeps what may not be broken whole wherever a floor is what decides', () => {
    /* Measured in Chrome 152 on Windows, Segoe UI at a 16px root, in a blank page and again in this
       table, and all of it is `rem`, so one measurement at 16px holds at every text size:

       - „31. 12. 2022.", the widest date, is 88,18px of type;
       - „100,00 km", and „529,93 km", the longest distance in the file, are 72,72px: every distance under
         a thousand kilometres is as wide, because the digits are tabular;
       - „Unesi rezultat" on one line is 114,75px.

       The cell keeps var(--space-8) either side, which is 1rem of the column. A twelfth of the widest box
       the page ever has is 89px (1068 of it), so the date never fits in one, „100,00 km" fits in one only
       from a screen of about 1110px up and „21,10 km" from about 1010px; that is what the floors are for,
       and the table is wider than half of its box wherever they decide. „1.000,00 km" is 84,81px of type
       and needs 100,81 with its cell, which no floor here holds and no race in the file asks of one (the
       longest is 529,93 km, and 81 of the 1612 are a hundred or more): it would break at its space rather
       than leave the box.

       The floor for the figures is 5,75rem and not 5,25: a distance of a hundred kilometres or more needs
       5,545rem, and 5,25rem, the first number it was rounded up to, breaks every one of them wherever a
       twelfth is narrower than that, which is every screen under about 1110px. 5,75rem is 92px, 3px more
       than a twelfth of the widest box, so the floor decides at every width and the table is never exactly
       half: at 1280px it is 543px of 1068 and not 534. */
    const CELL = 16
    const DATE = 88.18
    const DISTANCE = 72.72
    const BUTTON = 114.75

    expect(
      floor(wide(DAY).getPropertyValue('inline-size'), 'the day') * 16 - CELL,
      'a column of days at its floor breaks the widest date in two',
    ).toBeGreaterThanOrEqual(DATE)
    expect(
      floor(wide(FIGURES).getPropertyValue('inline-size'), 'a figure') * 16 - CELL,
      'a column of figures at its floor breaks a distance of a hundred kilometres in two',
    ).toBeGreaterThanOrEqual(DISTANCE)
    expect(
      rem(wide(WAY_IN).getPropertyValue('inline-size'), 'the way in') * 16 - CELL,
      'the way in is narrower than the button in it',
    ).toBeGreaterThanOrEqual(BUTTON)
  })

  it('stays inside its box at the ordinary text size', () => {
    /* The fault a round measured on 23.08.2026 on this table's predecessor and the reason a floor is
       not a number picked to be safe: a table wider than its box scrolls inside it, and PDL P24 allows
       that at an enlarged text and nowhere else. Nothing on the screen says a button was cut.

       Worked out rather than rendered, because jsdom lays nothing out (ADL A18) and a browser shows one
       width at a time. The arithmetic is `max` and `calc` and nothing else, and it was held against
       Chrome on this branch: 469,3px of table in a box of 773 at a screen of 820 (a visitor, one
       morning), 543 in 1068 at 1280, and 644,8 in 773 at 820 for a member at a weekend, which is the
       widest reading in the narrowest box.

       Every reading the render can produce and every box from the narrowest the wide layout covers
       up to a wide desk. The box is the screen less the shell's padding and less the scrollbar, 17 and
       not the 15 that Chrome on Windows draws, because the widest classic scrollbar among the engines is
       what makes this hold everywhere (`index.css` sets `scrollbar-gutter: stable`, so the room is
       reserved whether or not the page is long enough to need it). The padding and the ceiling are read
       from the shell and not written here.

       **What it does not hold, said here and not left to be found.** At 200% text the table of a member
       is wider than its box wherever the wide layout is drawn at all: measured in Chrome with the
       default font size of the profile at 32px, 39px for a member at an event of one morning and 169px
       for one at a weekend, inside the box, with the page itself still. The reader's text size moves the
       layout in `em` and a box is in pixels. The table scrolls in its own box there, as PDL P24 asks of
       every table at that size, and the one it replaced scrolled 44px and 260px, and on a telephone 163
       and 269. */
    const GUTTER = 17
    const FROM = 51.25 * 16
    const shell = shellBox()
    const read = sheet()
    const room = (screen: number) => Math.min(screen - GUTTER, shell.ceiling) - shell.padding
    const tooWide: string[] = []

    for (const reading of READINGS) {
      for (let screen = FROM; screen <= 1920; screen += 1) {
        const box = room(screen)

        if (columns(read, reading, box, 16).table > box) {
          tooWide.push(`${JSON.stringify(reading)} at ${screen}px`)
        }
      }
    }

    expect(tooWide).toEqual([])
  })

  it('works a twelfth out in the unit of its box and in no other', () => {
    /* `cqi` is a hundredth of the box the table stands in (`.event-races`, below), and a `cqi` with no
       box above it is a hundredth of the window instead: the same number of pixels on one screen and
       the wrong ones on the next. A width of this table in `%` would be a share of the TABLE, which is
       narrower than its box, and in `vw` a share of the window, so neither is written, and what is
       written is the one reading of „a twelfth". */
    expect(wide(THE_TABLE).getPropertyValue('--event-races-twelfth').replace(/\s+/g, '')).toBe('calc(100cqi/12)')

    const widths = everyRule(profile, 'Profile.css')
      .filter(aboutTheTable)
      .map((rule) => rule.style.getPropertyValue('inline-size'))
      .filter((one) => one !== '')

    expect(widths.length, 'the table is given no width at all').toBeGreaterThan(5)
    expect(widths.filter((one) => /%|[sld]?v[wi]|cq[whb]/.test(one)), 'a width is a share of something else').toEqual([])
  })

  it('stands in a box that is a container of its width and of nothing else', () => {
    /* `inline-size` and not `size`: the box has no height of its own to give, and containing it would
       collapse it. That the box is really above the table is asked of the rendered tree
       (`pages/event/raceTable.test.tsx`). */
    expect(plain('.event-races').getPropertyValue('container-type')).toBe('inline-size')
  })

  it('puts the word of a column over its figure in the look of the heading, and takes it off where the head is drawn', () => {
    /* The head of the table is not drawn on a telephone, so the words that would stand over each
       column stand over each figure instead: real text in the cell, the three words the head already
       says (`pages/EventDetail.tsx`). Where the head is drawn, from the wide layout up, they are not,
       so a reader is never told twice (`styles/scale.test.ts` lists the one place that hides them).

       In the look of the heading and read from it: the heading is `.table th` in `styles/table.css`, and
       a word that is tuned beside it and not with it is two sizes for one thing. */
    const word = plain('.table--races .event-races__label')
    const heading = ruleFor(shared, '.table th', 'table.css')

    expect(word.getPropertyValue('display')).toBe('block')
    expect(wide('.table--races .event-races__label').getPropertyValue('display')).toBe('none')

    for (const property of ['font-size', 'letter-spacing', 'text-transform', 'font-weight', 'color']) {
      expect(
        word.getPropertyValue(property),
        `${property} of the word over a figure is not the heading's`,
      ).toBe(heading.getPropertyValue(property))
    }

    /* And it does not break: at 200% a word of its own is wider than a track long before the figure under
       it is, and „USPO" over „N" is worse than a word that leans into the gap beside it. */
    expect(word.getPropertyValue('white-space')).toBe('nowrap')
  })

  it('gives a cell in the table shape what a block took from it, and no other', () => {
    /* A cell of the shared table has a padding and a line under it (`styles/table.css`), and neither
       belongs to a figure in a block, where the line is the row's. The table shape puts both back, and
       they are written a second time to do it, so the two homes are read and required to agree. */
    const cell = ruleFor(shared, '.table td', 'table.css')
    const block = plain('.table.table--races td')
    const back = wide('.table.table--races td')
    const row = plain('.table--races tbody tr')
    const line = cell.getPropertyValue('border-bottom')

    /* Nought, however the parser writes it: it hands `0` back as `0px`. */
    const nought = /^0(px)?$/

    expect(block.getPropertyValue('padding'), 'a figure in a block keeps a padding').toMatch(nought)
    expect(block.getPropertyValue('border-bottom-width'), 'a figure in a block keeps a line').toMatch(nought)
    expect(squash(back.getPropertyValue('padding'))).toBe(squash(cell.getPropertyValue('padding')))
    expect(back.getPropertyValue('border-bottom-width')).toBe(must(line.split(' ')[0], 'the width of the shared line'))

    /* The line under a block is the same line, on the row: and in the table shape it is under the cells
       and not twice. */
    expect(row.getPropertyValue('border-bottom')).toBe(line)
    expect(wide('.table--races tbody tr').getPropertyValue('border-bottom-width')).toMatch(nought)
  })

  it('lets a word break rather than leave the box, in both shapes', () => {
    /* In a block nothing grows for a word, and in a fixed table a column cannot, so a name of forty
       letters with no space in it is the one input that pushes a page sideways (WCAG 2.2 SC 1.4.10). It
       is written plainly and not behind the query, so a telephone has it too: it was behind the query
       while the telephone's table grew for its content instead, and that is the table that is gone. */
    const found = unconditionalRules(profile, 'Profile.css').filter(
      (rule) => squash(rule.selectorText) === '.table.table--races th, .table.table--races td',
    )

    expect(found, 'the cells break their words in no shape, or in one only').toHaveLength(1)
    expect(must(found[0], 'the rule').style.getPropertyValue('overflow-wrap')).toBe('anywhere')
  })

  it('reads words from the left and figures from the right, the same for all three figures', () => {
    /* The portal reads the first three columns of a table from the left, because in every other table
       those are words (`styles/table.css`), and that rule goes by position: on this table it made the
       climb read from the left without a day and from the right with one. The three figures are
       identical columns and are not placed by where they happen to stand, so the side is the column's. */
    expect(
      wide('.table.table--races .event-races__name, .table.table--races .event-races__day').getPropertyValue(
        'text-align',
      ),
    ).toBe('left')
    expect(
      wide(
        '.table.table--races .event-races__measure, .table.table--races .event-races__ascent, .table.table--races .event-races__descent, .table.table--races .event-races__way-in',
      ).getPropertyValue('text-align'),
    ).toBe('right')
  })
})

describe('the head of a competitor', () => {
  it('keeps the face beside the name until the text is twice its size', () => {
    /* Owner, 23.08.2026: „sa leve strane povelika okrugla slika". A flex line
       breaks on the hypothetical size of its items and not on what they could
       shrink to, so a basis of `auto` reads the whole line under the name and asks
       for more than a phone has: measured on the 313px a 360px phone really gives,
       the circle stood above the name at 100%, 125%, 150% and 200% alike.

       A basis of 8rem is the block's own smallest usable width rounded down to the
       scale: its `min-content` is 129,73px at a 16px root and 8rem is 128. A hair
       under, on purpose and at no cost, because `min-inline-size: 0` lets the block
       shrink past its basis anyway and the basis is read for whether the row breaks
       rather than for how narrow the block may get. Measured after: beside the name
       at 100%, 125% and 150%, and above it at 200%, where breaking is what keeps the
       page from scrolling sideways. */
    const identity = ruleFor(profile, '.profile__identity', 'Profile.css')

    expect(identity.getPropertyValue('flex-basis'), 'the row breaks on the length of the line')
      .toBe('8rem')
    expect(identity.getPropertyValue('flex-shrink')).toBe('1')
  })

  it('may break into two rows rather than push the page sideways', () => {
    /* The circle is sized in `rem`, so it grows with the reader's text: at 200% on
       a 360px screen it is 104px rather than 52px, and beside it the season's
       `select` has an intrinsic width of its own that `min-inline-size: 0` cannot
       talk down. Measured before: the page scrolled sideways by 44px, which is the
       one thing the portal never does (WCAG 2.2 SC 1.4.10). Measured after: 360px
       of content in 360px of screen at 100%, 150% and 200%. */
    expect(
      ruleFor(profile, '.profile__head--person', 'Profile.css').getPropertyValue('flex-wrap'),
    ).toBe('wrap')
  })
})

describe('what the organiser says the event is', () => {
  it('runs the full width of the column, and breaks a word that would not', () => {
    /* Two declarations and the absence of a third, which is the point of this
       case. A measure stood here for an afternoon on 27.08.2026 and came off: the
       owner asked on 12.08.2026 for prose to run the full width („Sve strane
       treba da koriste punu širinu strane za prikaz teksta"), and `StaticPage.css`
       and `Markdown.css` both obey it in as many words. A cap here would have made
       this the one paragraph on the portal that breaks early, and the comment
       justifying it claimed to match pages that measure nothing at all.

       The field takes 600 characters and refuses nothing, so all 600 may arrive as
       one word, which is the single input that pushes a page sideways. That is
       what `overflow-wrap` is for, and it is the half of this rule a browser
       round would catch late and a reader would catch first. */
    const said = ruleFor(profile, '.event__said', 'Profile.css')

    expect(said.getPropertyValue('overflow-wrap')).toBe('anywhere')
    expect(
      said.getPropertyValue('max-inline-size'),
      'the description is capped, and the portal caps no prose',
    ).toBe('')
    expect(
      said.getPropertyValue('max-width'),
      'the description is capped, and the portal caps no prose',
    ).toBe('')
  })
})
