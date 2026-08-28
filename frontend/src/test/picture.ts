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
  const measuring = await waitFor(() =>
    must(document.querySelector('.crop__measuring'), 'the picture being measured'),
  )

  Object.defineProperty(measuring, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(measuring, 'naturalHeight', { value: height, configurable: true })
  fireEvent.load(measuring)
}
