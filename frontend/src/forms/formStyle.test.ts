import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { everyRule, ruleFor, ruleInMedia } from '../test/stylesheet'

/**
 * Three things about a form that no rendered test can see, because jsdom lays
 * nothing out and applies no stylesheet (ADL A18).
 *
 * All three were found by an independent round on 23.08.2026, all three measured
 * in Chrome, and all three are the kind of fault a green suite hides: a control
 * that is the wrong width, a panel that stands over the field under it, and a
 * button that is not where it was asked to be.
 */
const suggests = readFileSync(join(process.cwd(), 'src/forms/Suggesting.css'), 'utf-8')
const fields = readFileSync(join(process.cwd(), 'src/forms/FormRenderer.css'), 'utf-8')
const PICKER = readFileSync(join(process.cwd(), 'src/forms/DatePicker.css'), 'utf-8')

describe('the box a list is typed into', () => {
  it('takes the width of its field, like every other control', () => {
    /* Every other control is a direct child of `.field`, which is a flex column
       and stretches them. This one is a child of the box around it, so left alone
       it fell back to the browser's own twenty characters: measured at 1280, „Naziv
       događaja" was 207px while „Link ka zvaničnim rezultatima" under it was 544px,
       and at 200% text on a 360px screen the box stood 72px past the right edge of
       its own column (WCAG 2.2 SC 1.4.10). */
    const box = ruleFor(suggests, '.suggests > .field__control', 'Suggesting.css')

    expect(box.getPropertyValue('inline-size')).toBe('100%')
    /* And it may give way, because a flex item will not shrink below its content
       and the content here is whatever somebody typed. */
    expect(box.getPropertyValue('min-inline-size')).toBe('0px')
  })

  it('keeps its list in the flow rather than over the fields under it', () => {
    /* Taken out of the flow the panel covered „Datum trke" whole at 360px, so the
       focus ring on that box could not be seen once the cursor walked past the
       list (WCAG 2.2 SC 2.4.11), and a click aimed at the date pressed a
       suggestion and locked four fields to somebody else's race. */
    const list = ruleFor(suggests, '.suggests__list', 'Suggesting.css')

    expect(list.getPropertyValue('position')).toBe('')
    /* And no height of its own, so it has nothing to scroll. It had both while it
       stood over the form, and with the list back in the flow they only made
       trouble: eight rows are 326px against the 270px that box allowed, so the last
       row and a half were reachable only by scrolling, and pressing that scrollbar
       shut the list in the same instant. */
    expect(list.getPropertyValue('max-block-size'), 'the list has a height of its own').toBe('')
    expect(list.getPropertyValue('overflow-y'), 'the list has something to scroll').toBe('')
  })
})

describe('the way out of a picture attached by mistake', () => {
  it('stands at the end of the row it is in', () => {
    /* Owner, 23.08.2026: „dugme Obriši na kraju reda". An automatic margin in
       front of it, the same way the calculator keeps its Reset at the end of its
       row: `justify-content: space-between` has nothing to hold apart on a row
       where the button is not drawn at all, which is every row until a picture is
       chosen. Measured at 1280 before this rule existed: the row was 544px and the
       button sat at 320px, against the box and 157px short of the end. */
    expect(ruleFor(fields, '.field__photo', 'FormRenderer.css').getPropertyValue('display')).toBe(
      'flex',
    )
    expect(
      ruleFor(fields, '.field__clear', 'FormRenderer.css').getPropertyValue('margin-inline-start'),
    ).toBe('auto')
  })
})

describe('the box a town is typed into', () => {
  it('takes the room it was given and no more', () => {
    /* The column already refuses to grow for it (`min-inline-size: 0` on
       `.place__town`); what was missing until 23.08.2026 is the box being told the
       same. Measured that day at 200% text on a 360px screen: the box came out
       417px inside 296px of column and the **page** scrolled sideways by 104px,
       which is the one thing the portal never does (WCAG 2.2 SC 1.4.10). (296 and
       not 281: the column is `360 - 2 x 32`, the padding being in `rem`, and 281
       was a desk window of 345px with the scrollbar left in. Corrected 23.08.2026,
       ADL A26.)

       jsdom applies no stylesheet and lays nothing out (ADL A18), so what is asked
       here is that the rule is written; the number beside it is what a browser
       measured. */
    const place = readFileSync(join(process.cwd(), 'src/forms/PlaceField.css'), 'utf-8')
    const box = ruleFor(place, '.place__town .field__control', 'PlaceField.css')

    expect(box.getPropertyValue('inline-size')).toBe('100%')
    expect(box.getPropertyValue('min-inline-size')).toBe('0px')
  })
})

describe('the calendar of a date field', () => {
  it('has columns that give way when the sheet is capped', () => {
    /* The other half of the fix, and the half nothing was watching. `DatePicker.tsx`
       caps the sheet at the width of the visible window, and the cap does nothing
       unless the columns can be narrower than they would like: seven of `2rem` are
       448px of grid at 200% text, and a `fixed` box that hangs over the edge cannot
       be scrolled to.

       Measured in Chrome on 23.08.2026, 360px at 200% text: with `repeat(7, 2rem)`
       the sheet stood 514px wide and ten of the thirty day buttons answered `null`
       from `elementFromPoint`, the whole weekend column, on every date field on the
       portal. With `minmax(0, 2rem)` none are lost. A round put the rigid value back
       and all 2133 tests stayed green, which is why this is written.

       jsdom applies no stylesheet and lays nothing out (ADL A18), so what is asked
       here is that the value is written; the numbers beside it are what a browser
       measured. */
    const picker = readFileSync(join(process.cwd(), 'src/forms/DatePicker.css'), 'utf-8')
    const grid = ruleFor(picker, '.datepicker__grid', 'DatePicker.css')

    expect(grid.getPropertyValue('grid-template-columns')).toBe('repeat(7, minmax(0, 2rem))')
  })
})

describe('the calendar button that will not answer', () => {
  it('looks refused, and not only says so', () => {
    /* „Odbijeno, ne ugašeno" keeps the button in the keyboard's path and says so
       in a word a screen reader reads; a word was all it was. Measured on
       23.08.2026: the refused button and the live one shared their colour, their
       background and their cursor, so whoever was looking rather than listening
       was shown a live control and told nothing.

       The same two declarations the portal keeps for a held control
       (`.field__control--held`).

       Said twice and not shared, because the two are not the same kind of thing:
       that rule dresses a `.field__control`, and this is a button beside one.

       The field beside this button wore nothing until 29.08.2026, and the sentence
       here outlived that by a commit: it was corrected in `DatePicker.css` and left
       standing here, which is one fact with two homes and one of them fixed, found
       by a review the same day. The field now reads its dress from `forms/held.ts`
       along with the three the renderer draws, and the rule it names lives in
       `FormRenderer.css`. */
    const refused = ruleFor(PICKER, ".datepicker__open[aria-disabled='true']", 'DatePicker.css')

    expect(refused.background).toBe('var(--surface-hover)')
    expect(refused.cursor).toBe('default')
  })

  it('does not brighten under a pointer it is going to refuse', () => {
    /* A control that lights up under the pointer promises an answer, and this one
       has already said it will not give one.

       **What this asks and what it cannot ask.** It asks that the rule is written
       and what it says. It does not ask what the cascade does with it, and a
       review on 28.08.2026 measured that gap: a rule of greater weight added later
       in the same sheet (`.datepicker .datepicker__open:hover`) puts the accent
       back on the refused button and leaves this green. It is not a gap this file
       can close, and `scripts/refused-control-appearance.mjs` says why in its own
       header: nine rounds of review on `entityStyle.test.ts` proved that computing
       the cascade outside a browser is blind to the next axis every time.

       Measured in a browser instead, by that review, over the built bundle and the
       markup the portal really draws: the refused button hovered against the same
       button at rest differs in **nothing**, at 1280 and at 360, in both themes.
       With the heavier rule added, seventeen properties differ and the colour goes
       to the accent, which is the live button's.

       It measured one control on the day that was written and it measures both since
       29.08.2026: the markup and the set of properties a refusal may differ in are
       written per control there, and this button is the second of them. The rule
       named above is one of the mutations that was let loose to prove it, and the
       script complains about it in the words of the state it breaks. */
    const refused = ruleFor(
      PICKER,
      ".datepicker__open[aria-disabled='true']:hover",
      'DatePicker.css',
    )

    expect(refused.borderColor).toBe('var(--control-border)')
    expect(refused.color).toBe('var(--text-muted)')
  })
})

/**
 * THE TOWN AND THE COUNTRY, WHERE A ROW IS IN COLUMNS.
 *
 * Owner, 28.09.2026: „Drugi red su jednake trećine za Mesto i Državu (Treća
 * kolona je prazna)." The field already SPANNED two columns before that day and
 * that is not the same thing: measured at 1280, the town was 434,67px and the
 * country 192px inside 634,67px, because `PlaceField.css` gives the country a
 * fixed 12rem and hands the rest to the town.
 *
 * Two halves and a gap, and all three have to be said, which is why there are
 * three assertions and not one: equal halves with the sheet's own 8px gap came
 * out 313,33px each against a third of 309,33px, and the left edge of „Država"
 * stood four pixels short of „Telefon" on the row above. Equal to each other and
 * on neither column.
 *
 * **Measured in a browser after the rule was written**, because jsdom lays
 * nothing out: at 1280 the town is 309,33px at x=98,33 and the country 309,33px
 * at x=423,67, which is where the telephone above it begins, to the pixel.
 */
/**
 * THE TOWN AND THE COUNTRY ARE TWO HALVES OF ONE ANSWER, SO THEY ARE ONE FIELD WITH
 * TWO NAMES AND TWO CONTROLS, AND THE NAMES ARE ON ONE LINE.
 *
 * <p>Owner, 29.09.2026, over a picture of this field: „I ovde se raspada red zbog
 * Drzave." Two things were wrong and neither can be seen by a rendered test, because
 * jsdom lays nothing out (ADL A18): the two names were dressed by two different rules,
 * and they stood on two different lines because one is drawn above the pair and the
 * other inside it.
 *
 * <p><b>Both are held as questions about the FIELD rather than as a list of
 * declarations.</b> „Which areas does this sheet place things into" is read off every
 * rule it has, so a fifth area, or one of the four dropped, fails without anybody
 * remembering to add a line here.
 */
/**
 * The names a `grid-template-areas` really lays out, as words rather than as one string.
 *
 * <p><b>Written because the first draft of the case below searched the string.</b>
 * `'townName'` CONTAINS `'town'` and `'countryName'` contains `'country'`, so two of the
 * four areas could be deleted from the template and a `toContain` over the whole value
 * went on passing. Measured by an independent round on 29.09.2026: with the second row
 * turned into `'townName'` the town's box came out at `x=137` and 207 wide on a 360px
 * screen, indented and UNDER the country's list, and nothing said so.
 */
function areasIn(template: string): string[] {
  return [...template.matchAll(/"([^"]*)"|'([^']*)'/g)]
    .flatMap((row) => (row[1] ?? row[2] ?? '').trim().split(/\s+/))
    .filter((area) => area !== '' && area !== '.')
}

/** The same set, with each name said once and in a settled order. */
function asASet(areas: string[]): string[] {
  return [...new Set(areas)].sort((left, right) => left.localeCompare(right))
}

describe('the field that asks for a town', () => {
  const place = readFileSync(join(process.cwd(), 'src/forms/PlaceField.css'), 'utf-8')
  const BESIDE = '(min-width: 35em)'

  it('is one grid, and the four things in it land on four different areas', () => {
    /* THE JOIN, and it is the whole reason this is one case rather than two. The
       field NAMES four areas and four rules PLACE something into one each; either
       half alone reads as though it works, and an area named but never placed into,
       or a rule placing into an area the field does not name, is exactly the shape
       that would put a name back on top of a control. Read off every rule the sheet
       has rather than off a list, so a fifth area cannot arrive unnoticed. */
    const placed = asASet(
      everyRule(place, 'PlaceField.css')
        .map((rule) => rule.style.getPropertyValue('grid-area'))
        .filter((area) => area !== ''),
    )

    expect(placed).toEqual(['country', 'countryName', 'town', 'townName'])

    /* BOTH TEMPLATES AND NOT ONLY THE ONE THE FIELD OPENS WITH. The second is the
       whole of what this change is for - it is what puts the two names on ONE LINE -
       and until 29.09.2026 nothing read it at all. Measured by an independent round
       with `'town     country'` turned into `'town     town'`, a single token: at 1280
       the grid took two implicit columns, „Država" moved to `x=232,83`, which is 191
       pixels left of „Telefon" above it, its list fell into a row of its own and the
       field grew from 76,8 to 132,8 tall. Every case in this file stayed green.

       AND AS SETS IN BOTH DIRECTIONS, which is the other half: an area placed into but
       never named, and an area named but never placed into, are two different faults
       and `toEqual` over the two sets is what refuses each of them. */
    for (const [when, rule] of [
      ['as the field opens', ruleFor(place, '.field.field--place', 'PlaceField.css')],
      [
        'where the two stand side by side',
        ruleInMedia(place, BESIDE, '.field.field--place', 'PlaceField.css'),
      ],
    ] as const) {
      const named = rule.getPropertyValue('grid-template-areas')

      expect(named, `${when}: the field names no areas at all`).not.toBe('')
      expect(asASet(areasIn(named)), `${when}: named and placed do not agree`).toEqual(placed)
    }
  })

  it('stacks the two halves on a telephone and puts them side by side above 560', () => {
    /* Mobile first: one column is what the field opens as, and the DOM order is
       already name, town, name, country, so nothing has to be said about the order.
       The second column arrives at the width the portal already parts them at. */
    expect(
      ruleFor(place, '.field.field--place', 'PlaceField.css').getPropertyValue(
        'grid-template-columns',
      ),
    ).toBe('minmax(0, 1fr)')
    expect(
      ruleInMedia(place, '(min-width: 35em)', '.field.field--place', 'PlaceField.css')
        .getPropertyValue('grid-template-columns'),
    ).toBe('minmax(0, 1fr) minmax(0, 12rem)')
  })

  /**
   * AND NEITHER HALF IS DRESSED DIFFERENTLY FROM THE OTHER.
   *
   * <p>What the owner saw was „Mesto" in the ordinary weight and „DRŽAVA" in small
   * capitals in another colour. The dress came off the WRAPPER and the label inherited
   * it, so a guard naming the label would have missed it entirely.
   *
   * <p><b>Asked of every rule the sheet has, in both directions.</b> Nothing in this
   * field may set `text-transform` at all, and the one thing that may be quieter than
   * its neighbours is the country written beside a town in the list of suggestions,
   * which is the answer to „which Boston" and says so where it is written.
   */
  it('dresses neither of its two names differently from the other', () => {
    const rules = everyRule(place, 'PlaceField.css')

    expect(
      rules
        .filter((rule) => rule.style.getPropertyValue('text-transform') !== '')
        .map((rule) => rule.selectorText),
    ).toEqual([])
    expect(
      rules
        .filter((rule) => rule.style.getPropertyValue('color') !== '')
        .map((rule) => rule.selectorText),
    ).toEqual(['.place__country'])
  })
})

describe('a town standing on a row of columns', () => {
  const QUERY = '(min-width: 51.25em)'
  /** Where the two halves stand side by side at all, which is a width of its own
   *  and on the portal's closed list (`styles/scale.test.ts`). */
  const BESIDE = '(min-width: 35em)'
  const place = readFileSync(join(process.cwd(), 'src/forms/PlaceField.css'), 'utf-8')

  it('is two of those columns, and its halves are one each', () => {
    const wide = ruleInMedia(fields, QUERY, '.form__row .field.field--place', 'FormRenderer.css')

    expect(wide.getPropertyValue('grid-column')).toBe('span 2')
    /* And the two halves ARE those two columns rather than merely sitting inside
       them. `minmax(0, …)` on both and not a bare `1fr`: a track's floor is the
       width of its content, and the content of one half is an empty box while the
       other is a list of two hundred and forty six countries. */
    expect(wide.getPropertyValue('grid-template-columns')).toBe('minmax(0, 1fr) minmax(0, 1fr)')
  })

  it('splits them by the gap between the columns, so each half IS a column', () => {
    /* The third thing, and the one that a guard about the halves alone would
       miss entirely: two equal halves of a field two columns wide are only two
       columns if what parts them is what parts the columns. */
    const wide = ruleInMedia(fields, QUERY, '.form__row .field.field--place', 'FormRenderer.css')
    const row = ruleFor(fields, '.form__row', 'FormRenderer.css')

    expect(wide.getPropertyValue('column-gap')).toBe(row.getPropertyValue('gap'))
    expect(wide.getPropertyValue('column-gap'), 'the row no longer names a gap at all').not.toBe('')
  })

  /**
   * AND THE RULE ABOVE ONLY MEANS ANYTHING BECAUSE THE FIELD IS A GRID, WHICH
   * ANOTHER SHEET SAYS.
   *
   * <p>The join between the two halves of this guard, and the one thing neither
   * case above can see. `FormRenderer.css` hands `.form__row .field--place` a
   * track list and a column gap; a track list on a flex box is two declarations
   * nothing reads. What makes them mean what they say is `PlaceField.css` giving
   * that same class `display: grid`, and the two sheets meet on nothing but the
   * NAME of the class.
   *
   * <p>Asserted here rather than assumed, because the mutation that breaks it is
   * one token in a file this one does not otherwise read.
   */
  it('means what it says only because the field is a grid, which the other sheet gives it', () => {
    const own = ruleFor(place, '.field.field--place', 'PlaceField.css')

    expect(own.getPropertyValue('display')).toBe('grid')
  })

  /**
   * AND IT CAN WIN, WHICH IS A DIFFERENT QUESTION FROM WHAT IT SAYS.
   *
   * <p><b>Measured in Chrome on 29.09.2026, with every other case in this file
   * green.</b> The rule above was first written `.form__row .field--place`, which is
   * (0,2,0) - exactly what `PlaceField.css`'s own `.field.field--place` weighs. Equal
   * weight is settled by whichever sheet the bundle emits last, and the one that won
   * was the other one: at 1280 the country came out 192px against the 309,33px of a
   * third, the town 434,67px, and „Država" began at 541 where „Telefon" on the row
   * above begins at 423,67. The owner's „jednake trećine" was undone and nothing in
   * this file could say so, because a guard that reads a sheet reads what a rule SAYS
   * and never which rule wins.
   *
   * <p><b>`styles/cellSpecificity.test.ts` is the portal's precedent and names this
   * exact shape</b>: „a rule written at the same weight is one its author had to think
   * about". This is that thought, written down.
   *
   * <p><b>What is asked, and its boundary.</b> Not specificity in general, which is
   * arithmetic over a grammar; the narrower question that is complete for this pair:
   * the rule that has to win must be the other one written as a DESCENDANT of
   * something. A selector ending in the whole of another and carrying a step in front
   * of it is strictly heavier by construction, whatever the rest of the grammar does,
   * and either rule renamed on either side fails this.
   */
  it('is written so that it beats the rule it argues with, rather than tying with it', () => {
    const inColumns = '.form__row .field.field--place'
    const onItsOwn = '.field.field--place'

    /* Both really are the two rules that argue: each is the one rule of its sheet
       that hands this field a track list, which `ruleInMedia` and `ruleFor` above
       already fail on if either is written twice or not at all. */
    expect(
      ruleInMedia(fields, QUERY, inColumns, 'FormRenderer.css').getPropertyValue(
        'grid-template-columns',
      ),
    ).not.toBe('')
    expect(
      ruleInMedia(place, BESIDE, onItsOwn, 'PlaceField.css').getPropertyValue(
        'grid-template-columns',
      ),
    ).not.toBe('')

    expect(inColumns.endsWith(` ${onItsOwn}`), `${inColumns} does not outweigh ${onItsOwn}`).toBe(
      true,
    )
  })

  it('leaves the rule for a town standing on its own alone', () => {
    /* The scope, held rather than described. Two other forms draw a town
       (`admin-dogadjaj`, `unos-rezultata`) and in both it stands on no row,
       where there are no thirds to be equal to: the reason `PlaceField.css`
       gives for the fixed width still holds there, that the town is typed and
       the country is chosen. Written without the `.form__row` in front of it,
       the rules above would have widened a control on two administrative
       screens nobody asked about.
     *
       The fixed width is a TRACK now rather than an `inline-size` on the half,
       because the half is no longer a box of its own; what it says is unchanged,
       and it says it in the query where the two stand side by side at all. */
    const own = ruleInMedia(place, BESIDE, '.field.field--place', 'PlaceField.css')

    expect(own.getPropertyValue('grid-template-columns')).toBe('minmax(0, 1fr) minmax(0, 12rem)')
  })
})
