import { round } from './crop'
import type { Crop } from './crop'

/*
 * THE ONE MODULE THAT TURNS A CROP INTO A STYLE, AND ONE COMPONENT READS IT (`CutPicture.tsx`).
 *
 * It lived in `crop.ts` until 23.11.2026 and was imported by four screens, each of which drew
 * its own box around the picture. The arithmetic below is exact only when that box is a
 * SQUARE, and on the profile head it was not: the original photograph of member 000039 (1440
 * by 1920) was laid out 80 by 106.7 pixels inside an 80 pixel circle, so `cover` did nothing
 * and the scale cut a different part of the picture from the one he chose and from the one
 * the server cuts for every other circle. Owner, 23.11.2026: „Zašto se drugačije seče i
 * prikazuje u malom i velikom krugu?????" and „Veliki krug je rezprezentativan, tako treba da
 * bude svuda."
 *
 * So the box and the arithmetic now have one home together: this module is reached by
 * `CutPicture.tsx` alone (`components/oneFace.test.ts` holds that through the import graph),
 * and `.crop-fitted` in `Crop.css` is what makes the box the circle whatever lays it out
 * (`geometry/memberPicture.geometry.ts` measures the pixels).
 */

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
