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
 *
 * **What is deliberately not here: the width of the row of dots.** A day may
 * hold five dots and the gap before them and no more, the sixth broke that on
 * 30.08.2026, and the row now wraps under a ceiling of five dots and four gaps
 * (`pages/Calendar.css`). Draft after draft of a check over that ceiling was
 * written, and every one was measured passing on the fault it was written for or
 * failing on a change with no effect at all. **What the commits show them reading,
 * in order:** the sheet whole, with the value worked out by hand; a rule cut at the
 * first brace (`bfbb2c9`); jsdom's own parser, without reading the gap at all
 * (`d8a3665`); the gap counted out of two tokens (`aeb820e`); and the name the gap
 * is declared under (`2a560a6`). The check went altogether at `3f30613`. The last
 * of the readings failed when `--dot-gap` moved to `:root`, which a browser cannot
 * tell apart to the hundredth of a pixel, and passed when a `gap` written in a
 * media query broke the row into two lines.
 *
 * An earlier version of this paragraph named „its last word", a reading of the
 * shorthand's final token that no commit carries, and it also missed the reading that
 * asked jsdom's own parser and never looked at the gap. **The count of five was right
 * and stayed five**; two of the five items were wrong, and what is written above is
 * now read off the commits rather than out of memory (review, 31.08. and 04.09.2026).
 *
 * They were all the same mistake. A width is geometry, jsdom lays nothing out
 * (ADL A33), and every reading of the sheet is a stand-in that a cascade beats:
 * a longhand under a shorthand, a media query, another sheet. So there is no
 * sixth stand-in. **Where it is measured instead:** in a real browser, at 360,
 * 780, 1440 and 1560 pixels and at 100% and 200% text, with the numbers written
 * where the rule is (`pages/Calendar.css`) and in ADL A26. **What holds it between
 * those measurements is that the row of dots has one name**, `--length-dots-row` in
 * `styles/tokens.css`, read by the ceiling over the row and by the floor under the
 * day it is drawn in. That is a smaller promise than a check and an honest one.
 *
 * It used to be „the sheet names the gap once and counts four of that name", with the
 * name on the row's own rule. Two rules are that width and they are not in one
 * subtree: named there, the gap is undefined where the floor reads it, the whole
 * declaration is invalid, and the day has no floor at all (measured in a browser,
 * 05.09.2026).
 */

const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')
const table = readFileSync(join(process.cwd(), 'src/styles/table.css'), 'utf-8')

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
})
