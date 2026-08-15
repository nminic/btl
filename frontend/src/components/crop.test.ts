import { CLOSEST, cropIn, fittedTo, frameOf, UNKNOWN, WHOLE } from './crop'
import type { Crop } from './crop'

/* Which square of a picture is the picture.
 *
 * Everything here is arithmetic over three fractions, and it is worth its own
 * file for one reason: the same three numbers are drawn twice, once as a bright
 * window over the whole photograph and once as the finished circle, by two
 * quite different means. If the two disagree, a member crops one thing and the
 * portal shows another, and the only place that can be caught is here.
 */

const landscape = { width: 800, height: 400 }
const portrait = { width: 400, height: 800 }

describe('the largest square, before anybody moves anything', () => {
  it('is as wide as the shorter edge, whichever edge that is', () => {
    /* A square, in a picture twice as wide as it is tall, is half its width and
       all of its height. The number that decides is the shorter edge and not
       the width, which is the whole of the difference between these two lines:
       written against the width, a tall photograph would be cropped to a
       letterbox. */
    expect(frameOf(WHOLE, landscape)).toEqual({
      left: '25%',
      top: '0%',
      width: '50%',
      height: '100%',
    })
    expect(frameOf(WHOLE, portrait)).toEqual({
      left: '0%',
      top: '25%',
      width: '100%',
      height: '50%',
    })
  })

  it('sits in the middle of the room it does not fill', () => {
    /* Half of what is left over, which for a picture twice as wide is a quarter
       of it on each side. The alternative is flush against the start, and a
       photograph of a person aimed at the middle would then be cropped to
       whatever happens to be on the left of it. */
    expect(WHOLE).toEqual({ x: 0.5, y: 0.5, size: 1 })
  })

  it('leaves a square picture nothing to move, and says so in both axes', () => {
    /* No room left over means the two position numbers change nothing, which is
       correct rather than broken: there is one largest square in a square
       picture. Worth pinning, because it is the case where the sliders a member
       drags do nothing, and the first instinct on seeing that is to „fix" the
       arithmetic. */
    const square = { width: 500, height: 500 }

    expect(frameOf({ x: 0, y: 0, size: 1 }, square)).toEqual(frameOf({ x: 1, y: 1, size: 1 }, square))
  })
})

describe('a square moved and cut down', () => {
  it('runs from flush at one end to flush at the other', () => {
    /* The two ends of every slider, and the reason the position is held as a
       share of the room left over rather than as a distance. At 0 the square
       starts at the edge; at 1 it ends at it, which is `left + width` coming to
       exactly 100%. Nothing has to be clamped for either to be true. */
    const half: Crop = { x: 0, y: 0, size: 0.5 }

    expect(frameOf(half, landscape)).toEqual({
      left: '0%',
      top: '0%',
      width: '25%',
      height: '50%',
    })
    expect(frameOf({ ...half, x: 1, y: 1 }, landscape)).toEqual({
      left: '75%',
      top: '50%',
      width: '25%',
      height: '50%',
    })
  })

  it('stays square as it shrinks, in a picture of any shape', () => {
    /* Half the shorter edge is 200 pixels in both of these, which is a quarter
       of the width and half the height of one, and the reverse of the other.
       Two percentages that differ are the same square. */
    const wide = frameOf({ x: 0.5, y: 0.5, size: 0.5 }, landscape)
    const tall = frameOf({ x: 0.5, y: 0.5, size: 0.5 }, portrait)

    expect([wide.width, wide.height]).toEqual(['25%', '50%'])
    expect([tall.width, tall.height]).toEqual(['50%', '25%'])
  })

  it('draws over a picture nothing is known about as though it were square', () => {
    /* What the review view uses before the browser has the file, and after it
       fails to read one. A width of nought divides into `NaN%`, which a style
       drops, so the frame would sit at its default size over a picture that is
       not there and then jump when the file arrived. A square of side 1 puts
       the three fractions on screen as themselves. */
    expect(frameOf({ x: 0.25, y: 0.75, size: 0.4 }, UNKNOWN)).toEqual({
      left: '15%',
      top: '45%',
      width: '40%',
      height: '40%',
    })
  })
})

describe('the same square, drawn by the browser as a finished picture', () => {
  it('magnifies by the reciprocal, about the point the position pins down', () => {
    /* `cover` is this crop at its largest, so the zoom is what is left to say,
       and the origin is what makes the two ways of drawing agree. Scaled about
       the middle instead, a square flush against the left edge would slide off
       it as the member zoomed: the bright window would say one thing and the
       circle another. */
    expect(fittedTo({ x: 0, y: 1, size: 0.5 })).toEqual({
      objectPosition: '0% 100%',
      transform: 'scale(2)',
      transformOrigin: '0% 100%',
    })
  })

  it('leaves the largest square exactly as the browser would fit it', () => {
    /* A scale of one and no shift at all. This is what says the two drawings
       start from the same place: `cover` on a square box is this crop at size
       1, and anything else here would mean every uncropped picture on the
       portal is already nudged. */
    expect(fittedTo(WHOLE)).toEqual({
      objectPosition: '50% 50%',
      transform: 'scale(1)',
      transformOrigin: '50% 50%',
    })
  })

  it('hands the browser a number short enough to read', () => {
    /* Every one of these is a product of fractions a slider handed over, and in
       binary a third of one is 3.3333333333333335. Written out whole it draws
       correctly and reads as a fault to everybody who opens the inspector. Four
       places is a hundredth of a pixel on a photograph a thousand across. */
    expect(fittedTo({ x: 0.3, y: 0.7, size: 0.3 })).toEqual({
      objectPosition: '30% 70%',
      transform: 'scale(3.3333)',
      transformOrigin: '30% 70%',
    })
  })

  it('agrees with the bright window about which part of the picture shows', () => {
    /* The one thing worth proving twice, because two unrelated pieces of CSS
       draw the same three numbers. Read off the frame, a crop of 0.5 flush
       right on a wide picture starts three quarters of the way across; read off
       the fitted style, it magnifies by two about the right edge, which shows
       the last half of a covered square, and a covered square on that picture
       is its middle half. Both come to the same 200 pixels ending at 800. */
    const flush: Crop = { x: 1, y: 0.5, size: 0.5 }
    const frame = frameOf(flush, landscape)

    expect(frame.left).toBe('75%')
    expect(frame.width).toBe('25%')
    expect(fittedTo(flush).transformOrigin).toBe('100% 50%')
  })
})

describe('a crop read out of a record', () => {
  it('takes what is written, when what is written is a crop', () => {
    expect(cropIn({ x: 0.25, y: 0.5, size: 0.6 })).toEqual({ x: 0.25, y: 0.5, size: 0.6 })
  })

  it('falls back to the whole picture rather than to a square nobody chose', () => {
    /* Records outlive the screen that wrote them: seeded teams carry no crop,
       and F5 hands back whatever it was given. A size of 4 is not a request for
       the largest square, it is a record nobody understands, and cropping to
       something the member never picked is worse than showing what they
       uploaded. `NaN` is here because it is what arithmetic on a missing field
       produces, and it fails both comparisons on its own. */
    const wrong = [
      undefined,
      null,
      'x=1',
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5, size: 4 },
      { x: 0.5, y: 0.5, size: 0 },
      { x: -1, y: 0.5, size: 0.5 },
      { x: 0.5, y: 2, size: 0.5 },
      { x: Number.NaN, y: 0.5, size: 0.5 },
      { x: '0.5', y: 0.5, size: 0.5 },
    ]

    expect(wrong.map(cropIn)).toEqual(wrong.map(() => WHOLE))
  })

  it('keeps the closest crop a member is allowed to make', () => {
    /* The limit is a limit and not a suggestion: exactly `CLOSEST` is a crop a
       slider can produce and has to survive the trip through a record, and a
       hair below it is not. */
    expect(cropIn({ x: 0.5, y: 0.5, size: CLOSEST }).size).toBe(CLOSEST)
    expect(cropIn({ x: 0.5, y: 0.5, size: CLOSEST - 0.01 })).toEqual(WHOLE)
  })
})
