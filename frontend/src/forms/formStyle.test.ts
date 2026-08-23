import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../test/stylesheet'

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
