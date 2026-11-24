import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../test/stylesheet'

/**
 * A refusal under a box that stands inside `.rankings__field`.
 *
 * Independent review of PR 822 (24.11.2026): the error under the password boxes read in CAPITALS,
 * because `.rankings__field` writes its label in uppercase and the error is a child of it, and the
 * boxes got no red frame for `aria-invalid`, because they are not `.field__control`. jsdom lays
 * nothing out, so the sheet is read as text (the reason `styles/rankingsMemberRow.test.ts` gives).
 *
 * What puts the error INSIDE that field is asked of the DOM in
 * `pages/member/myAccountScreen.test.tsx`, because a sheet cannot say where the portal drew it.
 */
const CSS = readFileSync(join(process.cwd(), 'src/pages/Rankings.css'), 'utf-8')

describe('an error under a box of .rankings__field', () => {
  it('is written in sentence case, not in the capitals of the label above it', () => {
    const rule = ruleFor(CSS, '.rankings__field .field__error', 'Rankings.css')

    expect(rule.getPropertyValue('text-transform')).toBe('none')
    expect(rule.getPropertyValue('letter-spacing')).toBe('normal')
  })

  it('reddens the frame of a box the reader is told is wrong', () => {
    const rule = ruleFor(CSS, ".rankings__field input[aria-invalid='true']", 'Rankings.css')

    expect(rule.getPropertyValue('border-color')).toBe('var(--down)')
  })
})
