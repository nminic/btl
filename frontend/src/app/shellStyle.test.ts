import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bodyOf } from '../test/stylesheet'

/**
 * Where the three links of the footer sit, which no rendered test can see.
 *
 * jsdom applies no stylesheet, so a test over the markup finds the three links
 * and can say nothing about where they land. The owner asked on 22.08.2026 that
 * they be centred, and the row became the only thing in the footer that day: the
 * note about trial data left with it, and a row against the left edge under
 * nothing at all reads as the remains of something.
 *
 * Who wins is a question for a browser and is not asked here. What is asked is
 * that the rule is written and declares what it is meant to declare; the
 * arrangement itself was measured by hand in Chrome. The rule is found by the
 * reader in `test/stylesheet.ts`, which knows that a selector is not the tail of
 * a longer one and that a rule inside an at-rule is not this rule.
 */
const css = readFileSync(join(process.cwd(), 'src/app/Shell.css'), 'utf-8')

describe('the footer of every screen', () => {
  it('lays its links out centred', () => {
    const rule = bodyOf(css, '.shell__footer-links')

    expect(rule).toMatch(/display:\s*flex/)
    expect(rule).toMatch(/justify-content:\s*center/)
  })
})
