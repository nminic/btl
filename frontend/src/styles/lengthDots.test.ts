import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ruleFor, ruleInMedia } from '../test/stylesheet'
import { DOTS } from '../data/types'

/* The dots a calendar tile carries, as colours.
 *
 * One home for the whole fact (ADL A31), and it was the profile's before: that
 * test named the five by hand, inside a `describe` about the ring on a profile.
 * The ring has five slices and always will, since it is drawn per length; the
 * calendar got a sixth dot on 30.08.2026 for a race that fixes no length, and a
 * list written out by hand says nothing about a name added to `DOTS`. So the
 * fact moved here and is asked of the list itself.
 *
 * **Read through the parser, never by cutting the text.** Two drafts of this cut
 * rules out of the sheet by hand and both were measured passing on the very
 * faults they were written for. The first read the sheet whole, so
 * `flex-wrap: wrap` written twice in the legend answered for a row of dots told
 * `nowrap`. The second cut one rule at the first closing brace, which is the
 * shape ADL A18 forbids by name: it says nothing about whether a rule applies,
 * so `.chip__lengths` wrapped in `@media print` still answered, dead on every
 * screen, and `.legend .length-dot` written above the real rule answered in its
 * place, since the tail of a longer selector reads the same. Both measured in
 * review with the whole suite green (30.08.2026).
 *
 * `ruleFor` asks jsdom's own parser for the one unconditional rule of exactly
 * that selector, which answers all three at once. It is also why a value written
 * twice inside one rule is no longer remarked on: the parser keeps the last, as
 * a browser does, so writing one twice was never the fault. The fault was
 * writing it into one theme and not another, and that is asked of each theme
 * here.
 */

const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')
const table = readFileSync(join(process.cwd(), 'src/styles/table.css'), 'utf-8')
const calendar = readFileSync(join(process.cwd(), 'src/pages/Calendar.css'), 'utf-8')

/** The three rules a colour is written in: the light theme, the dark one behind
 *  the media query, and the dark one behind the switch. */
function themes(): { where: string; style: CSSStyleDeclaration }[] {
  return [
    { where: 'the light theme', style: ruleFor(tokens, ':root', 'tokens.css') },
    {
      where: 'the dark theme, behind the media query',
      style: ruleInMedia(
        tokens,
        '(prefers-color-scheme: dark)',
        ":root:not([data-theme='light'])",
        'tokens.css',
      ),
    },
    {
      where: 'the dark theme, behind the switch',
      style: ruleFor(tokens, ":root[data-theme='dark']", 'tokens.css'),
    },
  ]
}

describe('every dot a calendar tile can carry', () => {
  it('is given a colour in each of the three theme blocks', () => {
    /* Each theme asked on its own, because the fault this is written for is a
       colour that reaches one of them and not another: the sixth was written
       into the media query and left out of the switch, so a reader using the
       toggle kept the light violet on a dark ground (measured 30.08.2026, in
       this branch, before the review). A count over the sheet as a whole passed
       on that, since the sheet did hold three of them. */
    for (const one of DOTS) {
      for (const { where, style } of themes()) {
        expect(style.getPropertyValue(`--length-${one}`), `${one} in ${where}`).not.toBe('')
      }
    }
  })

  it('is drawn in a colour of its own', () => {
    /* Which token each dot is **written** with, in the sheet that draws them.
       Measured: with the sixth dot written `var(--length-ultra)` there, every
       test in the portal passed until this asked.

       **And that is the whole of what this measures, which is narrower than it
       first read.** It said „nothing else says so", and a declaration read out of
       one sheet says nothing about which rule wins: a rule in another sheet,
       `.chip__lengths .length-dot--unmeasured { background: var(--length-ultra) }`
       in `Calendar.css`, paints the sixth dot in the ultra colour on the calendar
       and passes this untouched (measured in review, 30.08.2026). ADL A33 says
       the cascade goes to a browser and that a guard over text writes down what
       it does not measure rather than pretending. So: this holds where the colour
       is written, and nothing here holds what wins over it. */
    for (const one of DOTS) {
      const dot = ruleFor(table, `.length-dot--${one}`, 'table.css')

      expect(dot.getPropertyValue('background'), `${one} is painted its own token`).toBe(
        `var(--length-${one})`,
      )
    }
  })

  it('is drawn at a size the calendar writes its ceiling from', () => {
    /* The row of dots on a day may be as wide as five dots and the four gaps
       between them, and wraps past that: five is what the floor of a day was
       measured to hold, and a sixth arrived on 30.08.2026 and pushed its day
       12,78px past its own edge at 780/100% until this ceiling was written
       (`pages/Calendar.css`, and that number is measured in a browser because
       jsdom lays nothing out, ADL A33).

       What is asked here is that the ceiling and the row it caps are written
       from the same two tokens. Written apart, one could be moved and the
       ceiling would go on describing the old row, which is silent: the row
       would simply overflow, or wrap where it never used to, and no test that
       runs here can see a width.

       **Two tokens and not one, which is the correction of 30.08.2026.** The
       ceiling is five dots **and four gaps**, and an earlier draft read only the
       dot: `gap: var(--space-4)` changed to `var(--space-8)` left the formula
       saying 60px where the row then wanted 76, and five dots that have always
       stood in one line broke into two, which is the very outcome the sheet
       records as measured and rejected, with the whole suite green.

       The gap now has a name of its own in that rule and the ceiling counts four
       of **that**, so the two cannot come apart at all. What is left here is three
       readings of whether the names are still wired together, and nothing that
       parses a value or works out a width.

       **So `--dot-gap` moved to another value does not fall here, and should
       not.** Moving it moves the spacing and the ceiling together, by the same
       amount, and the row goes on describing itself: that was the whole point of
       giving it a name. What falls is one of the three coming loose from that
       name, which is the fault that was measured.

       **What this does not see, since a note is owed where a guard stops (ADL
       A33).** A `column-gap` written under the shorthand would win in a browser
       and is invisible here: jsdom does not expand `gap` into its longhands,
       measured, so a rule holding `gap` answers nothing at all for `column-gap`.
       A draft of this took the last word of the shorthand to work around that,
       and that is the fourth text reading in as many rounds to have its own
       edge; the value is not parsed at all now, and the sheet writes the gap one
       way, once. Nor is any width measured here. The row not outgrowing its day
       is geometry, it was measured in a browser at four widths and two sizes of
       letter, and the numbers live in `pages/Calendar.css` and in ADL A26. */
    const size = ruleFor(tokens, ':root', 'tokens.css').getPropertyValue('--length-dot-size')
    const dot = ruleFor(table, '.length-dot', 'table.css')
    const row = ruleFor(calendar, '.chip__lengths', 'Calendar.css')

    expect(size, 'the size has a home in the light theme, which every theme starts from').not.toBe(
      '',
    )
    expect(dot.getPropertyValue('inline-size'), 'a dot is drawn from it').toBe(
      'var(--length-dot-size)',
    )
    expect(row.getPropertyValue('max-inline-size'), 'the ceiling is written from the same one').toBe(
      'calc(5 * var(--length-dot-size) + 4 * var(--dot-gap))',
    )
    expect(row.getPropertyValue('--dot-gap'), 'the gap it counts four of has a name here').not.toBe(
      '',
    )

    expect(row.getPropertyValue('gap'), 'and the row is spaced by that name').toBe('var(--dot-gap)')
    expect(row.getPropertyValue('flex-wrap'), 'and the row may wrap under it').toBe('wrap')
  })
})
