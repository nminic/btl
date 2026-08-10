import jsQR from 'jsqr'
import { at, must } from './at'

/**
 * What a telephone would read off a drawn QR code.
 *
 * The portal draws its payment codes itself (components/QrCode.tsx), and the
 * only question worth asking of a drawing is whether it says what it was given.
 * Everything short of that agrees with the encoder about the encoder: the
 * furniture of a code (its finders, its timing lines) is right by construction
 * even when the bits inside are a payload nobody can pay.
 *
 * A decoder is not a second encoder. It is somebody else's reading of the same
 * standard, so a fault in ours does not travel into it, and it needs no camera:
 * what a camera hands over is a grid of pixels, which is what is built here out
 * of the squares the drawing wrote.
 */
export function readQr(drawn: Element): string | null {
  /* The whole figure including whatever quiet zone the drawing left around it:
     read off the box rather than worked out from the module count, so widening
     that zone is a wider picture here and not a picture read at an offset. */
  const box = must(drawn.getAttribute('viewBox'), 'the box the figure is drawn in').split(' ')
  const span = Number(at(box, 2))
  const figure = must(
    drawn.querySelector('path')?.getAttribute('d'),
    'the figure the code drew',
  )
  const dark = new Set(
    [...figure.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((one) => `${one[2]}:${one[1]}`),
  )

  /* Said here rather than left to the decoder. The squares are read by the
     grammar the drawing writes them in, so a drawing that merged them into runs
     or wrote rectangles instead would leave nothing to read and the failure
     would name the decoder. */
  if (dark.size === 0) {
    throw new Error('no squares found in the figure')
  }

  /* Four pixels to a module: headroom for the decoder's sampling, and cheap. One
     pixel a module reads too, so this is not what makes the reading work; it is
     what keeps it from depending on the decoder being generous. */
  const scale = 4
  const side = span * scale
  const pixels = new Uint8ClampedArray(side * side * 4)

  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const on = dark.has(`${Math.floor(y / scale)}:${Math.floor(x / scale)}`)
      const at = (y * side + x) * 4

      pixels[at] = on ? 0 : 255
      pixels[at + 1] = on ? 0 : 255
      pixels[at + 2] = on ? 0 : 255
      pixels[at + 3] = 255
    }
  }

  return jsQR(pixels, side, side)?.data ?? null
}
