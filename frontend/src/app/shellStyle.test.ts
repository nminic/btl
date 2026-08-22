import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../test/stylesheet'

/**
 * Where the three links of the footer sit, which no rendered test can see.
 *
 * jsdom applies no stylesheet, so a test over the markup finds the three links
 * and can say nothing about where they land. The owner asked on 22.08.2026 that
 * they be centred, and the row became the only thing in the footer that day: the
 * note about trial data left with it, and a row against the left edge under
 * nothing at all reads as the remains of something.
 *
 * Who wins is a question for a browser and is not asked here; the arrangement
 * itself was measured by hand in Chrome, at 1280 and at 360. What is asked is
 * that the rule is written, **that it applies unconditionally**, and that it
 * declares what it is meant to declare.
 *
 * That middle question is why this reads `sheet.cssRules` and not the text of the
 * sheet (ADL A18). Written over the text first, and a review measured the cost
 * the same day: the whole rule wrapped in `@media print` left this green while
 * the links stopped being a flex row on screen and their boxes overlapped at
 * 360px in real Chrome. Text does not tell a live rule from a dead one.
 */
const css = readFileSync(join(process.cwd(), 'src/app/Shell.css'), 'utf-8')

describe('the footer of every screen', () => {
  it('lays its links out centred, and does so on every screen', () => {
    const rule = ruleFor(css, '.shell__footer-links', 'Shell.css')

    expect(rule.getPropertyValue('display')).toBe('flex')
    expect(rule.getPropertyValue('justify-content')).toBe('center')
  })
})
