import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor, ruleInMedia } from '../test/stylesheet'

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
describe('a town standing on a row of columns', () => {
  const QUERY = '(min-width: 51.25em)'

  it('is two of those columns, and its halves are one each', () => {
    const halves = ruleInMedia(
      fields,
      QUERY,
      '.form__row .field--place .place__town, .form__row .field--place .place__country-pick',
      'FormRenderer.css',
    )

    /* A basis of zero, written `0%` so every parser reads the shorthand, and not `auto`: `auto` starts from the width of the
       content, and the content of one half is an empty box while the other is a
       list of two hundred and forty six countries. */
    expect(halves.getPropertyValue('flex')).toBe('1 1 0%')
    expect(halves.getPropertyValue('min-inline-size')).toBe('0px')
    /* And the fixed width `PlaceField.css` gives the country undone, or the
       half is a half of nothing. */
    expect(halves.getPropertyValue('inline-size')).toBe('auto')
    expect(halves.getPropertyValue('max-inline-size')).toBe('none')
  })

  it('splits them by the gap between the columns, so each half IS a column', () => {
    /* The third thing, and the one that a guard about the halves alone would
       miss entirely: two equal halves of a field two columns wide are only two
       columns if what parts them is what parts the columns. */
    const inside = ruleInMedia(fields, QUERY, '.form__row .field--place .place', 'FormRenderer.css')
    const row = ruleFor(fields, '.form__row', 'FormRenderer.css')

    expect(inside.getPropertyValue('gap')).toBe(row.getPropertyValue('gap'))
    expect(inside.getPropertyValue('gap'), 'the row no longer names a gap at all').not.toBe('')
  })

  it('leaves the rule for a town standing on its own alone', () => {
    /* The scope, held rather than described. Two other forms draw a town
       (`admin-dogadjaj`, `unos-rezultata`) and in both it stands on no row,
       where there are no thirds to be equal to: the reason `PlaceField.css`
       gives for the fixed width still holds there, that the town is typed and
       the country is chosen. Written without the `.form__row` in front of it,
       the rules above would have widened a control on two administrative
       screens nobody asked about. */
    const sheet = readFileSync(join(process.cwd(), 'src/forms/PlaceField.css'), 'utf-8')
    const own = ruleFor(sheet, '.place__country-pick', 'PlaceField.css')

    expect(own.getPropertyValue('inline-size')).toBe('12rem')
    expect(own.getPropertyValue('max-inline-size')).toBe('45%')
    expect(own.getPropertyValue('flex')).toBe('0 0 auto')
  })
})
