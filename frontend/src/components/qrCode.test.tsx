import { render, screen } from '@testing-library/react'
import { must } from '../test/at'
import { digestOf } from '../test/digest'
import { readQr } from '../test/readQr'
import { QrCode } from './QrCode'

/**
 * What the drawing carries.
 *
 * The content of the payload has its own tests (pages/adminFlows.test.tsx);
 * what those cannot say is whether the square somebody points a telephone at is
 * a drawing of that content. A code that draws beautifully and encodes the wrong
 * text is a payment slip nobody can pay, and it looks exactly like one that
 * works.
 *
 * Asked of the drawing three ways. It is read back by a decoder, which is the
 * question itself and is answered by somebody else's reading of the standard; it
 * is a function of its text, so one text draws one figure and a text one
 * character apart draws another; and it is the figure it was yesterday, which is
 * what notices the encoder changing under an open version range.
 *
 * The first catches a figure that carries the wrong text: a payload truncated by
 * one character, or upper-cased, or a row of the matrix dropped, all read back
 * as something else or as nothing.
 *
 * The last catches what a decoder is content with. A code drawn at another level
 * of error correction still reads, and so does one drawn transposed, since a
 * reader that tolerates a mirrored code will tolerate ours; both are deliberate
 * choices of this component, and the frozen figure is what notices either of
 * them changing.
 */
function figureOf(label: string): string {
  return must(
    screen.getByRole('img', { name: label }).querySelector('path')?.getAttribute('d'),
    'the figure the code drew',
  )
}

describe('the drawing of a payment code', () => {
  it('draws the text it was given, and the same text the same way', () => {
    const { unmount } = render(<QrCode text="PR|K:PR|V:01" label="prvi" />)
    const first = figureOf('prvi')

    unmount()
    render(<QrCode text="PR|K:PR|V:01" label="drugi" />)

    expect(figureOf('drugi')).toBe(first)
  })

  it('draws a different text differently, which is what makes it an encoding', () => {
    /* One character apart, because a drawing that ignored its text would pass a
       comparison of two texts that differ wildly by accident of size. */
    const { unmount } = render(<QrCode text="PR|K:PR|V:01|I:RSD4800,00" label="prvi" />)
    const first = figureOf('prvi')

    unmount()
    render(<QrCode text="PR|K:PR|V:01|I:RSD4801,00" label="drugi" />)

    expect(figureOf('drugi')).not.toBe(first)
  })

  it('is named, since a square of dots says nothing to anybody who cannot see it', () => {
    render(<QrCode text="PR|K:PR|V:01" label="Uplatnica za članarinu" />)

    expect(screen.getByRole('img', { name: 'Uplatnica za članarinu' })).toBeVisible()
  })

  it('grows to the size it is asked for, and keeps its shape', () => {
    /* The slip is printed as well as read off a screen, so the drawing is asked
       for a size in one place and must not be stretched by it. */
    render(<QrCode text="PR|K:PR|V:01" label="prvi" size={320} />)

    const drawn = screen.getByRole('img', { name: 'prvi' })
    const box = must(drawn.getAttribute('viewBox'), 'the box the figure is drawn in')
    const [, , wide, tall] = box.split(' ')

    expect(drawn).toHaveAttribute('width', '320')
    expect(drawn).toHaveAttribute('height', '320')
    expect(wide).toBe(tall)
  })
})

describe('what a telephone reads off the drawing', () => {
  const PAYLOAD = 'K:PR|V:01|C:1|R:105000000000328471|N:Sportsko udruzenje BTL|I:RSD4800,00'

  it('is the text the code was given, read by a decoder nobody here wrote', () => {
    /* The whole question, asked plainly. Anything short of this agrees with the
       encoder about the encoder: the furniture of a code is right by
       construction even when the bits inside are a payload nobody can pay. It is
       read here by a decoder nobody in this repository wrote. */
    render(<QrCode text={PAYLOAD} label="uplatnica" />)

    expect(readQr(screen.getByRole('img', { name: 'uplatnica' }))).toBe(PAYLOAD)
  })

  it('is read the same way at the size the slip is printed at', () => {
    /* The drawing is asked for a size in one place and the figure must not be
       stretched by it: a code that reads on a screen and not on paper is a code
       that fails where it matters. */
    render(<QrCode text={PAYLOAD} label="uplatnica" size={320} />)

    expect(readQr(screen.getByRole('img', { name: 'uplatnica' }))).toBe(PAYLOAD)
  })

  it('reads a long payload as well as a short one', () => {
    /* The encoder picks its own version, so a longer text is a bigger grid. The
       one the slip carries abroad is the long one. */
    const long = `${PAYLOAD}|S:Clanarina za sezonu 2027, clan 000001|RO:97 12345678901234567890`

    render(<QrCode text={long} label="duga" />)

    expect(readQr(screen.getByRole('img', { name: 'duga' }))).toBe(long)
  })
})

describe('the figure this payload has always drawn', () => {
  it('is drawn the same way it was the day it was read by a telephone', () => {
    /* A digest of the figure and its length, frozen. The parts above say the
       drawing is a QR code and a function of its text; this says it is the same
       one it was, which is what notices the encoder changing under a version
       bump of qrcode-generator, whose range is open.

       Compared as a digest rather than as ten thousand characters of path, so a
       failure reads as a number rather than as two walls of `M..h1v1h-1z`. */
    render(
      <QrCode
        text="K:PR|V:01|C:1|R:105000000000328471|N:Sportsko udruzenje BTL|I:RSD4800,00"
        label="uplatnica"
      />,
    )

    const figure = figureOf('uplatnica')

    expect([figure.length, digestOf(figure)]).toEqual([9356, 'x2li0b'])
  })
})
