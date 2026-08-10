import { render, screen } from '@testing-library/react'
import { must } from '../test/at'
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
 * Read off the drawing rather than decoded: a decoder is a second encoder with
 * the same bugs, and jsdom has no camera. What is held is the property that
 * makes the drawing an encoding at all — one text, one figure, and a different
 * text a different figure.
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
