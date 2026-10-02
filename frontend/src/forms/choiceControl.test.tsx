import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { FormRenderer } from './FormRenderer'
import { registracija } from './definitions'
import { at, must } from '../test/at'
import { contrast } from '../test/contrast'
import { everyRule, ruleFor } from '../test/stylesheet'
import { setupUser } from '../test/user'

/**
 * THE CONTROL THAT ANSWERS WITH BUTTONS, AND THE TWO THINGS THE OWNER ASKED OF
 * IT ON 28.09.2026.
 *
 * His words, whole: „pol zauzima tačno trećinu, dakle opcije su širine kao polje
 * za ime. Ne postoji štikliranje dugmića koje poremeti širinu polja, nego samo
 * treba da se promeni boja kao da je odabrano."
 *
 * Two requirements, and they fail apart, so they are measured apart:
 *
 * 1. the control takes the whole of the third it stands in, so its buttons are
 *    as wide as the box for a name beside them;
 * 2. that width is THE SAME whether an option is taken or not.
 *
 * **What this file cannot do, said out loud rather than dressed up.** jsdom lays
 * nothing out: `getBoundingClientRect` answers zero for everything and no
 * stylesheet is applied, which `forms/formStyle.test.ts` says at its own head and
 * `ADL` A18 records. **So no case here measures a pixel, and none pretends to.**
 * The pixels were measured in the browser, at 360, 768 and 1280, and written into
 * the description of this branch. What is held here is the thing the pixels
 * followed from: that the width is decided by a grid track and not by what stands
 * in the button, and that nothing the stylesheet does in the taken state can move
 * an edge.
 */

const SHEET = readFileSync(join(process.cwd(), 'src/forms/FormRenderer.css'), 'utf-8')
const TOKENS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')

function renderForm() {
  render(
    <ClockProvider simulatedDay={null}>
      <I18nProvider locale="sr">
        <FormRenderer form={registracija} onSubmit={() => {}} />
      </I18nProvider>
    </ClockProvider>,
  )
}

/**
 * WHAT MAY BE DECLARED ON A BUTTON WHEN ITS OPTION IS TAKEN: paint, and nothing
 * else.
 *
 * Written as what is ALLOWED rather than as a verdict per property, and that was
 * measured rather than chosen. The first draft was a map of „moves an edge" to
 * true or false, and half of it was unreachable: jsdom expands a shorthand, so
 * `padding: 2rem` arrives as `padding-top` first and is judged before the word
 * `padding` is ever reached. A list of the ways to widen a box is not a list
 * anybody can finish by thinking about it - `src/test/stylesheet.ts` says the
 * same thing about the ways to cut one, and paid for it once - so the list here
 * is the SHORT side, the one that can be finished.
 *
 * The floor is that anything not written here fails. A property nobody has
 * thought about is refused rather than waved through, which is the direction a
 * guard has to fail in.
 *
 * Every one of these is paint or is drawn outside the box, so none of them is in
 * the flow and none can move an edge. The colour shorthands carry their
 * longhands, because a value written without `var()` arrives expanded.
 */
const ONLY_PAINT = new Set([
  'background',
  'background-color',
  'background-image',
  'color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-block-color',
  'border-inline-color',
  /* Drawn outside the box and never counted into it. */
  'box-shadow',
  'outline',
  'outline-color',
  'outline-offset',
  'outline-style',
  'outline-width',
  'text-decoration-color',
  'opacity',
])

describe('the buttons one answer is chosen from', () => {
  it('is what the form really draws for the sex, and by these names', () => {
    /* THE JOIN between the two halves of this file, and it is held first because
       without it they measure two things that never met: one half reads rules
       written for `.choice` out of a stylesheet, the other reads the taken state
       off a rendered button, and what ties them is the CLASS. Sweep the class
       off `FormRenderer.tsx` in a tidy-up and both halves go on passing while the
       control lays out by nothing at all. */
    renderForm()

    const asked = must(
      registracija.fields.find((one) => one.name === 'gender'),
      'the registration form no longer asks for the sex',
    )

    expect(asked.type, 'the sex is no longer answered from buttons').toBe('choice')

    const group = must(document.querySelector('#field-gender'), 'the group of buttons for the sex')

    expect(group.classList.contains('choice'), 'the group does not carry the class the sheet lays out').toBe(true)

    const options = [...group.querySelectorAll('.choice__one')]

    expect(options.length, 'the buttons for the sex are not the ones the sheet lays out').toBe(
      (asked.options ?? []).length,
    )

    for (const one of options) {
      expect(one.querySelector('input.choice__input'), 'an option carries no radio').not.toBeNull()
      expect(one.querySelector('label.choice__label'), 'an option carries no button').not.toBeNull()
    }

    /* AND IT IS THE SEX AND NOT THE OTHER ONE. The form draws exactly two fields
       from buttons, the sex and the category, and both offer two options, so
       everything above this line is answered just as well by the wrong one of
       them: point the query at `#field-firstSeason2027` and it goes on passing
       while saying nothing about what the owner asked about. The words are what
       tell the two apart. */
    expect(options.map((one) => one.textContent)).toEqual(['Muški', 'Ženski'])
  })

  it('shares the field in equal parts, read off the track and not off the words', () => {
    /* One third of a row is the field (`registracija.form.json`, `columns`), and
       this is what makes the buttons INSIDE it that third rather than the width
       of „Muški" and „Ženski". Every track is `1fr`, so the buttons are equal
       whatever they hold.
     *
       AND THE TRACKS HAVE A FLOOR, so where two buttons would not hold their words
       they go one under the other, still equal and each as wide as the field. Until
       02.10.2026 the tracks were `minmax(0, 1fr)` in one line, and at 200% text on a
       telephone of 360 „Početnička" stood 9px past both edges of its button (stavka
       293.N1, measured in Chrome). `min(100%, ...)` so a field narrower than the floor
       is one button wide and never wider than itself. The floor is 7em, the widest
       option the portal has in its button; jsdom lays nothing out, so the words are
       measured in a browser and this holds the rule that the measurement chose. */
    const choice = ruleFor(SHEET, '.choice', 'FormRenderer.css')

    expect(choice.getPropertyValue('display')).toBe('grid')
    expect(choice.getPropertyValue('grid-template-columns')).toBe(
      'repeat(auto-fit, minmax(min(100%, 7em), 1fr))',
    )
    /* And the one-line flow is gone rather than left beside it: with columns flowing
       on one line the floor would push the second button off the field instead of
       under the first. */
    expect(choice.getPropertyValue('grid-auto-flow')).toBe('')

    /* THE JOIN BETWEEN THAT TRACK AND THE LABEL BELOW, which neither half on its
       own says a word about. `.choice` gives every button an equal TRACK and
       `.choice__label` FILLS whatever it is HANDED, but something has to hand
       `.choice__one` the whole of that track rather than let it size to its own
       content and sit at the track's start - it wraps an `inline-flex` box,
       which does exactly that the moment nothing stops it. Nothing here sets
       `justify-self` on `.choice__one`, so the sheet leans on Grid's own
       default, `stretch`; measured in the browser at 1280, adding `justify-self:
       start` here alone, nothing else touched, drops both options from
       150.66/150.67px to 77.61/80.70px and makes them unequal - the two
       assertions above and the two below this block stay green throughout,
       because neither reads this rule. */
    const one = ruleFor(SHEET, '.choice__one', 'FormRenderer.css')

    expect(
      ['', 'stretch'],
      `.choice__one declares justify-self: ${JSON.stringify(one.getPropertyValue('justify-self'))}, so it no longer spans the track .choice hands it and shrinks to its own content instead`,
    ).toContain(one.getPropertyValue('justify-self'))

    /* And the button filling the track it was given, rather than sitting in the
       middle of it at the width of its word. */
    const label = ruleFor(SHEET, '.choice__label', 'FormRenderer.css')

    expect(label.getPropertyValue('flex')).toBe('1 1 auto')
    expect(label.getPropertyValue('min-inline-size')).toBe('0px')
  })

  it('changes nothing but paint when an option is taken', async () => {
    /* THE OWNER'S SECOND SENTENCE, measured over the whole sheet rather than over
       the one rule that used to break it.
     *
       „Ne postoji štikliranje dugmića koje poremeti širinu polja, nego samo treba
       da se promeni boja kao da je odabrano." What was there until today was
       `content: '✓'` with a margin after it, on `.choice__input:checked +
       .choice__label::before`, so taking an option made the button wider by a
       tick and a gap.
     *
       Asked of every rule that applies ONLY in the taken state, which is a
       question with a bottom: the sheet is the whole of where such a rule can be
       written, and `everyRule` reads it through the parser, queries and all. A
       guard naming the one selector would go green the day the same mark is
       written under `::after`, or under a second rule, which is the shape this
       portal has been caught by before. */
    const taken = everyRule(SHEET, 'FormRenderer.css').filter((rule) =>
      rule.selectorText.includes(':checked'),
    )

    expect(taken.length, 'the sheet says nothing at all about a taken option').toBeGreaterThan(0)

    const declared = taken.flatMap((rule) =>
      [...rule.style].map((property) => ({ property, where: rule.selectorText })),
    )

    expect(declared.length, 'no property is declared for a taken option').toBeGreaterThan(0)

    for (const { property, where } of declared) {
      expect(
        ONLY_PAINT.has(property),
        `${property} is declared on ${where}: taking an option may change paint and nothing else, or the button moves under the hand that is choosing`,
      ).toBe(true)
    }
  })

  it('still says which one is taken to somebody who is not looking at it', async () => {
    /* **Derivation from `ADL` A7 and WCAG 2.2 AA, not the owner's sentence**, and
       marked as such where the sheet says it too: colour may not be the only
       carrier, so the state has to be announced. It is, and it always was - these
       are real radios and `checked` is what a reader speaks. Held here because
       the day somebody makes these `<button aria-pressed>` to be rid of the
       radios, the paint would be all that is left. */
    const user = setupUser()

    renderForm()

    const female = screen.getByLabelText('Ženski')
    const male = screen.getByLabelText('Muški')

    expect(female).not.toBeChecked()
    expect(male).not.toBeChecked()

    await user.click(female)

    expect(female).toBeChecked()
    expect(male).not.toBeChecked()
  })

  it('keeps the two states apart in grey, and its words readable on both', () => {
    /* WHY THIS IS NOT „colour alone" ONCE THE MARK IS GONE, and it is arithmetic
       rather than an opinion. SC 1.4.1 is about a difference nobody can see who
       cannot tell two HUES apart. A difference in LIGHTNESS survives being read
       in grey, and an unfilled box against a filled one is that: the numbers
       below are the ratio between the two surfaces, which is what the eye is
       given instead of a tick.
     *
       And SC 1.4.3 on top of it, because the words move with the fill: what is
       written on a taken option stands on the accent and not on the surface. */
    const given = (name: string) =>
      [...TOKENS.matchAll(new RegExp(`${name}: ([^;]+);`, 'g'))].map((one) => at(one, 1))

    /* Followed to a colour, because half of these are written as the name of
       another token: `--accent: var(--blue-700)` is not a hex. The same walk
       `styles/goldBand.test.ts` makes, and for the same reason it gives. */
    const colour = (value: string, seen: string[] = []): string => {
      const named = value.trim().match(/^var\((--[a-z0-9-]+)\)$/)

      if (named === null) {
        expect(value.trim(), `${value} is not a colour`).toMatch(/^#[0-9a-f]{6}$/)
        return value.trim()
      }

      const next = must(named[1], 'the name inside var()')

      expect(seen, `${next} is defined in terms of itself`).not.toContain(next)
      return colour(must(given(next)[0], `${next} has no value`), [...seen, next])
    }

    /** That token as the theme at `index` draws it, or as the light theme does. */
    const inTheme = (name: string, index: number) =>
      colour(must(given(name)[index] ?? given(name)[0], `${name} has no value`))

    /* One value for the light theme and two for the dark, which is how this file
       writes a token that flips: the query the system asks with, and the switch
       on the page. Fewer, and a theme has quietly lost its own value. */
    expect(given('--accent'), 'the accent no longer carries a value per theme').toHaveLength(3)
    expect(given('--surface'), 'the surface no longer carries a value per theme').toHaveLength(3)

    /* Theme 0 is the light one; 1 and 2 are the dark one twice, so the pair of
       numbers below is the light theme and the dark. */
    const states = [0, 1].map((theme) => ({
      theme,
      surface: inTheme('--surface', theme),
      accent: inTheme('--accent', theme),
      ink: inTheme('--accent-contrast', theme),
    }))

    for (const { theme, surface, accent, ink } of states) {
      /* The two states told apart without a tick. 3:1 is what WCAG 2.2 SC 1.4.11
         asks of a part of a control that carries meaning; these clear it by a
         wide margin, and the margin is the point: a token retuned to something
         flatter fails here rather than on somebody's screen. */
      expect(
        contrast(surface, accent),
        `theme ${theme}: a taken option is ${contrast(surface, accent).toFixed(2)}:1 away from an untaken one, which is too little to be seen in grey`,
      ).toBeGreaterThanOrEqual(3)

      /* And the words on the taken one, at the 4.5:1 normal text owes. */
      expect(
        contrast(ink, accent),
        `theme ${theme}: the word on a taken option reads ${contrast(ink, accent).toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5)
    }

    /* The four numbers as they stand today, so a retuning is a decision somebody
       takes rather than a drift nobody sees. Measured, not chosen. */
    expect(contrast('#ffffff', '#10459a')).toBeCloseTo(8.97, 2)
    expect(contrast('#101a2e', '#5b93ec')).toBeCloseTo(5.65, 2)
    expect(contrast('#06214a', '#5b93ec')).toBeCloseTo(5.16, 2)
  })
})
