import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { globSync } from 'node:fs'
import { ruleFor } from '../test/stylesheet'
import { bare } from '../test/sources'
import { heldControl } from './held'

/**
 * The one dress the portal has for a control it is holding, and the one place it
 * is decided.
 *
 * Guarded here rather than beside any one control, because what went wrong was not
 * in any one of them: the class was written out by hand at three places and
 * forgotten at a fourth, and every guard there was knew of the three. Measured by
 * a review on 28.08.2026 in Chrome over the built stylesheet: a date locked by a
 * chosen race differed from a live date in nothing at all, while the number
 * beside it differed in its background and its cursor.
 */
describe('what a held control wears', () => {
  it('says the same two things whichever control is asking', () => {
    expect(heldControl(true)).toBe('field__control field__control--held')
    expect(heldControl(false)).toBe('field__control')
  })

  it('is a rule with a home, and not only a name on an element', () => {
    /* A class on an element is half a guard: measured by a review on 28.08.2026 by
       renaming the rule in the stylesheet alone, all 2229 tests stayed green while
       a locked field went back to looking exactly like a live one.

       Two declarations and no more: what makes a held control tell a reader it
       will not answer is that it is shaded and that the pointer stops promising an
       answer over it. */
    const held = ruleFor(SHEET, '.field__control--held', 'FormRenderer.css')

    expect(held.background).toBe('var(--surface-hover)')
    expect(held.cursor).toBe('default')
  })

  it('names the class in one sheet and no other, and once inside it', () => {
    /* One fact, one home (ADL A31): the class is named by `heldControl` and by
       nothing else, and the rule is declared in one sheet and once.

       **What this can say and what it cannot, kept apart on purpose.** Where a name
       is written is a fact about the sources and is answered exactly. Which rule a
       browser lets win is a fact about the cascade, and no reading of source text
       answers it: a review on 29.08.2026 took a version of this that compared the
       positions of two rules and beat it four ways over, with a selector list, with
       an `@media` block, with `!important`, and with a second sheet, each of them
       leaving every control undressed in Chrome while the whole suite stayed green.

       That is the same wall `frontend/scripts/refused-control-appearance.mjs` was
       written against: „Nine rounds of review on `entityStyle.test.ts` proved it:
       every version tried to compute the cascade and each was blind to the next
       axis." So the cascade is not asked here at all. It is asked of a browser, by
       `npm run appearance`, and the held control is not yet one of the controls
       that script measures; that is written down as its own piece of work rather
       than answered with a guard that cannot fail.

       **And it cannot say that a control which ought to be held asks for the
       dress.** One written with a bare `field__control` passes here in silence,
       which is exactly what `DatePicker.tsx` did until 29.08.2026. That is asked of
       each control where the control is drawn: `DatePicker.test.tsx` for the date,
       `PlaceField.test.tsx` for the town and the country, and
       `FormRenderer.test.tsx` for a box the renderer fills and for one it fills
       through a list.

       Sources and sheets alike read with comments blanked, because the class is
       named in several comments on purpose — `DatePicker.css` names it to say why
       the button beside a held field repeats its two declarations rather than
       sharing them — and a comment cannot dress anything. Sheets read for the
       name in any selector and not for `.name {`, because a review beat that exact
       string with `.field__control--held,` at the head of a list. */
    const wrote = globSync('src/**/*.{ts,tsx}')
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .filter((file) => !file.endsWith(`forms${SEP}held.ts`))
      .filter((file) => bare(readFileSync(join(process.cwd(), file), 'utf-8')).includes(NAME))

    expect(wrote, `${NAME} is written by hand outside forms/held.ts`).toEqual([])

    const sheets = globSync('src/**/*.css').map((file) => ({
      file,
      times: named(bare(readFileSync(join(process.cwd(), file), 'utf-8'))),
    }))

    expect(
      sheets.filter((one) => one.times > 0).map((one) => one.file),
      `${NAME} is named in a sheet other than FormRenderer.css`,
    ).toEqual([join('src', 'forms', 'FormRenderer.css')])
    expect(
      sheets.find((one) => one.times > 0)?.times,
      `${NAME} is named more than once in its own sheet`,
    ).toBe(1)
  })
})

/** How many times a sheet names the class in a selector, in any of the shapes a
 *  selector may take: on its own, at the head or the tail of a list, or inside a
 *  block. Anything but a longer class name that merely starts the same way. */
function named(sheet: string): number {
  return [...sheet.matchAll(new RegExp(String.raw`\.${NAME}(?![\w-])`, 'g'))].length
}

/** The sheet the rule lives in, read once. */
const SHEET = readFileSync(join(process.cwd(), 'src/forms/FormRenderer.css'), 'utf-8')
/** The name of the class, written once here so this file is not a fifth home. */
const NAME = 'field__control--held'
/** What `globSync` puts between the folders on this machine. */
const SEP = join('a', 'b').slice(1, -1)
