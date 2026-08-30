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
    /* The colour is what a reader sees, so a rule that reaches for the wrong
       token gives two lengths one colour and nothing else says so. Measured:
       with the sixth dot painted `var(--length-ultra)`, every test in the
       portal passed, this one included, until it asked this question.

       Its own token and no other's, which is the whole question: a bookkeeping
       of who wears what would only ask the same thing twice, since a rule
       holding its own token cannot also be holding somebody else's. */
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

       What is asked here is that the ceiling and the dot are the same fact, in
       one place. Written apart, the dot could be made wider and the ceiling
       would go on describing the old one, which is silent: the row would simply
       overflow again, and no test that runs here can see a width. */
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
      'calc(5 * var(--length-dot-size) + 4 * var(--space-4))',
    )
    expect(row.getPropertyValue('flex-wrap'), 'and the row may wrap under it').toBe('wrap')
  })
})
