import { fireEvent, waitFor } from '@testing-library/react'
import { must } from './at'

/**
 * Tells the browser how big the picture a member just chose turned out to be.
 *
 * Nothing is offered over a chosen file until its size is known: a picture too
 * small to draw the circle without loss is refused and the cropper is never
 * opened over it (owner, 23.08.2026: „slika manja od te granice se odbija pri
 * podizanju … kroper se nad njom i ne otvara"), and one that passes decides how
 * small its own circle may be (`closestIn`).
 *
 * jsdom decodes no pictures at all, so nothing would ever be measured and every
 * flow that uploads one would wait for a cropper that never opens. The shape is
 * handed over instead, which is what these tests already do for the picture the
 * cropper draws.
 *
 * Big enough by default, because most flows are not about that boundary; a case
 * that is about it passes its own numbers.
 *
 * Waited for, because the file is read off the disc a turn after the press.
 */
export async function measurePicture(width = 1200, height = 1200): Promise<void> {
  const measuring = await waitFor(theMeasuringPicture)

  Object.defineProperty(measuring, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(measuring, 'naturalHeight', { value: height, configurable: true })
  fireEvent.load(measuring)
}

/**
 * The one picture on the screen that is there to be measured rather than looked
 * at, and nothing else.
 *
 * It carries no name of its own on purpose: a class written into the markup only
 * so that a test can find it promises a rule in the stylesheet that does not
 * exist, and the next reader goes looking for one. So it is found by what it
 * really is: hidden from everybody, off the screen, and a picture.
 *
 * **Exactly one, or nothing at all.** Measured on 28.08.2026: `visually-hidden`
 * was left out of an earlier version of this selector, and the site's own mark in
 * the header (`app/Brand.tsx`, `alt="" aria-hidden="true"`) matched first on every
 * screen drawn inside the whole application. Four flows then handed their
 * measurement to the logo and waited for a cropper that never opened, and the
 * failure said only that a slider was missing. A selector that quietly takes the
 * first of several is the fault; refusing more than one is the fix, so the day a
 * second hidden picture appears this says which two it found.
 */
function theMeasuringPicture(): HTMLImageElement {
  const found = document.querySelectorAll<HTMLImageElement>('img.visually-hidden[aria-hidden="true"][alt=""]')

  if (found.length !== 1) {
    throw new Error(
      `expected exactly one picture being measured, found ${String(found.length)}: ` +
        [...found].map((one) => one.getAttribute('src') ?? '(no src)').join(', '),
    )
  }

  return must(found[0], 'the picture being measured')
}
