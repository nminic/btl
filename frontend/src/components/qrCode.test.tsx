import { render, screen } from '@testing-library/react'
import { must } from '../test/at'
import { digestOf } from '../test/digest'
import { QrCode } from './QrCode'

/**
 * What the drawing carries.
 *
 * The content of the two payloads has its own tests (data/paymentQr.test.ts);
 * what those cannot say is whether the square somebody points a telephone at is
 * a drawing of that content. A code that draws beautifully and encodes the wrong
 * text is a payment slip nobody can pay, and it looks exactly like one that
 * works.
 *
 * Read off the drawing itself, in three ways, because no decoder is bundled and
 * a bundled one would be one more thing to keep. The drawing is a function of
 * its text (the same text draws the same figure, a different text another); the
 * figure is a QR code and not merely a stable pattern of squares, which is held
 * by reading the parts of it the standard fixes; and it is the figure it was
 * yesterday, which is what notices the encoder changing under a version bump.
 *
 * The middle one is what the first cannot do. A drawing that lost its last row,
 * or drew the matrix transposed, is still one figure per text: every mutation of
 * that kind passed until the parts below were read.
 */
function figureOf(label: string): string {
  return must(
    screen.getByRole('img', { name: label }).querySelector('path')?.getAttribute('d'),
    'the figure the code drew',
  )
}

/**
 * The dark squares of a drawing, read back out of it as rows and columns.
 *
 * The drawing writes one square per dark module, `M{x} {y}h1v1h-1z`, with a
 * module of quiet zone in front of both. Read here rather than asked of the
 * encoder: a check that asks the encoder what it drew agrees with itself
 * whatever it drew.
 */
function modulesOf(label: string): { dark: (row: number, column: number) => boolean; size: number } {
  const drawn = screen.getByRole('img', { name: label })
  const box = must(drawn.getAttribute('viewBox'), 'the box the figure is drawn in').split(' ')
  const size = Number(box[2]) - 2
  const dark = new Set(
    [...figureOf(label).matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(
      (one) => `${Number(one[2]) - 1}:${Number(one[1]) - 1}`,
    ),
  )

  return { dark: (row, column) => dark.has(`${row}:${column}`), size }
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

describe('the figure a payment code draws is a QR code', () => {
  /* The parts the standard fixes, read off the drawing. Every one of these
     survived a drawing that lost its last row and a drawing that transposed the
     matrix, which is what a check on "one text, one figure" cannot see. */
  const PAYLOAD = 'K:PR|V:01|C:1|R:105000000000328471|N:Sportsko udruzenje BTL|I:RSD4800,00'

  beforeEach(() => {
    render(<QrCode text={PAYLOAD} label="uplatnica" />)
  })

  it('is as many modules across as its version says, and square', () => {
    const { size } = modulesOf('uplatnica')

    /* Every version is 17 + 4V modules across, so a size that is not one of
       those is not a QR code of any version. */
    expect((size - 17) % 4).toBe(0)
    expect(size).toBe(37)
  })

  it('carries the three finders, each in its own corner', () => {
    const { dark, size } = modulesOf('uplatnica')

    for (const [row, column] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ] as [number, number][]) {
      /* Seven by seven: a dark ring, a light ring inside it, and a dark three by
         three in the middle. This is what a camera looks for first, and a
         drawing missing one of them is a drawing no telephone will read. */
      expect(dark(row, column)).toBe(true)
      expect(dark(row + 6, column + 6)).toBe(true)
      expect(dark(row + 1, column + 1)).toBe(false)
      expect(dark(row + 3, column + 3)).toBe(true)
    }
  })

  it('carries the timing lines that say where the modules are', () => {
    const { dark, size } = modulesOf('uplatnica')

    /* Alternating from the eighth module to the last finder, along the row and
       down the column: the ruler a reader measures the grid with. */
    for (let at = 8; at < size - 8; at += 1) {
      expect(dark(6, at)).toBe(at % 2 === 0)
      expect(dark(at, 6)).toBe(at % 2 === 0)
    }
  })

  it('carries the one module the standard says is always dark', () => {
    const { dark, size } = modulesOf('uplatnica')
    const version = (size - 17) / 4

    /* And it is the one part of the figure that is not the same on both
       diagonals, so a drawing that swapped rows for columns is caught here and
       nowhere else. */
    expect(dark(4 * version + 9, 8)).toBe(true)
    expect(dark(8, 4 * version + 9)).toBe(false)
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
