import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { WHOLE } from '../../components/crop'
import { CropWindow } from '../../components/CropWindow'
import { renderWithI18n } from '../../test/render'
import { everyRule, ruleFor } from '../../test/stylesheet'

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

  it('is capped by no rule of the sheet, written under either name of the property and from any rule that picks an element of it', () => {
    /* The case above reads one rule and one spelling, which is the question „how is the declaration
       written" and not „does the picture have a cap" (review of PR 677, medium): `max-height: 20rem`
       in the same rule, and `max-block-size: 20rem` from a second rule that picks the same element,
       both passed it. So the picture is drawn for real, the element the card stands it in and
       everything the window draws inside it, and every rule of the sheet, in any query, is asked
       whether it picks one of them. Both names are asked because they are one property written two
       ways, and the sheet's own text is asked and not the declaration jsdom computes, which keeps
       the one it was given and drops the other. */
    const { container } = renderWithI18n(
      createElement(
        'div',
        { className: 'pending__picture' },
        createElement(CropWindow, {
          picture: 'data:image/png;base64,x',
          crop: WHOLE,
          alt: 'Slika koja čeka',
        }),
      ),
    )
    const drawn = [container.firstElementChild, ...container.querySelectorAll('.pending__picture *')]

    expect(drawn.length).toBeGreaterThan(1)

    const capping = everyRule(css, 'Verification.css').filter(
      (rule) =>
        /max-(block-size|height)\s*:/.test(rule.cssText) &&
        drawn.some((element) => element?.matches(rule.selectorText)),
    )

    expect(capping.map((rule) => rule.cssText)).toEqual([])
  })
})
