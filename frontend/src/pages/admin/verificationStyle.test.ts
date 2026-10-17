import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../../test/stylesheet'

/* What the stylesheet of the verification queues has to say, read as text.
 *
 * jsdom applies no stylesheet, so every rendered test on these screens sees a
 * card that is never folded. What the stylesheet does to a card lives exactly in
 * that blind spot, so it is held here, as text.
 */
const css = readFileSync(join(process.cwd(), 'src/pages/admin/Verification.css'), 'utf-8')

describe('the picture a moderator is deciding about', () => {
  it('stands in a place with no cap on its height, which is the other half of a decision `CropWindow.tsx` already guards for the member', () => {
    /* PDL.md, ODLUKA 28.08.2026 (derived from measurement, not a new owner
       sentence): "Moderatoru se ne ograničava, jer on nema šta da povlači i
       njegov je posao da vidi ceo ostatak." `CropWindow.tsx` guards its half of
       that split - `maxBlockSize: '60svh'` only where `onChange !== undefined` -
       at `cropChooser.test.tsx`'s "takes none of them where there is nothing to
       drag": an empty `maxBlockSize` where there is nothing to drag. This rule is
       the other half of the identical split, on the place the window stands in on
       this card, and it had no guard of its own: a `max-block-size: 20rem` written
       here once passed every case in this file and in
       `moderatorSeesThePicture.test.tsx` unchanged. */
    const rule = ruleFor(css, '.pending__picture', 'Verification.css')

    expect(rule.getPropertyValue('max-block-size')).toBe('')
  })
})
