import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bodyOf, unremarked } from '../test/stylesheet'

/**
 * The two things about the statute at the foot of the rulebook that no rendered
 * test can see, and both of them are why the component exists at all.
 *
 * jsdom applies no stylesheet and computes no custom property, so a test over
 * the markup sees the sign-off wrapper and the link and can say nothing about
 * where either one lands or what colour it is. Measured: deleting the whole
 * layout rule left the statute in its own row under the signature, full width,
 * and all 2035 tests stayed green; putting the raw gold scale back on the label
 * did the same.
 *
 * **Who wins is a question for a browser and it is not asked here.** What is
 * asked is what was missing on the day each fault would ship: that the rule is
 * written, and that it declares what it is meant to declare. The arrangement
 * itself was measured by hand in Chrome at 1280 and at 360 on 22.08.2026.
 *
 * The rule is found by the reader in `test/stylesheet.ts` and not by looking the
 * selector up in the text. Written the second way here first, and a review
 * measured all three ways it is wrong: a BEM modifier written above the rule was
 * read as the rule; the same layout written mobile-first failed although it
 * draws the same thing; and a rule renamed to `.section-body__signoff-wide`
 * with a `.section-body__signoff { display: block }` stub left behind passed
 * while the statute fell out of the signature's line. That reader exists because
 * the same mistake was made once before, in `styles/goldBand.test.ts`.
 */
const css = readFileSync(join(process.cwd(), 'src/components/StatuteLink.css'), 'utf-8')

describe('the statute at the foot of the rulebook', () => {
  it('lays the sign-off out as a row with the two ends apart', () => {
    /* „Sa desne strane u liniji sa potpisom" (owner, 22.08.2026). The name of
       the association and the document are the two ends of one line, which is
       three declarations and not one: a row, the ends pushed apart, and the
       wrapping that lets a narrow screen stack them instead of squeezing. */
    const rule = bodyOf(css, '.section-body__signoff')

    expect(rule).toMatch(/display:\s*flex/)
    expect(rule).toMatch(/justify-content:\s*space-between/)
    expect(rule).toMatch(/flex-wrap:\s*wrap/)
  })

  it('inks the label with the token that flips, never with the raw scale', () => {
    /* `--gold-600` is the gold that reaches 4.5:1 on white and it is not swapped
       on the dark theme, so the three letters were drawn at 3.14:1 over the dark
       surface — under the 4.5:1 this project holds itself to, at a size no
       exception covers. `--gold-text` is `--gold-600` on light and `--gold-300`
       on dark, which measures 10.88:1 there. `tokens.css` says it in so many
       words: components use only the semantic tokens, never the raw scales.
     *
       The ban is read over the sheet with its comments blanked out, because the
       comment above the rule explains the fault by naming the scale it was
       written in, and read whole the sheet failed its own ban. */
    expect(bodyOf(css, '.statute__kind')).toMatch(/fill:\s*var\(--gold-text\)/)
    expect(unremarked(css)).not.toMatch(/--gold-[0-9]/)
  })
})
