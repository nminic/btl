import type { RaceCategory } from '../data/types'

/* Where the ring is drawn and where the names around it stand.
 *
 * Its own module because it is arithmetic and not a component: the ring is one
 * SVG whose text has to be placed by hand, and placing text by hand is the kind
 * of thing that is worth testing on numbers rather than through a screen.
 */

/** The drawing, in its own units. The ring sits in the middle and the names
 *  stand to its left and right, each on the side its slice is on, so a line
 *  never has to cross the ring to reach its name. */
export const WIDTH = 360
export const HEIGHT = 200
export const CX = 180
export const CY = 100
/** Radius of the middle of the band, which is where a line ends: the centre of
 *  the segment, as asked for (owner, 31.07.2026). */
export const RADIUS = 58
export const BAND = 18
/** How far past the band a line bends before running flat to the name. */
const ELBOW = 20
/**
 * Where a name starts (right side) or ends (left side), from the centre.
 *
 * The longest name there can be is "Ultramaraton" with a count beside it, which
 * is about ninety units at the size the names are drawn. That has to fit between
 * here and the edge, and this has to clear the band, which reaches sixty-seven
 * from the centre. Both were measured in the browser rather than guessed: at the
 * first attempt "Polumaraton 4" ran eleven units past the edge and was quietly
 * clipped.
 */
const NAME_X = 85
/** The least vertical room two names may have between them. */
const APART = 15
/** How close to the top and bottom edge a name may come. */
const MARGIN = 12

export const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export type Slice = {
  one: RaceCategory
  value: number
  share: number
  offset: number
}

export type Callout = Slice & {
  /** Where the line touches the middle of the slice. */
  x: number
  y: number
  /** Where it bends, after nudging to keep names apart. */
  bendX: number
  bendY: number
  nameX: number
  right: boolean
}

/**
 * Places one name per slice, on the side of the ring its slice is on, and moves
 * them apart where two slices are so thin that their names would sit on top of
 * each other.
 *
 * The nudging is why this is worth its own function and its own test: with two
 * lengths of one race each, both middles land within a degree of one another and
 * without this the two names overlap into an unreadable smudge. Working down one
 * side and pushing each name below the one before is enough, because there are
 * never more than five and never more than four on one side.
 */
export function placeCallouts(slices: Slice[]): Callout[] {
  const placed = slices.map((slice) => {
    // Twelve o'clock, going clockwise, which is where the ring itself starts.
    const angle = 2 * Math.PI * (slice.offset + slice.share / 2) - Math.PI / 2
    const right = Math.cos(angle) >= 0

    return {
      ...slice,
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
      bendX: CX + (RADIUS + ELBOW) * Math.cos(angle),
      bendY: CY + (RADIUS + ELBOW) * Math.sin(angle),
      nameX: right ? CX + NAME_X : CX - NAME_X,
      right,
    }
  })

  for (const side of [true, false]) {
    const column = placed.filter((one) => one.right === side).sort((a, b) => a.bendY - b.bendY)
    /* Nothing can be above the first one, and starting from minus infinity says
       that without a branch that could never be taken twice. */
    let lowest = Number.NEGATIVE_INFINITY

    for (const one of column) {
      one.bendY = Math.max(one.bendY, lowest + APART)
      lowest = one.bendY
    }

    /* Pushing everything down can push the last one off the bottom: five names
       on one side are sixty units of column, and the one that started lowest
       already sat near the edge. Lifting the whole column keeps the spacing and
       costs only that the lines lean a little more. There is always room, since
       five names need sixty units and the drawing is two hundred tall. */
    const over = lowest - (HEIGHT - MARGIN)
    const lift = Math.min(Math.max(over, 0), (column[0]?.bendY ?? 0) - MARGIN)

    for (const one of column) {
      one.bendY -= lift
    }
  }

  return placed
}

/** Where a leader line runs: from the middle of the slice, out to its bend, then
 *  flat to the name it belongs to. */
export function leaderPoints(slice: Callout): string {
  const meets = slice.right ? slice.nameX - 5 : slice.nameX + 5

  return `${slice.x},${slice.y} ${slice.bendX},${slice.bendY} ${meets},${slice.bendY}`
}
