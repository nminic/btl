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

/** The smallest square a member may cut down to, as a fraction of the shorter
 *  edge. A fifth of a photograph is already a close portrait; below that the
 *  thing in the circle is a handful of pixels blown up, which looks like a
 *  fault rather than a choice. */
export const CLOSEST = 0.2

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

  if (!isFraction(x) || !isFraction(y) || !within(size, CLOSEST, 1)) {
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
