import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { must } from '../test/at'
import { renderWithI18n } from '../test/render'
import { ruleFor } from '../test/stylesheet'
import { bare } from '../test/sources'
import { FormRenderer } from './FormRenderer'
import { heldControl } from './held'
import type { FormDef } from './types'

/** One form drawing every control the portal dresses as held, so the cascade is
 *  asked over the elements the renderer really puts around them.
 *
 *  **Seven branches of the renderer are handed its shared set, and all seven are
 *  here.** `trka` comes from a list (`Suggesting`) and `prica` is a long box
 *  (`LongBox`); those two cross a component boundary carrying the object. `izbor`,
 *  `drzava`, `slika` and `pristanak` are spread onto their elements here, and so is
 *  `dopisano`, which is the one nothing locks, so a dress that arrives everywhere
 *  is caught as well. Branches and not kinds, because `email`, `password` and
 *  `number` are drawn by the very branch that draws `dopisano`: one road, four
 *  kinds, and a fifth field on it would say nothing a sixth does not.
 *
 *  **Two more write the class themselves**, from components of their own, and both
 *  were missing from this form until 29.08.2026 although they are the very fault
 *  the branch was written for: `datum` is drawn by `DatePicker.tsx` and `mesto` by
 *  `PlaceField.tsx`. Each of them sits under an ancestor of its own with a rule of
 *  its own — `.datepicker .field__control` and `.place__town .field__control`, both
 *  (0,2,0) against the dress's (0,1,0), so both win whatever the order of the
 *  sheets. A review on 29.08.2026 put `background` and `cursor` into each of them
 *  in turn and the whole suite stayed green, over the one control the branch
 *  exists for: on `unos-rezultata` a chosen race locks the date.
 *
 *  `mesto` is two controls rather than one, and both wear the dress: the town, and
 *  the country beside it, which stands under `.place__country-pick` and is looked
 *  up by its own name below.
 *
 *  **That leaves one kind of the twelve unrepresented, `choice`, and on purpose.**
 *  A group of radio buttons is not a `.field__control` at all: the buttons wear
 *  `choice__input` and the lock reaches them as `aria-disabled` and nothing else,
 *  so there is no dress on them for another rule to take away. That the lock does
 *  reach them is asked in `FormRenderer.test.tsx`, over `fillsEverything`. */
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
    /* The two the renderer does not draw at all. It hands the day to `DatePicker`
       and the town to `PlaceField`, neither of which ever sees the shared object,
       and each of them writes `heldControl` itself. */
    { name: 'datum', type: 'date', labelKey: 'proba.datum' },
    { name: 'mesto', type: 'place', labelKey: 'proba.mesto' },
  ],
}

/** Everything that form holds back, which is everything but `dopisano`. */
const FIXED = ['trka', 'prica', 'izbor', 'drzava', 'slika', 'pristanak', 'datum', 'mesto']

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
     * **The two the renderer does not draw are here too**, since 29.08.2026, and
     * they are the ones the branch exists for: the day from `DatePicker.tsx` and the
     * town from `PlaceField.tsx`. Without them a review put `background` and
     * `cursor` into `.datepicker .field__control` and into
     * `.place__town .field__control` in turn and this case stayed green each time,
     * over a date a chosen race had locked on `unos-rezultata`.
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
      /* One control per locked field, and two for the town: the country beside it is
         a control of its own, stands under an ancestor of its own
         (`.place__country-pick`), and writes `heldControl` on a line of its own
         (`PlaceField.tsx`). Asked for by its own name, the way `PlaceField.test.tsx`
         asks for it, because the field's label names the town. */
      const held = [
        ...FIXED.map((name) => ({
          said: name,
          control: screen.getByLabelText(new RegExp(`proba.${name}`)),
        })),
        { said: 'the country beside mesto', control: screen.getByRole('combobox', { name: /^Država/ }) },
      ]

      /* Nothing was found by accident: eight locked fields and the country. An
         emptied `FIXED` would otherwise pass this case in silence. */
      expect(held).toHaveLength(9)

      for (const { said, control } of held) {
        const seen = getComputedStyle(control)

        expect(control, `${said} is not wearing the dress at all`).toHaveClass(NAME)
        expect(seen.cursor, `${said} lost its cursor to another rule`).toBe('default')
        expect(seen.background, `${said} lost its ground to another rule`).toBe(
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
       the light theme and again for the dark.

       **Each theme is asked in its own palette**, which is the whole of what a
       review found wrong with the first version of this on 29.08.2026. That one
       followed `var()` through the first value the file gave a token, which is
       always `:root`'s: written into both dark blocks, `--surface-hover:
       var(--surface)` left the whole suite green while the held control lost its
       shading in Chrome under a dark theme. A theme that does not name a token at
       all falls back to `:root`, which is what a browser does with a token the theme
       never overrides, and nothing else does.

       **And they are compared as colours rather than as text**, through the
       parser that already knows how. The same review wrote `--surface-hover:
       #FFFFFF` beside a `--surface` that resolves to `#ffffff`, and two strings
       that differ in nothing but their case read as a difference. A value the
       parser cannot reduce to an `rgb(...)` fails here saying so, rather than
       being compared as the text it happens to be written as.

       **What this does not say, and where it is said instead.** Not that the two
       colours are far enough apart to be seen — that is contrast, and it is
       measured against a floor in `styles/goldBand.test.ts`. Not which of the three
       palettes a given reader is served, because no condition is evaluated here at
       all. `npm run appearance` asks a browser both of those.

       Read with its comments blanked, like every other source and sheet this file
       reads, and the case below says the same of the sources. Two things go wrong
       without it, and the second is the worse. A note explaining why a token holds
       what it holds may name a token and a value — this portal writes „it was X
       until Y" over half its declarations — and a palette taken off the raw text
       reads such a line as a declaration, which is this very case's fault written in
       prose. And the comment that opens the file stands between the last punctuation
       and `:root`, so the base palette comes out under a selector that is the whole
       of that comment and is then not found at all: measured on 29.08.2026, the case
       failed saying there is no `:root` palette, which is a sentence about this
       reader rather than about the sheet. */
    const themes = palettes(bare(readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')))
    const root = themes.find((one) => one.where === ':root')
    const base = must(root, ':root palette in tokens.css, which every theme falls back to').given

    /** That token as this theme paints it: its own value where it names one, and
     *  `:root`'s where it does not. `var()` is followed the same way, inside the
     *  theme that is asking, as far as the file goes and no further: `--surface` is
     *  itself `var(--white)`, so one step is not enough and three is more than this
     *  file has ever needed. */
    const inTheme = (token: string, given: Map<string, string>) => {
      let said = (given.get(token) ?? base.get(token) ?? '').trim()

      for (let step = 0; step < 3; step += 1) {
        const points = /^var\(--([\w-]+)\)$/.exec(said)

        if (points === null) {
          return said
        }

        const next = points[1] ?? ''

        said = (given.get(next) ?? base.get(next) ?? said).trim()
      }

      return said
    }

    /** A colour as the browser's own parser writes it, so `#FFFFFF`, `#fff` and
     *  `rgb(255 255 255)` are one value and not three (ADL A18: ask the parser). */
    const painted = (value: string, where: string) => {
      const box = document.createElement('div')

      box.style.color = value

      expect(box.style.color, `${value} in ${where} is not a colour this can compare`).toMatch(
        /^rgba?\(/,
      )
      return box.style.color
    }

    const naming = themes.filter(
      (one) => one.given.has('surface') || one.given.has('surface-hover'),
    )

    /* One palette for the light theme, one for a dark system and one for the switch
       on the page. Fewer means a theme has quietly stopped naming its own ground and
       is drawing another theme's, which is a fault of the same family as the one
       this case is about. */
    expect(
      naming.map((one) => one.where),
      'the two grounds are no longer written out by three palettes',
    ).toHaveLength(3)

    for (const theme of naming) {
      expect(
        theme.given.has('surface-hover'),
        `${theme.where} names one of the two grounds and not the other`,
      ).toBe(theme.given.has('surface'))
      expect(
        painted(inTheme('surface-hover', theme.given), theme.where),
        `--surface-hover is --surface in ${theme.where}`,
      ).not.toBe(painted(inTheme('surface', theme.given), theme.where))
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

/**
 * Every palette a sheet writes: the custom properties one block gives values to,
 * under the selectors that put that block where it is.
 *
 * Read by walking the braces rather than with one expression per theme, and both
 * halves of that are measured faults. A reader anchored on the order of the file
 * answers every theme with the first value it finds, which is the light one; a
 * reader anchored on a selector has to be told the three selectors, and the dark
 * palette is written twice with the second of the two inside a media query, so the
 * one that is easiest to forget is the one a dark system actually reads.
 *
 * What opened a block is whatever stands between its brace and the punctuation
 * before it, which is the reading `test/stylesheet.ts` already does for the rules
 * of a sheet (`underAtRulesOnly`). Two blocks are one palette when the selectors
 * that opened them are the same all the way up, so `:root` inside a media query
 * and `:root` outside one are two, as a browser has them.
 *
 * Comments are the caller's business: this counts braces, and a brace written in
 * prose is not one.
 */
function palettes(sheet: string): { where: string; given: Map<string, string> }[] {
  const found = new Map<string, Map<string, string>>()
  const open: string[] = []
  let said = ''

  const keep = () => {
    const written = /^\s*--([\w-]+)\s*:([\s\S]+)$/.exec(said)

    if (written !== null) {
      const where = open.join(' ')
      const given = found.get(where) ?? new Map<string, string>()

      given.set(written[1] ?? '', (written[2] ?? '').trim())
      found.set(where, given)
    }

    said = ''
  }

  for (const mark of sheet) {
    if (mark === '{') {
      /* The selector, with whatever a blanked comment left behind it folded away:
         a prelude is one line to a browser however many it is written over. */
      open.push(said.trim().replaceAll(/\s+/g, ' '))
      said = ''
    } else if (mark === '}') {
      /* A declaration is allowed to go without its semicolon where it is the last
         one of a block. Nothing in the palette does today, and it is read anyway
         because of how such a reader fails: it would drop that one declaration, hand
         the theme `:root`'s value for it, and report a palette naming one ground and
         not the other, which reads as a fault in the sheet rather than in here. */
      keep()
      open.pop()
    } else if (mark === ';') {
      keep()
    } else {
      said += mark
    }
  }

  return [...found].map(([where, given]) => ({ where, given }))
}

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
