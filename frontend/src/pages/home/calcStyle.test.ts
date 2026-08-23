import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../../test/stylesheet'

/**
 * Where the word „Reset" stands, which no rendered test can see.
 *
 * The owner asked on 23.08.2026 that it stand on the line of „BTL poeni:" and at
 * that line's size. Both halves of that are a question of layout, and jsdom
 * applies no stylesheet and lays nothing out, so a rendered test finds the button
 * and can say nothing about where its word lands (ADL A18).
 *
 * Measured by hand in Chrome at 1280 instead, before and after: the two boxes
 * ended level while the word inside the button sat nine pixels above the line of
 * the label, because a button centres its word in a box taller than the word. On
 * a shared baseline the two words end level to a tenth of a pixel, the button
 * hangs below the line, and the card is ten pixels taller for it.
 *
 * What is asked here is that the two rules carrying that are written, that they
 * apply unconditionally, and that the size is the label's own rather than a
 * second copy of the same number.
 */
const css = readFileSync(join(process.cwd(), 'src/pages/Home.css'), 'utf-8')

describe('the answer row of the calculator', () => {
  it('puts the word in the button on the line of the words beside it', () => {
    expect(ruleFor(css, '.calc__answer', 'Home.css').getPropertyValue('align-items')).toBe(
      'baseline',
    )
  })

  it('gives that word the size of the label, and enough weight to keep it', () => {
    /* Asked of `.calc__answer .calc__reset` and not of `.calc__reset`, which is
       the whole lesson of this rule and not a matter of taste: one class weighs
       exactly what `.button--compact` weighs, and a tie goes to whichever sheet
       was loaded last. Measured in the browser with the one-class rule in place:
       the declaration was in the sheet, lost the tie, and the word stayed at
       13,6px while this file would have been green. Ask for the shape that wins,
       or hold nothing. */
    const reset = ruleFor(css, '.calc__answer .calc__reset', 'Home.css')
    const label = ruleFor(css, '.calc__label', 'Home.css')

    expect(reset.getPropertyValue('font-size')).toBe(label.getPropertyValue('font-size'))
    expect(label.getPropertyValue('font-size')).not.toBe('')
  })
})
