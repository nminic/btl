import type { Crop } from '../data/types'

export type { Crop }

/**
 * Which square of a picture is the picture, held as three numbers.
 *
 * The type itself is in data/types.ts, where the records that carry it are.
 * What the three numbers mean is here, with the arithmetic that reads them.
 *
 * Owner, 12.08.2026: „Mogućnost kropovanja željene slike unutar sajta - odnosi
 * se samo na profilne slike i timske slike. Korisnik treba da može da sačuva
 * kropovan format ali da se nazire ispod u njegovim podešavanjima i ono što se
 * neće videti."
 *
 * Three fractions rather than four pixel edges, and the reason is that a
 * fraction cannot fall off the picture. Pixels have to be clamped against a
 * width nobody has yet: the file is chosen in one browser, cropped in another
 * and looked at by a moderator in a third, and a rectangle written in pixels is
 * wrong in all but the first the moment anybody resizes anything. Every number
 * here means the same thing at every size.
 *
 * `size` is the side of the square as a fraction of the picture's shorter edge,
 * so 1 is the largest square that fits and every value is possible on a
 * photograph of any shape.
 *
 * `x` and `y` are where that square sits along whatever room is left over: 0 is
 * flush against the start, 1 against the end, 0.5 in the middle. Room left over
 * and not a distance from the edge, because at `size` 1 there is no room in one
 * axis at all, and a distance would then have to be checked against a limit
 * that changes with the zoom. Written this way the limit is always 0 and 1 and
 * there is nothing to clamp.
 */

/**
 * The whole picture, as far as a square can hold it: the largest square there
 * is, in the middle of what it cannot cover.
 *
 * What every picture starts as and what everything with no crop of its own
 * means. Centred rather than flush, because a photograph of a person is aimed
 * at the middle by whoever took it, and because at this size the two position
 * numbers do nothing at all on a square picture: a member who never touches a
 * slider gets the middle of their photograph either way.
 */
export const WHOLE: Crop = { x: 0.5, y: 0.5, size: 1 }

/**
 * The smallest circle the portal can still draw without loss, in real pixels.
 *
 * Owner, 23.08.2026: „najmanji krug je onaj koji portal još prikazuje bez
 * gubitka", and that boundary is to be worked out from the largest size the
 * picture is drawn at anywhere. Owner, 27.08.2026, choosing between three
 * measured candidates: „Poslušaću preporuku 240."
 *
 * Where 240 comes from: a face is drawn in three sizes, `2,9rem` in tables,
 * `4rem` on the front page and `clamp(3,25rem, 9vw, 5rem)` on a profile. The
 * largest is 5rem, which is 80 CSS pixels at the ordinary text size, and 240 is
 * that on a screen of three device pixels to one. The two candidates either side
 * were 160, which covers an ordinary retina screen, and 480, which would also
 * cover a reader at 200 per cent text and would halve how closely anybody could
 * crop.
 *
 * Two rules come out of this one number, and they are not the same rule: a file
 * whose shorter edge is under it is refused outright, and a circle may not be
 * drawn smaller than it inside a file that passed.
 */
export const SMALLEST_PIXELS = 240

/**
 * The smallest circle allowed in a picture of this shape, as a fraction.
 *
 * A fraction of the shorter edge, which is what `size` means, so a photograph of
 * 1200 pixels allows 0,20 and one of 480 allows 0,50: the closer a member may
 * crop depends on what they handed over, which is the whole point of measuring in
 * pixels rather than in fractions.
 *
 * It was a flat 0,2 until 27.08.2026, and that number said nothing about loss: a
 * fifth of a large photograph is a portrait and a fifth of a small one is a
 * handful of pixels blown up.
 *
 * Never above 1, because a picture may be exactly as small as the boundary, and a
 * smallest circle larger than the whole picture is a slider with no room in it.
 */
export function closestIn(shape: Shape): number {
  return Math.min(1, SMALLEST_PIXELS / Math.min(shape.width, shape.height))
}

/** What a picture must be to be taken at all: the shorter edge is what a square
 *  is cut from, so it is the edge the boundary is about. */
export function bigEnough(shape: Shape): boolean {
  return Math.min(shape.width, shape.height) >= SMALLEST_PIXELS
}

/** How wide and how tall the picture actually is. Nought until the browser has
 *  the file, which is why `frameOf` treats it as a square: a frame drawn over
 *  nothing is a frame over a box of no size, and dividing by that width is what
 *  puts `NaN%` into the style. */
export type Shape = { width: number; height: number }

/** A shape a picture takes before anything is known about it: square, so the
 *  three fractions mean exactly themselves. */
export const UNKNOWN: Shape = { width: 1, height: 1 }

/**
 * Where the square sits over the whole picture, in percentages of it.
 *
 * What the review view draws its bright window with, and the one place the
 * three fractions turn into two axes. The shorter edge decides the side, in
 * both axes, which is what makes the square square: a percentage of a wide
 * picture is a different number of pixels across than down.
 */
export function frameOf(crop: Crop, shape: Shape): Frame {
  const shorter = Math.min(shape.width, shape.height)
  const side = crop.size * shorter

  return {
    left: share(crop.x * (shape.width - side), shape.width),
    top: share(crop.y * (shape.height - side), shape.height),
    width: share(side, shape.width),
    height: share(side, shape.height),
  }
}

export type Frame = { left: string; top: string; width: string; height: string }

/** A place inside the drawn picture, as a share of it in each direction: 0 is the
 *  start of that edge and 1 the end. Shares and not pixels for the same reason a
 *  crop is shares (see the head of this file). */
export type Spot = { across: number; down: number }

/** How much of each edge the square takes up in the drawn box, which is not the
 *  same number in the two directions unless the picture is square. */
function sides(crop: Crop, shape: Shape): { across: number; down: number } {
  const side = crop.size * Math.min(shape.width, shape.height)

  return { across: side / shape.width, down: side / shape.height }
}

/** A number pushed back between two others. */
function held(value: number, least: number, most: number): number {
  return Math.min(most, Math.max(least, value))
}

/**
 * How far out a press has to land to be about the rim rather than about the
 * circle, as a share of the circle's own radius.
 *
 * A band and not a line, because a finger is not a pixel, and a share and not a
 * length, so a small circle keeps a rim somebody can actually hit.
 *
 * Three quarters, written by hand and measured: a review moved it to a half and
 * nothing noticed, and at a half a member who takes hold of the circle a little
 * inside its rim to shift it resizes it instead, on every press between the two.
 *
 * Held from both sides and a hundredth of a radius from the number, because
 * anything wider held almost nothing: a review on 29.08.2026 moved this to 0,74,
 * to 0,65 and to 0,79 with the whole suite green, and only 0,89 broke a case.
 * `crop.test.ts` („puts the band at three quarters of the radius and nowhere
 * else") holds the arithmetic, and `cropChooser.test.tsx` („the band that tells a
 * move from a resize") presses at the same two spots on a real screen, so a
 * second copy of this comparison written into `CropWindow.tsx` and moved on its
 * own is a press that does the opposite of what the pointer promised.
 */
const EDGE_BAND = 0.75

/** What a press at a spot would do, and the cursor that says so before it
 *  happens. */
export type Aim = { doing: 'moving' | 'sizing'; cursor: string }

/**
 * What the picture would do if it were pressed here.
 *
 * Owner, 29.08.2026: „Kad je miš unutar kruga, pointer se pretvara u ruku i
 * klikom i vučenjem se taj krug pomera po slici", and „Kad je miš na samoj ivici
 * kruga, pointer se pretvara u strelice za razvlačenje."
 *
 * **One function and not two, deliberately.** The press already had to decide
 * this, and the cursor is that same decision said out loud a moment earlier.
 * Written twice, the two would drift, and a cursor promising „razvuci me" over a
 * spot that moves the circle is worse than no cursor at all: it is the portal
 * lying about what a press will do. One fact, one home (ADL A31).
 *
 * Everything outside the circle is the rim as well, and truthfully so: a press
 * out there drags the edge of the circle out to meet the pointer, which is a
 * resize whatever it looks like.
 *
 * The direction is measured **in radii of the circle** rather than in shares of
 * the picture. A photograph is not square, so the circle is an ellipse once it
 * is written in shares of each edge; dividing by the radius in each direction
 * puts it back into a circle, and only then does the angle agree with what the
 * eye sees. Left out, a tall photograph would show the sideways arrows over a
 * spot the eye reads as a corner.
 */
export function aimAt(hole: Hole, spot: Spot): Aim {
  /* The pointer's place, counted from the middle of the circle outwards, with
     one radius as the unit in each direction. */
  const out = {
    across: (spot.across - percent(hole.x) / 100) / (percent(hole.across) / 100),
    down: (spot.down - percent(hole.y) / 100) / (percent(hole.down) / 100),
  }

  return Math.hypot(out.across, out.down) > EDGE_BAND
    ? { doing: 'sizing', cursor: pulling(out) }
    : /* An open hand: the circle is a thing to pick up, and the closed hand is
         for while it is being carried (`CropWindow.tsx`). `grab` and not `move`,
         because the picture does not move, the circle over it does. */
      { doing: 'moving', cursor: 'grab' }
}

/**
 * Which pair of arrows the rim wears at this direction.
 *
 * Eight eighths of a turn and four cursors, because an arrow and the arrow
 * opposite it are one picture: the pointer at the left of the circle and the
 * pointer at the right of it both pull sideways, and `ew-resize` is what both
 * of them look like. So the eighth is taken modulo four, twice over, because an
 * eighth above the middle of the picture is a negative number and the remainder
 * of a negative number is negative in this language.
 *
 * Rounded rather than floored, so each cursor covers a quarter turn **centred**
 * on its own direction: due east is the middle of the sideways arrows and not
 * the boundary between two of them.
 *
 * The arrows point along the line through the middle of the circle rather than
 * along the rim, which is why the south-east of the circle wears the north-west
 * to south-east diagonal.
 */
function pulling(out: { across: number; down: number }): string {
  const eighth = Math.round(Math.atan2(out.down, out.across) / (Math.PI / 4))
  const quarter = ((eighth % 4) + 4) % 4

  if (quarter === 0) {
    return 'ew-resize'
  }

  if (quarter === 1) {
    return 'nwse-resize'
  }

  if (quarter === 2) {
    return 'ns-resize'
  }

  return 'nesw-resize'
}

/**
 * The same crop with its circle centred on a spot somebody is pointing at.
 *
 * Owner, 23.08.2026: „krug se pomera prstom na telefonu i tabletu, mišem na
 * velikom ekranu, i time se bira drugi deo slike", and „krug nikad ne izlazi van
 * ivice slike": moving stops at the edge, so a cut can never have an empty
 * corner.
 *
 * The centre follows the pointer rather than the pointer carrying the circle by
 * a remembered offset. A remembered offset has to be taken at the moment of the
 * press and kept correct through every resize and every re-render, and gets it
 * wrong exactly once, on the first press after something else moved.
 *
 * Nothing to clamp against but 0 and 1, because `x` and `y` are shares of the
 * room left over rather than distances from an edge (see the head of this file).
 * At a size of 1 there is no room in one axis and the division would be by
 * nought, so that axis simply keeps what it had: a circle as wide as the picture
 * has nowhere to go sideways.
 */
export function movedTo(crop: Crop, shape: Shape, spot: Spot): Crop {
  const { across, down } = sides(crop, shape)

  return {
    ...crop,
    x: across >= 1 ? crop.x : held((spot.across - across / 2) / (1 - across), 0, 1),
    y: down >= 1 ? crop.y : held((spot.down - down / 2) / (1 - down), 0, 1),
  }
}

/**
 * The same crop grown or shrunk so its edge reaches the spot being dragged.
 *
 * Owner, 23.08.2026: „povlačenjem ivice krug se širi ili sužava", and „ispod nje
 * se krug prosto ne da smanjiti, bez ijedne poruke o tome zašto". So the floor is
 * a floor and not a refusal: the circle stops and nothing is said, because a
 * message about a limit reached by dragging is a message nobody asked for.
 *
 * Measured from the middle of the circle to the spot, in the shorter edge's own
 * units, because that is what `size` is a share of. The two directions are
 * measured in the same units for the same reason: a share of a wide picture is a
 * different number of pixels across than down, and a circle drawn from two
 * different units is an ellipse.
 *
 * Kept inside the picture as well as above the floor. Growing past the edge would
 * put the empty corner back that moving is careful not to make, so the ceiling is
 * whatever still fits where the circle now sits.
 */
export function sizedTo(crop: Crop, shape: Shape, spot: Spot, least: number): Crop {
  const shorter = Math.min(shape.width, shape.height)
  const { across, down } = sides(crop, shape)
  /* Where the middle of the circle is now, as a share of each edge. It stays
     exactly there: owner, 27.08.2026, „Kad razvlačim deo kruga, treba da centralna
     pozicija bude nepokretna, a da se kružnica širi i skuplja."

     That has to be worked out and put back, because `x` and `y` are not the middle:
     they are shares of the room left over (see the head of this file), so leaving
     them alone while the size changes slides the middle across the picture. */
  const middleAcross = crop.x * (1 - across) + across / 2
  const middleDown = crop.y * (1 - down) + down / 2
  /* The pointer's distance from that middle, both in units of the shorter edge,
     because that is what `size` is a share of and because a circle measured in two
     different units is an ellipse. */
  const reachAcross = Math.abs(spot.across - middleAcross) * (shape.width / shorter)
  const reachDown = Math.abs(spot.down - middleDown) * (shape.height / shorter)
  const wanted = 2 * Math.max(reachAcross, reachDown)
  /* How far it may grow before it touches an edge, with the middle standing
     still: „Širi se dok ne udari u neku od ivica slike" (owner, same day). The
     nearest edge in each direction decides, and both are measured in the shorter
     edge's units like everything else here. */
  const roomAcross = Math.min(middleAcross, 1 - middleAcross) * (shape.width / shorter)
  const roomDown = Math.min(middleDown, 1 - middleDown) * (shape.height / shorter)
  const most = Math.min(1, 2 * Math.min(roomAcross, roomDown))
  /* And how far it may shrink: „skuplja dok ne udari o minimum koji je potreban za
     dobar prikaz po portalu". A floor and not a refusal, so nothing is said and
     the circle simply stops. Held under the ceiling as well, for a picture so
     small that the smallest circle is already larger than the room. */
  const size = held(wanted, Math.min(held(least, 0, 1), most), most)
  const grown = { across: (size * shorter) / shape.width, down: (size * shorter) / shape.height }

  return {
    size,
    /* The middle put back where it was, read out of the new size. Where the
       circle now fills an axis there is no room in it and no choice to make, so
       the share is the one value that means „nowhere to go". */
    x: grown.across >= 1 ? 0.5 : held((middleAcross - grown.across / 2) / (1 - grown.across), 0, 1),
    y: grown.down >= 1 ? 0.5 : held((middleDown - grown.down / 2) / (1 - grown.down), 0, 1),
  }
}

/**
 * What a drag has done to the circle so far, measured from where it began.
 *
 * **The press itself changes nothing.** Owner, 29.08.2026: „Kad kliknem da
 * resize-ujem krug... tim klikom se prvo krug malo resize-uje na neku vrednost sam
 * od sebe, pa onda mogu da ja to radim manualno... krug ne mrdne dok ja ne počnem
 * da ga resizeujem." Until this, the press was sent straight to `movedTo` or
 * `sizedTo`, which put the middle or the edge **at the pointer**, so pressing
 * anywhere but exactly on the middle or exactly on the rim jumped the circle
 * before the hand had moved at all.
 *
 * So a gesture is read as a difference: `from` is where the press landed, `to` is
 * where the pointer is now, and `start` is the circle as it was when the press
 * landed. A drag of nothing is a change of nothing, whatever was pressed on.
 *
 * Both roads keep the arithmetic they already had, and each of them keeps its own
 * limits: moving stops at the edges of the picture, and pulling stops at the
 * floor and the ceiling `sizedTo` works out. What changes is only what they are
 * asked for.
 */
export function draggedTo(
  start: Crop,
  shape: Shape,
  doing: 'moving' | 'sizing',
  from: Spot,
  to: Spot,
  least: number,
): Crop {
  const shorter = Math.min(shape.width, shape.height)
  const { across, down } = sides(start, shape)
  /* Where the middle stood when the press landed. Worked out rather than read,
     for the reason written in `sizedTo`: `x` and `y` are shares of the room left
     over, not the middle itself. */
  const middle = {
    across: start.x * (1 - across) + across / 2,
    down: start.y * (1 - down) + down / 2,
  }

  if (doing === 'moving') {
    /* The middle carried by as much as the pointer travelled, and `movedTo` puts
       it there and keeps it inside the picture. */
    return movedTo(start, shape, {
      across: middle.across + (to.across - from.across),
      down: middle.down + (to.down - from.down),
    })
  }

  /* How far out the pointer is, in the shorter edge's own units, which is what
     `size` is a share of. The same reading `sizedTo` takes, so the two cannot
     drift. */
  const reach = (spot: Spot) =>
    Math.max(
      Math.abs(spot.across - middle.across) * (shape.width / shorter),
      Math.abs(spot.down - middle.down) * (shape.height / shorter),
    )
  /* The diameter grown by twice what the pointer moved outwards, because the
     middle stands still and both sides of the circle answer the one hand. */
  const wanted = start.size + 2 * (reach(to) - reach(from))

  /* Asked of `sizedTo` as a spot on the way out, so the floor, the ceiling and
     the middle put back are all worked out in the one place that knows them. The
     spot is straight out along the width, so the other direction reads nought and
     the wider of the two is this one. */
  return sizedTo(
    start,
    shape,
    {
      across: middle.across + Math.max(wanted, 0) / 2 / (shape.width / shorter),
      down: middle.down,
    },
    least,
  )
}

/**
 * The same circle, written as a hole to cut out of a sheet of shade.
 *
 * The shade used to be a shadow spreading out of the frame itself, one element
 * and no arithmetic. That works while the frame is a rectangle and stops working
 * the moment it is round, because a shadow's own corners are rounded by the
 * radius **plus** the spread: a circle of radius 32 with a spread of 640 is a
 * circle of radius 672, not a square, so the corners of a tall picture fall
 * outside it and are left with no shade at all. Measured by a review on
 * 27.08.2026 in Chrome, on a 360 by 640 telephone with a picture of 1080 by
 * 2400: the unshaded remainder grew from 2.323 to 8.395 pixels, three and a half
 * times, and the bottom of the picture came out white. That is the opposite of
 * what the shade is for (owner, 12.08.2026: „zatamnjen ali dovoljno vidljiv
 * ostatak"), because a part that is not dimmed at all reads as the part that was
 * kept.
 *
 * So the shade is now a sheet over the whole picture with a hole cut in it, and
 * a sheet has no corners to miss. The hole is written as an **ellipse in
 * percentages**, which is the one form that says „circle" here: the box is the
 * picture, its two sides are different lengths, and a radius given as a share of
 * each side is a circle in pixels. A `circle` keyword cannot take a percentage
 * at all, and a length would have to be measured in a browser and kept in step
 * with a box that changes with every window.
 *
 * Half of the frame, in each direction, around the middle of it: the same three
 * numbers `frameOf` already answers with, so the lit part and the hole cannot
 * drift apart.
 */
export function holeOf(frame: Frame): Hole {
  return {
    x: middle(frame.left, frame.width),
    y: middle(frame.top, frame.height),
    across: half(frame.width),
    down: half(frame.height),
  }
}

export type Hole = { x: string; y: string; across: string; down: string }

/** The middle of a band, from where it starts and how wide it is. */
function middle(start: string, length: string): string {
  return `${round(percent(start) + percent(length) / 2)}%`
}

/** Half of a length. */
function half(length: string): string {
  return `${round(percent(length) / 2)}%`
}

/** The number out of a percentage this file wrote a moment ago. Read back rather
 *  than carried alongside, so there is one place that turns a fraction into a
 *  share and one shape for both readers to agree on. */
function percent(said: string): number {
  return Number(said.slice(0, -1))
}

/** One length against another, as a percentage a style can carry. A picture
 *  nothing is known about is a square of side 1, never a side of nought, so
 *  there is no dividing by nothing to guard against here. */
function share(length: number, whole: number): string {
  return `${round((100 * length) / whole)}%`
}

/**
 * A number short enough to put in a style.
 *
 * Three quarters of six tenths is 0.4499999999999999 in binary, and every one
 * of these numbers is a product of fractions a slider handed over. Written out
 * whole it reaches the browser as `44.99999999999999%`, which draws correctly
 * and reads as a fault to everybody who opens the inspector, including whoever
 * comes to change this next.
 *
 * Four places, which on a photograph a thousand pixels across is a hundredth of
 * a pixel: far below anything anybody can see, and far above what the arithmetic
 * loses. Fewer places would start to matter at the ends, where a square flush
 * against an edge has to stay flush.
 */
function round(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

/**
 * The same square, as the browser's own way of showing part of a picture.
 *
 * Where a crop is drawn as the finished thing rather than as a choice being
 * made, the picture fills a box and everything outside the square is simply not
 * there. That is `object-fit: cover` with two more steps, and no width or
 * height is needed for any of it.
 *
 * `cover` already scales a picture until its shorter edge fills a square box,
 * which is this crop at `size` 1. `object-position` in percentages already
 * means „line the point this far along the picture up with the point this far
 * along the box", which for a picture larger than its box is exactly „this far
 * along the room left over". So the two position numbers go in as they are.
 *
 * The zoom is the third step, and it is a scale about the very point those
 * percentages pin down: magnify about the middle instead and a crop pinned to
 * the left edge would drift off it as the member zoomed. With the origin on the
 * same point, the flush edge stays flush and the middle stays middle at every
 * size, which is the whole reason the origin is written twice here.
 */
export function fittedTo(crop: Crop): CoverStyle {
  const along = `${round(100 * crop.x)}% ${round(100 * crop.y)}%`

  return {
    objectPosition: along,
    transform: `scale(${round(1 / crop.size)})`,
    transformOrigin: along,
  }
}

export type CoverStyle = { objectPosition: string; transform: string; transformOrigin: string }

/**
 * A crop read out of a record, with anything unusable replaced by the whole
 * picture.
 *
 * Records outlive the screen that wrote them. A team seeded into the mock data
 * carries no crop, the database that arrives in F5 will hand back whatever it
 * was given, and a member number typed into an address bar reaches a record
 * nobody checked. None of those should draw a picture scaled by `NaN`, which
 * renders as no picture at all with nothing said about why.
 *
 * A value out of range is not repaired to its nearest legal one: a `size` of 4
 * is not a request for the largest square, it is a record nobody understands,
 * and quietly cropping to something the member never chose is worse than
 * showing them the photograph they uploaded.
 */
export function cropIn(value: unknown): Crop {
  /* Narrowed by asking rather than by asserting. A cast would say „this is a
     crop" about the one value on the portal nobody can vouch for, which is the
     rule in ADL A14 and the reason there is no `as` here. */
  if (value === null || typeof value !== 'object' || !('x' in value && 'y' in value && 'size' in value)) {
    return WHOLE
  }

  const { x, y, size } = value

  /* A size of nought is not a crop, and a size above one is not a square that
     fits. How **small** a crop may be is not asked here: that depends on the
     picture in front of the reader (`closestIn`) and a stored record does not
     carry one, so the screen holds that boundary and this holds the shape. */
  if (!isFraction(x) || !isFraction(y) || !within(size, 0, 1) || size === 0) {
    return WHOLE
  }

  return { x, y, size }
}

/** Somewhere between one end and the other. */
function isFraction(value: unknown): value is number {
  return within(value, 0, 1)
}

/** A number, really a number, and inside its limits. `NaN` fails both
 *  comparisons on its own, which is the case that matters: it is what arrives
 *  from arithmetic on a missing field rather than from anybody typing it. */
function within(value: unknown, least: number, most: number): value is number {
  return typeof value === 'number' && value >= least && value <= most
}
