import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../test/stylesheet'

/**
 * The shape of the thing a member is choosing, and the shade that says what is
 * being thrown away.
 *
 * Owner, 23.08.2026: „isečak je krug, ne kvadrat", and „Čuva se svakako cela
 * slika, a bolje se vidi samo oblik kruga jer će to da završi na profilnoj
 * slici". Owner, 12.08.2026, about the rest of the picture: „zatamnjen ali
 * dovoljno vidljiv ostatak".
 *
 * The two belong in one file because the second broke when the first changed. The
 * shade used to spread out of the frame as a shadow, which is exact while the
 * frame is a rectangle and wrong the moment it is round: a shadow's corners are
 * rounded by the radius **plus** the spread, so the corners of a tall picture
 * were left with no shade at all. Measured by a review in Chrome on a 360 by 640
 * telephone with a picture of 1080 by 2400: the undimmed remainder grew from
 * 2.323 to 8.395 pixels and the bottom of the picture came out white.
 *
 * jsdom applies no stylesheet and lays nothing out (ADL A18), so what is asked
 * here is the shape of the rules. That the corners really are dimmed is a
 * question for a browser, and it was measured in Chrome 151 headless at device
 * scale 1, over the built stylesheet, with the markup taken from this very
 * component and a white picture on a black page so the edges cannot lie.
 *
 * The numbers, so a later reading can be compared with this one rather than with
 * a sentence. Bright pixels left outside the lit disc:
 *
 * - 360 by 640, picture 1080 by 2400: **163**, and every one of them on the two
 *   pixel white outline itself, the brightest at 241 sitting on the ring;
 * - 1280 by 800 with `html { font-size: 32px }`, picture 640 by 1422: **60**, the
 *   same ring.
 *
 * Both are the antialiasing of the outline and nothing else, which is what „no
 * undimmed remainder" looks like when it is counted. The reading this replaced,
 * on the first of those two sizes, was 8.395.
 */
const CROP = readFileSync(join(process.cwd(), 'src/components/Crop.css'), 'utf-8')

describe('the part of a picture the cropper lights up', () => {
  it('is a circle', () => {
    const frame = ruleFor(CROP, '.crop__frame', 'Crop.css')

    expect(frame.getPropertyValue('border-radius')).toBe('50%')
    /* The outline follows the radius, so the line is round for the same reason
       the box is, and no second shape has to be kept in step with the first. */
    expect(frame.getPropertyValue('outline')).toContain('solid')
  })

  it('carries no shade of its own, which is what left the corners bare', () => {
    /* The exact declaration the review measured. A shadow spreading out of a
       round box is a round shadow, and a round shadow cannot cover a rectangle:
       whatever the spread, there is a picture tall enough for its corners to
       fall outside. So the frame lights the circle and shades nothing, and the
       shade is the sheet below.

       Written as an absence because that is what the fault was: the rule looked
       right, the whole suite was green, and the picture was white at the bottom. */
    const frame = ruleFor(CROP, '.crop__frame', 'Crop.css')

    expect(frame.getPropertyValue('box-shadow')).toBe('')
  })

  it('is cut out of a sheet that covers the whole picture, corners and all', () => {
    /* A sheet has no corners to miss, and `inset: 0` is what makes that true
       rather than a spread big enough to hope with. The hole is a mask, and the
       mask is written where the numbers are (`holeOf` in components/crop.ts):
       an ellipse in percentages, because the box has two different sides and a
       share of each is a circle in pixels. */
    const shade = ruleFor(CROP, '.crop__shade', 'Crop.css')

    expect(shade.getPropertyValue('inset')).toBe('0px')
    expect(shade.getPropertyValue('position')).toBe('absolute')

    /* And the other half of that same fact, which `inset: 0` alone does not
       carry: what the sheet is inset against. `position: absolute` measures from
       the nearest positioned ancestor, so the box has to be the positioned one.
       Measured by a review in Chrome: with the box back to `static`, the sheet
       went from 313 by 695 pixels, exactly the picture, to 345 by 640, the whole
       window, and the undimmed part of the picture went from 163 pixels to
       21.952 with the bottom of it white. Both readings passed every test,
       because each rule was right on its own.

       Asked here rather than beside the box, because it is this rule that needs
       it: the box would be `relative` for the frame in any case, and the day
       somebody decides it need not be, this is the case that says why it must. */
    const box = ruleFor(CROP, '.crop__picture', 'Crop.css')

    expect(box.getPropertyValue('position')).toBe('relative')
    expect(shade.getPropertyValue('background')).toBe('var(--crop-shade)')
    /* Nothing to press: a sheet over the whole picture would otherwise swallow
       every press aimed at what is underneath it. */
    expect(shade.getPropertyValue('pointer-events')).toBe('none')
  })

  it('leaves the shape of a finished picture to the screen that draws it', () => {
    /* `.crop-fitted` is a window with `overflow: hidden`, and whether that window
       is round is decided by the circle the screen already puts on it. A radius
       written here as well would be the same fact in two homes.

       One screen and not two, corrected 27.08.2026 after a review counted them:
       `crop-fitted` appears once in the whole of `src`, on a team's logo
       (`TeamMark.tsx`). No record of a member carries a picture yet, so a face is
       drawn from initials and colour and no cropped photograph of one is drawn
       anywhere. The rule is written for both because both will use it, and the
       claim that both use it today was wrong.

       That `overflow: hidden` is there at all is held by `styles/circle.test.ts`,
       which is the file about round things; asked here as well it would be the
       same fact in two homes, which is the very thing this case is about. */
    const fitted = ruleFor(CROP, '.crop-fitted', 'Crop.css')

    expect(fitted.getPropertyValue('border-radius')).toBe('')
  })
})
