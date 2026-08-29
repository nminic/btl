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

  it('comes after every rule of the same weight that would undo it', () => {
    /* Why the rule moved out of `PlaceField.css` on 29.08.2026:
       `.field__control--held` and `.field__control` are the same weight and set the
       same property, so which of them wins is decided by nothing but the order the
       sheets happen to load in, and four controls in three files wear this while
       only one of those files imported the sheet the rule lived in.

       **Every occurrence and not the first**, which is the whole of what makes this
       measurable: a review on 29.08.2026 added a second `.field__control` rule at
       the end of this same sheet, all four held controls lost their ground and
       their cursor in Chrome, and a version of this that read `indexOf` stayed
       green because the first occurrence was still where it had always been. */
    const dress = SHEET.indexOf(`.${NAME} {`)
    /* The bare rule and not every selector that ends in it: `.field__photo >
       .field__control` further down is heavier than the dress and says nothing
       about its ground or its cursor, so it is not what this is watching for. */
    const plain = [...SHEET.matchAll(/^\.field__control \{/gm)].map((at) => at.index)

    expect(plain.length, 'the plain control is no longer written here').toBeGreaterThan(0)
    expect(Math.max(...plain), 'a later rule of the same weight undoes the dress').toBeLessThan(
      dress,
    )
  })

  it('is written in one place, and so is the rule', () => {
    /* One fact, one home (ADL A31): the class is named by `heldControl` and by
       nothing else, and the rule is declared in one sheet and once.

       Both halves were found missing by a review on 29.08.2026. The first version
       swept only the sources, so a second `.field__control--held` written into any
       sheet that loads later took the dress off all four controls without a word;
       measured in Chrome, `PlaceField.css` — the very sheet the rule had just left
       — comes 25549 bytes after `FormRenderer.css` in the built bundle.

       **What this does not say.** It cannot say that a control which ought to be
       held asks for the dress: one written with a bare `field__control` passes here
       in silence, and that is exactly what `DatePicker.tsx` did until this change.
       That question is asked of each control where the control is drawn, and this
       one only closes the way the fault spreads.

       Read off the sources with comments blanked, because the class is named in
       several comments on purpose and a comment cannot dress anything. */
    const wrote = globSync('src/**/*.{ts,tsx}')
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .filter((file) => !file.endsWith(`forms${SEP}held.ts`))
      .filter((file) => bare(readFileSync(join(process.cwd(), file), 'utf-8')).includes(NAME))

    expect(wrote, `${NAME} is written by hand outside forms/held.ts`).toEqual([])

    const declared = globSync('src/**/*.css').filter((file) =>
      readFileSync(join(process.cwd(), file), 'utf-8').includes(`.${NAME} {`),
    )

    expect(declared, `${NAME} is declared somewhere other than FormRenderer.css`).toEqual([
      join('src', 'forms', 'FormRenderer.css'),
    ])
  })

  it('is the only rule in its own sheet that dresses it', () => {
    /* And once inside that sheet, for the same reason: a second declaration lower
       down needs no other file to undo the first. */
    expect(SHEET.split(`.${NAME} {`).length - 1, 'the dress is declared twice here').toBe(1)
  })
})

/** The sheet the rule lives in, read once. */
const SHEET = readFileSync(join(process.cwd(), 'src/forms/FormRenderer.css'), 'utf-8')
/** The name of the class, written once here so this file is not a fifth home. */
const NAME = 'field__control--held'
/** What `globSync` puts between the folders on this machine. */
const SEP = join('a', 'b').slice(1, -1)
