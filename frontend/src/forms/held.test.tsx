import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { renderWithI18n } from '../test/render'
import { ruleFor } from '../test/stylesheet'
import { bare } from '../test/sources'
import { FormRenderer } from './FormRenderer'
import { heldControl } from './held'
import type { FormDef } from './types'

/** One form drawing every kind of control the portal can hold, so the cascade is
 *  asked over the elements the renderer really puts around them.
 *
 *  `trka` comes from a list (`Suggesting`), `prica` is a long box (`LongBox`), and
 *  `izbor` is a select; the first two cross a component boundary carrying the
 *  shared object, the third is spread onto its element here. `dopisano` is the one
 *  nothing locks, so a dress that arrives everywhere is caught as well. */
const everyHeldKind: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'trka', type: 'text', labelKey: 'proba.trka' },
    { name: 'dopisano', type: 'text', labelKey: 'proba.dopisano' },
    { name: 'prica', type: 'textarea', labelKey: 'proba.prica' },
    {
      name: 'izbor',
      type: 'select',
      labelKey: 'proba.izbor',
      options: [
        { value: 'da', labelKey: 'proba.da' },
        { value: 'ne', labelKey: 'proba.ne' },
      ],
    },
    /* The other select. It draws its own list of countries and is a branch of its
       own, which a mutation found: the first `<select {...shared}>` in the renderer
       is this one, and a case that asked only about the other missed it. */
    { name: 'drzava', type: 'country', labelKey: 'proba.drzava' },
    { name: 'slika', type: 'photo', labelKey: 'proba.slika' },
    { name: 'pristanak', type: 'checkbox', labelKey: 'proba.pristanak' },
  ],
}

/** Everything that form holds back, which is everything but `dopisano`. */
const FIXED = ['trka', 'prica', 'izbor', 'drzava', 'pristanak']

/** The list `trka` is filled from. */
const SUGGESTS = {
  trka: [
    {
      id: 'jedna',
      value: 'Probna trka',
      said: 'Probna trka – 19.04.2026. – 42,2 km',
      fills: { dopisano: '42,2' },
    },
  ],
}

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

  it('still dresses every held control the portal draws, whatever else the sheets say', () => {
    /* The cascade, asked of something that computes one, over the markup the portal
       really draws.
     *
     * Three rounds of review went into the shape of this. The first version compared
     * where two rules stood in the text of a sheet and was beaten four ways over. The
     * second took the wrong lesson from that and asked nothing at all. The third asked
     * jsdom, which does compute this, but over two bare inputs hung on the body — and
     * a review found the hole at once: **nine** rules in the built sheet reach a
     * `.field__control` through an ancestor and every one of them outweighs the
     * dress. `.suggests > .field__control` is one, over the very control this branch
     * was written for.
     *
     * So the controls are the ones the renderer draws, inside the elements it puts
     * around them, and the sheets are laid over that. Worst case on purpose: every
     * other sheet after the one the dress lives in, so a rule of the same weight
     * anywhere has its best chance to win.
     *
     * **What this still cannot see, said plainly:** jsdom applies no conditional
     * group rule, so `@media`, `@supports` and `@container` are invisible here, and
     * the portal uses all three. That, and everything about how the page is laid out,
     * is what `npm run appearance` is for.
     */
    const own = join('src', 'forms', 'FormRenderer.css')
    const sheets = [own, ...globSync('src/**/*.css').filter((file) => file !== own)]
    const style = document.createElement('style')

    style.textContent = sheets
      .map((file) => readFileSync(join(process.cwd(), file), 'utf-8'))
      .join(NEWLINE)
    document.head.append(style)

    renderWithI18n(
      <FormRenderer form={everyHeldKind} fixed={FIXED} suggests={SUGGESTS} onSubmit={() => undefined} />,
    )

    try {
      for (const name of FIXED) {
        const control = screen.getByLabelText(new RegExp(`proba.${name}`))
        const seen = getComputedStyle(control)

        expect(control, `${name} is not wearing the dress at all`).toHaveClass(NAME)
        expect(seen.cursor, `${name} lost its cursor to another rule`).toBe('default')
        expect(seen.background, `${name} lost its ground to another rule`).toBe(
          'var(--surface-hover)',
        )
      }

      /* And the box beside them, which nothing locked, is wearing neither. */
      const live = getComputedStyle(screen.getByLabelText(/proba.dopisano/))

      expect(live.cursor).not.toBe('default')
    } finally {
      style.remove()
    }
  })

  it('shades a held control differently from a live one, which is half the dress', () => {
    /* `getComputedStyle` above says which declaration won; it cannot say that the
       declaration paints anything different, because jsdom leaves `var()` alone. So
       the two names are compared where they are given their values: a review on
       29.08.2026 set `--surface-hover` to `--surface` in every theme, and the held
       control lost its shading in Chrome while the whole suite stayed green.

       Every place the two are named, because the portal gives them a value once for
       the light theme and again for the dark. */
    const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')
    const valuesOf = (token: string) =>
      [...tokens.matchAll(new RegExp(String.raw`--${token}:\s*([^;]+);`, 'g'))].map((at) =>
        (at[1] ?? '').trim(),
      )
    /* Indirection followed, because the two were once made equal by pointing the
       second at the first rather than by repeating its value, and a comparison of
       the two strings called that a difference. Followed as far as the file goes and
       no further: `--surface` is itself `var(--white)`, so one step is not enough
       and three is more than this file has ever needed. */
    const meaning = (value: string) => {
      let said = value

      for (let step = 0; step < 3; step += 1) {
        const points = /^var\(--([\w-]+)\)$/.exec(said)

        if (points === null) {
          return said
        }

        said = valuesOf(points[1] ?? '')[0] ?? said
      }

      return said
    }

    const ground = valuesOf('surface').map(meaning)
    const shaded = valuesOf('surface-hover').map(meaning)

    expect(ground.length, 'the portal no longer names --surface').toBeGreaterThan(0)
    expect(shaded.length, 'a theme names one of the two and not the other').toBe(ground.length)

    for (const [at, one] of ground.entries()) {
      expect(shaded[at], '--surface-hover is --surface in one of the themes').not.toBe(one)
    }
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

       Where the cascade **is** asked is the case above, which computes one, and in
       `npm run appearance`, which asks a browser. The held control is not yet one of
       the controls that script measures; that is written down as its own piece of
       work.

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

/** What joins one sheet to the next, written here because a literal newline in a
 *  string is not something this file may carry. */
const NEWLINE = String.fromCharCode(10)

/** The sheet the rule lives in, read once. */
const SHEET = readFileSync(join(process.cwd(), 'src/forms/FormRenderer.css'), 'utf-8')
/** The name of the class, written once here so this file is not a fifth home. */
const NAME = 'field__control--held'
/** What `globSync` puts between the folders on this machine. */
const SEP = join('a', 'b').slice(1, -1)
