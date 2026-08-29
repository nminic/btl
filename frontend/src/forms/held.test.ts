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

  it('stands beside the plain control, and above the rule for a wrong one', () => {
    /* Two facts about where the rule sits, and both of them are the reason it
       moved out of `PlaceField.css` on 29.08.2026.

       Beside the plain control, because `.field__control--held` and
       `.field__control` are the same weight, so which of them wins is decided by
       nothing but the order the sheets happen to load in; four controls in three
       files wear this, and only one of those files imported the sheet that held
       the rule.

       Above the invalid rule, because those two are the same weight as each other
       as well: below it, a held field that is also wrong would stop showing what
       is wrong with it. */
    const plain = SHEET.indexOf('.field__control {')
    const dress = SHEET.indexOf('.field__control--held {')
    const wrong = SHEET.indexOf(".field__control[aria-invalid='true'] {")

    expect(plain, 'the plain control is no longer written here').toBeGreaterThan(-1)
    expect(dress).toBeGreaterThan(plain)
    expect(dress).toBeLessThan(wrong)
  })

  it('is written in one place, so a fifth control cannot be drawn without it', () => {
    /* The fault itself, said as a rule rather than as four fixes (ADL A31). Every
       control the portal holds asks `heldControl`; nothing else writes the name of
       the class. A hand-written copy is how the date came to be held without
       looking held, and this is the only guard that would have caught it before it
       shipped: it does not need to know how many controls there are.

       Read off the sources with comments blanked, because the class is named in
       several comments on purpose and a comment cannot dress anything. */
    const wrote = globSync('src/**/*.{ts,tsx}')
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .filter((file) => !file.endsWith(`forms${SEP}held.ts`))
      .filter((file) => bare(readFileSync(join(process.cwd(), file), 'utf-8')).includes(NAME))

    expect(wrote, `${NAME} is written by hand outside forms/held.ts`).toEqual([])
  })
})

/** The sheet the rule lives in, read once. */
const SHEET = readFileSync(join(process.cwd(), 'src/forms/FormRenderer.css'), 'utf-8')
/** The name of the class, written once here so this file is not a fifth home. */
const NAME = 'field__control--held'
/** What `globSync` puts between the folders on this machine. */
const SEP = join('a', 'b').slice(1, -1)
