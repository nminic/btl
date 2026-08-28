import { must } from '../test/at'
import { bigEnough, closestIn, cropIn, fittedTo, frameOf, holeOf, movedTo, sizedTo, UNKNOWN, WHOLE } from './crop'
import type { CoverStyle, Crop, Frame, Shape } from './crop'

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

/**
 * Which part of a picture a browser would actually show for the fitted style,
 * worked out from the rules rather than taken on trust.
 *
 * The square box is any size at all, so it is called 1. `object-fit: cover`
 * scales the picture until its shorter edge fills that box, which puts the
 * scale at `1 / min(width, height)`. `object-position` in percentages lines the
 * point that far along the picture up with the point that far along the box,
 * which for a picture larger than its box is that share of the room left over.
 * `transform: scale(k)` about a point `p` of the box leaves visible the stretch
 * `[p - p/k, p + (1 - p)/k]` of it, because scaling about `p` maps `q` to
 * `p + k(q - p)`.
 *
 * The answer comes back in percentages of the picture, which is what the bright
 * window is drawn in, so the two can be compared without either being told
 * about the other.
 */
function shownBy(style: CoverStyle, shape: Shape): Frame {
  const along = style.objectPosition.split(' ').map(share)
  /* The point the magnification turns about, read rather than assumed. The
     first version of this took it from `object-position`, on the grounds that
     the source writes the two the same, which is precisely what the source has
     to be checked on: a review replaced the origin with the middle of the box
     and this test did not notice. Read here, the two agreeing is something the
     arithmetic depends on rather than something it takes for granted. */
  const origin = style.transformOrigin.split(' ').map(share)
  const magnified = Number(must(/scale\(([\d.]+)\)/.exec(style.transform), 'the magnification')[1])
  /* A square box of side one, because the answer is a percentage and the size
     of the box cancels out of it. `cover` then scales the picture until its
     shorter edge is one. */
  const cover = 1 / Math.min(shape.width, shape.height)

  const seen = (share: number, about: number, edge: number) => {
    /* How long that edge is once the picture has been scaled to cover the box.
       One of the two is exactly 1; the other is longer, and the difference is
       the room the picture has to slide in. */
    const drawn = edge * cover
    // What the magnification leaves visible, in those same lengths.
    const window = 1 / magnified
    /* Where the picture sits before anything is magnified: that share of the
       room left over, which is what `object-position` in percentages means. */
    const slid = share * (drawn - 1)

    return {
      /* And then where the magnification leaves the box looking. Scaling about
         a point `p` of the box maps `q` to `p + k(q - p)`, so what survives
         inside the box starts `p - p / k` along it, which is `about * (1 - 1/k)`
         written with the window rather than the scale. */
      from: (100 * (slid + about * (1 - window))) / drawn,
      size: (100 * window) / drawn,
    }
  }

  const across = seen(
    must(along[0], 'the horizontal share'),
    must(origin[0], 'the horizontal origin'),
    shape.width,
  )
  const down = seen(
    must(along[1], 'the vertical share'),
    must(origin[1], 'the vertical origin'),
    shape.height,
  )

  return {
    left: `${round(across.from)}%`,
    top: `${round(down.from)}%`,
    width: `${round(across.size)}%`,
    height: `${round(down.size)}%`,
  }
}

/** A frame in pixels of the picture it is drawn over, which is the one unit in
 *  which „the same square" means anything to a reader. */
function inPixels(frame: Frame, shape: Shape) {
  return {
    left: (share(frame.left) * shape.width),
    top: (share(frame.top) * shape.height),
    width: (share(frame.width) * shape.width),
    height: (share(frame.height) * shape.height),
  }
}

/** „42%" as 0.42, which is how `object-position` and `transform-origin` are
 *  written and how a crop is held. */
function share(said: string): number {
  return Number(said.replace('%', '')) / 100
}

/** The same four places the source rounds to, so two numbers that agree in
 *  every way anybody can see are not separated by binary. */
function round(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

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

  it.each([
    { x: 0.5, y: 0.5, size: 1 },
    { x: 1, y: 0.5, size: 0.5 },
    { x: 0, y: 1, size: 0.2 },
    { x: 0.8, y: 0.2, size: 0.45 },
    { x: 0.25, y: 0.35, size: 0.72 },
  ])('shows the same part of the picture drawn either way ($x, $y, $size)', (crop: Crop) => {
    /* The one thing worth proving properly, because two unrelated pieces of CSS
       draw the same three numbers and neither can see the other. If they
       disagree, a member cuts one thing and the portal shows another, and this
       is the only place it can be caught: the bright window is measured in
       percentages of the picture, and the circle is measured in nothing at all.

       An earlier version of this test asserted three numbers side by side and
       said in prose that they agreed, which is not the same claim. This one
       works out what the browser would actually show for the fitted style,
       from the rules of `object-fit`, `object-position` and `transform`, and
       compares that against the window. */
    for (const shape of [landscape, portrait, { width: 500, height: 500 }]) {
      const fitted = inPixels(shownBy(fittedTo(crop), shape), shape)
      const window = inPixels(frameOf(crop, shape), shape)

      /* Compared in pixels of the picture and to a hundredth of one, which is
         the honest claim rather than an exact one. The fitted style hands the
         browser a magnification rounded to four places, because
         `scale(3.3333333333333335)` reads as a fault to everybody who opens the
         inspector, and that rounding is worth about two thousandths of a pixel
         on a photograph eight hundred across. Written as an exact equality this
         test would fail on a third of the crops a slider can produce, and the
         first person to see it would loosen the arithmetic rather than the
         assertion. */
      expect(fitted.left).toBeCloseTo(window.left, 2)
      expect(fitted.top).toBeCloseTo(window.top, 2)
      expect(fitted.width).toBeCloseTo(window.width, 2)
      expect(fitted.height).toBeCloseTo(window.height, 2)
    }
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
    /* A record is read for its shape and not for how close it crops: what the
       smallest circle is depends on the picture, and a record does not carry one
       (`closestIn`). Nought is still not a fraction of anything, so it is refused
       here as everything outside 0 to 1 is.

       It used to be refused below a flat 0,2, and that number is gone: the
       boundary is measured in pixels since 27.08.2026, and a store cannot check
       it without the picture in front of it. Held instead where the picture is,
       which is the screen. */
    expect(cropIn({ x: 0.5, y: 0.5, size: 0.05 }).size).toBe(0.05)
    expect(cropIn({ x: 0.5, y: 0.5, size: 1.2 })).toEqual(WHOLE)
  })

  it('says how close a crop may be from the picture rather than from a constant', () => {
    /* Owner, 23.08.2026: „najmanji krug je onaj koji portal još prikazuje bez
       gubitka", worked out from the largest size a face is drawn at; owner,
       27.08.2026, choosing the number: „Poslušaću preporuku 240."

       The point of measuring in pixels is that the answer differs with the
       picture: a fifth of a large photograph is a portrait and a fifth of a small
       one is a handful of pixels blown up. */
    expect(closestIn({ width: 1200, height: 1600 })).toBeCloseTo(0.2, 5)
    expect(closestIn({ width: 800, height: 900 })).toBeCloseTo(0.3, 5)
    expect(closestIn({ width: 480, height: 480 })).toBeCloseTo(0.5, 5)

    /* Never above the whole picture: a file may be exactly as small as the
       boundary, and a smallest circle larger than the picture is a slider with no
       room in it. */
    expect(closestIn({ width: 240, height: 240 })).toBe(1)
  })

  it('refuses a picture too small to draw the circle without loss', () => {
    /* The other rule out of the same number, and it is a different rule: this one
       is about the file and the one above is about the circle inside a file that
       passed. The shorter edge is what a square is cut from, so it is the edge the
       boundary is about. */
    expect(bigEnough({ width: 240, height: 240 }), 'exactly the boundary is refused').toBe(true)
    expect(bigEnough({ width: 1600, height: 239 }), 'wide and short is still short').toBe(false)
    expect(bigEnough({ width: 239, height: 1600 })).toBe(false)
  })
})

describe('the hole the shade is cut with', () => {
  /* Two reviews in a row found the same thing on this screen: a new mechanism
     shipped without a guard, and every mutation of it stayed green. The second
     of them counted five, among them a hole twice the size of the circle and a
     hole that was an ellipse rather than a circle. What follows measures the
     numbers themselves, which is what the review had to open a browser to see. */

  it('is half the frame, around the middle of it', () => {
    /* The whole picture on a landscape photograph: the frame is the middle half
       of the width and all of the height, so the hole is a quarter of the width
       and half the height, centred. Half and not the whole is the part a
       mutation removed silently: doubled, the hole swallows the frame and the
       lit part stops being what the outline draws. */
    expect(holeOf(frameOf(WHOLE, landscape))).toEqual({
      x: '50%',
      y: '50%',
      across: '25%',
      down: '50%',
    })
  })

  it('gives each axis its own share, which is what makes it a circle', () => {
    /* The one form that says „circle" here. A radius written as a share of the
       box is a different number of pixels across than down, so a circle in
       pixels is an ellipse in percentages, and the two shares must not be the
       same number. Swapped, the review measured the hole on a picture of 1080 by
       2400 come out as 22,5 by 50 per cent, which is an ellipse half the height
       of the picture. */
    const hole = holeOf(frameOf(WHOLE, portrait))

    expect(hole).toEqual({ x: '50%', y: '50%', across: '50%', down: '25%' })
    expect(hole.across, 'both axes take the same share, so the hole is not a circle').not.toBe(
      hole.down,
    )
  })

  it('follows the frame into a corner rather than staying in the middle', () => {
    /* The smallest circle pushed flush against the start of both axes. The hole
       has to travel with the frame, and its middle is then its own radius in
       from each edge, which is what „flush" means for a circle. */
    const small: Crop = { x: 0, y: 0, size: 0.2 }

    expect(holeOf(frameOf(small, portrait))).toEqual({
      x: '10%',
      y: '5%',
      across: '10%',
      down: '5%',
    })
  })

  it('sits in the middle of a picture nothing is known about yet', () => {
    /* A photograph arrives after the first drawing, and until it does the shape
       is a square of side one. The hole is then exactly the three fractions
       themselves, and drawing it wrong here is drawing it wrong on every first
       frame of every picture. */
    expect(holeOf(frameOf(WHOLE, UNKNOWN))).toEqual({
      x: '50%',
      y: '50%',
      across: '50%',
      down: '50%',
    })
  })
})

describe('moving the circle with a finger or a mouse', () => {
  it('centres it on the spot being pointed at', () => {
    /* Owner, 23.08.2026: „krug se pomera prstom na telefonu i tabletu, mišem na
       velikom ekranu". A square picture and a circle of half its width: pointing
       at the very middle leaves it in the middle, and pointing a quarter of the
       way in puts it flush against the start, because a circle of half the width
       has exactly half the width to travel in. */
    const half: Crop = { x: 0.5, y: 0.5, size: 0.5 }
    const square = { width: 1000, height: 1000 }

    expect(movedTo(half, square, { across: 0.5, down: 0.5 })).toEqual(half)
    expect(movedTo(half, square, { across: 0.25, down: 0.25 })).toEqual({ ...half, x: 0, y: 0 })
    expect(movedTo(half, square, { across: 0.75, down: 0.75 })).toEqual({ ...half, x: 1, y: 1 })
  })

  it('stops at the edge rather than letting the circle hang over it', () => {
    /* Owner, same day: „krug nikad ne izlazi van ivice slike", so a cut can never
       have an empty corner. Pointed well past both edges, and past both the other
       way. */
    const half: Crop = { x: 0.5, y: 0.5, size: 0.5 }
    const square = { width: 1000, height: 1000 }

    expect(movedTo(half, square, { across: 5, down: 5 })).toEqual({ ...half, x: 1, y: 1 })
    expect(movedTo(half, square, { across: -5, down: -5 })).toEqual({ ...half, x: 0, y: 0 })
  })

  it('leaves an axis alone where the circle fills it', () => {
    /* At the largest size a tall picture has no room across at all, so pointing
       sideways cannot move the circle and must not divide by that nought either:
       written carelessly this is where `NaN` gets into a style. */
    const tall = { width: 400, height: 1000 }
    const moved = movedTo(WHOLE, tall, { across: 0.9, down: 0.1 })

    expect(moved.x, 'a circle as wide as the picture moved sideways').toBe(WHOLE.x)
    expect(Number.isNaN(moved.x)).toBe(false)
    expect(moved.y).toBeLessThan(WHOLE.y)

    /* And the same the other way round, because the two axes are two branches:
       on a wide picture the circle fills the height instead. */
    const wide = { width: 1000, height: 400 }
    const sideways = movedTo(WHOLE, wide, { across: 0.1, down: 0.9 })

    expect(sideways.y, 'a circle as tall as the picture moved up and down').toBe(WHOLE.y)
    expect(Number.isNaN(sideways.y)).toBe(false)
    expect(sideways.x).toBeLessThan(WHOLE.x)
  })
})

describe('growing and shrinking the circle by its edge', () => {
  it('reaches the spot being dragged', () => {
    /* Owner, 23.08.2026: „povlačenjem ivice krug se širi ili sužava". A circle in
       the middle of a square picture, dragged to a quarter of the way in: the
       distance from the middle is a quarter of the edge, so the circle is half of
       it across. */
    const middle: Crop = { x: 0.5, y: 0.5, size: 0.4 }
    const square = { width: 1000, height: 1000 }

    expect(sizedTo(middle, square, { across: 0.25, down: 0.5 }, 0.1).size).toBeCloseTo(0.5, 5)
    expect(sizedTo(middle, square, { across: 0.5, down: 0.9 }, 0.1).size).toBeCloseTo(0.8, 5)
  })

  it('will not shrink below what the picture can still draw', () => {
    /* Owner, same day: „ispod nje se krug prosto ne da smanjiti, bez ijedne
       poruke o tome zašto". A floor and not a refusal, so nothing is said and the
       circle simply stops. */
    const middle: Crop = { x: 0.5, y: 0.5, size: 0.4 }
    const square = { width: 1000, height: 1000 }
    const least = closestIn(square)

    expect(least).toBeCloseTo(0.24, 5)
    expect(sizedTo(middle, square, { across: 0.5, down: 0.5 }, least).size).toBeCloseTo(least, 5)
    expect(sizedTo(middle, square, { across: 0.49, down: 0.5 }, least).size).toBeCloseTo(least, 5)
  })

  it('will not grow past the whole picture', () => {
    /* The other end of the same rule: growing past the edge would put back the
       empty corner that moving is careful never to make. */
    const middle: Crop = { x: 0.5, y: 0.5, size: 0.4 }
    const square = { width: 1000, height: 1000 }

    expect(sizedTo(middle, square, { across: 5, down: 5 }, 0.1).size).toBe(1)
  })

  it('measures both directions in the same units, or a circle is an ellipse', () => {
    /* A share of a wide picture is a different number of pixels across than down.
       On a picture twice as wide as it is tall, the same share sideways is twice
       the distance, and the size that comes out has to say so. */
    const middle: Crop = { x: 0.5, y: 0.5, size: 0.4 }
    const wide = { width: 1000, height: 500 }

    const across = sizedTo(middle, wide, { across: 0.6, down: 0.5 }, 0.1).size
    const down = sizedTo(middle, wide, { across: 0.5, down: 0.6 }, 0.1).size

    expect(across).toBeCloseTo(0.4, 5)
    expect(down).toBeCloseTo(0.2, 5)
    expect(across, 'both directions came out the same, so the circle is an ellipse').not.toBe(down)
  })
})

describe('the middle of the circle while it is being resized', () => {
  /** Where the middle of a crop sits over the picture, as a share of each edge. */
  const middleOf = (crop: Crop, shape: Shape) => {
    const side = crop.size * Math.min(shape.width, shape.height)
    const across = side / shape.width
    const down = side / shape.height

    return {
      across: crop.x * (1 - across) + across / 2,
      down: crop.y * (1 - down) + down / 2,
    }
  }

  it('stands still, whether the circle grows or shrinks', () => {
    /* Owner, 27.08.2026: „Kad razvlačim deo kruga, treba da centralna pozicija
       bude nepokretna, a da se kružnica širi i skuplja."

       This is not what leaving `x` and `y` alone does. They are shares of the room
       left over rather than the middle itself, so a circle that changes size while
       they stand still slides across the picture: measured on a square picture
       with the circle a quarter of the way in, growing from 0,3 to 0,6 moved the
       middle by a tenth of the whole width. */
    const off: Crop = { x: 0.25, y: 0.75, size: 0.3 }
    const square = { width: 1000, height: 1000 }
    const was = middleOf(off, square)

    for (const spot of [
      { across: was.across + 0.05, down: was.down },
      { across: was.across + 0.2, down: was.down },
      { across: was.across + 0.001, down: was.down },
    ]) {
      const now = middleOf(sizedTo(off, square, spot, closestIn(square)), square)

      expect(now.across).toBeCloseTo(was.across, 5)
      expect(now.down).toBeCloseTo(was.down, 5)
    }
  })

  it('stops growing where the circle meets the nearest edge', () => {
    /* „Širi se dok ne udari u neku od ivica slike" (owner, same day). The middle
       here sits three tenths of the way down, so there is three tenths of the
       height above it and the circle may be six tenths across and no more,
       whatever the pointer says.

       Three tenths and not a quarter, and the difference is the point of this
       whole case: `y` is 0,25 but it is a share of the room left over, not the
       middle. Written the first time against 0,25 this case failed, which is
       exactly the confusion the code stopped making. */
    const high: Crop = { x: 0.5, y: 0.25, size: 0.2 }
    const square = { width: 1000, height: 1000 }
    const was = middleOf(high, square)
    const grown = sizedTo(high, square, { across: 5, down: 5 }, closestIn(square))
    const now = middleOf(grown, square)

    expect(was.down).toBeCloseTo(0.3, 5)
    expect(grown.size).toBeCloseTo(0.6, 5)
    expect(now.down, 'the middle moved to make room').toBeCloseTo(0.3, 5)
    /* And it really is touching that edge rather than stopping short of it. */
    expect(now.down - grown.size / 2).toBeCloseTo(0, 5)
  })

  it('stops shrinking at the smallest circle the picture allows', () => {
    /* „Skuplja dok ne udari o minimum koji je potreban za dobar prikaz po
       portalu" (owner, same day), which is `closestIn` and depends on the file. */
    const middle: Crop = { x: 0.5, y: 0.5, size: 0.6 }
    const small = { width: 480, height: 480 }
    const least = closestIn(small)

    expect(least).toBeCloseTo(0.5, 5)
    expect(sizedTo(middle, small, { across: 0.5, down: 0.5 }, least).size).toBeCloseTo(least, 5)
  })
})
