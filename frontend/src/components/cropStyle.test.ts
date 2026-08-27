import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../test/stylesheet'

/**
 * The shape of the thing a member is choosing.
 *
 * Owner, 23.08.2026: „isečak je krug, ne kvadrat", and „Čuva se svakako cela slika,
 * a bolje se vidi samo oblik kruga jer će to da završi na profilnoj slici, dok je
 * ostatak slike (slika minus taj krug) zamračeniji".
 *
 * The cropper drew a square until 27.08.2026 while both screens that end up
 * showing the picture drew a circle: a face wears `border-radius: 50%`
 * (`Portrait.css`) and a team's logo wears `face-circle` (`TeamMark.css`). So the
 * square was never what anybody was choosing, and the corners were thrown away
 * afterwards without the member ever seeing it happen.
 *
 * jsdom applies no stylesheet and lays nothing out (ADL A18), so what is asked
 * here is that the rule is written and applies unconditionally. That the shade
 * really forms a ring, and that the outline follows the curve rather than staying
 * a rectangle around it, is a question for a browser and was measured there.
 */
const CROP = readFileSync(join(process.cwd(), 'src/components/Crop.css'), 'utf-8')

describe('the part of a picture the cropper lights up', () => {
  it('is a circle, and the shade around it is the same one element', () => {
    const frame = ruleFor(CROP, '.crop__frame', 'Crop.css')

    expect(frame.getPropertyValue('border-radius')).toBe('50%')

    /* The same declaration does both: a box shadow spreading out of a rounded box
       is a rounded hole, and an outline follows the border radius too. Written as
       four bands around a gap it would be four sets of arithmetic to keep in
       agreement, and as a second bright copy of the picture it would be two
       downloads that can fall a pixel out of register. */
    expect(frame.getPropertyValue('box-shadow')).toContain('100vmax')
    expect(frame.getPropertyValue('outline')).toContain('solid')
  })

  it('leaves the finished picture to the screens that draw it', () => {
    /* The record does not change with the shape (`components/crop.ts` keeps three
       fractions of a square, with the circle inscribed in it), and neither does
       the rule that cuts a finished picture. `.crop-fitted` is a window with
       `overflow: hidden`; whether that window is round is decided by the circle
       each screen already puts on it, which is why a team's logo and a face can
       share one rule. A radius written here as well would be the same fact in two
       homes, and the day one of them changes they disagree. */
    const fitted = ruleFor(CROP, '.crop-fitted', 'Crop.css')

    expect(fitted.getPropertyValue('overflow')).toBe('hidden')
    expect(fitted.getPropertyValue('border-radius')).toBe('')
  })
})
