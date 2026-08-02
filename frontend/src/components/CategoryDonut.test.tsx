import { fireEvent, render, screen, within } from '@testing-library/react'
import { at, first } from '../test/at'
import { setupUser } from '../test/user'
import { I18nProvider } from '../i18n/I18nProvider'
import type { RaceCategory } from '../data/types'
import { CategoryDonut } from './CategoryDonut'

function renderDonut(counts: Map<RaceCategory, number>) {
  render(
    <I18nProvider locale="sr">
      <CategoryDonut counts={counts} caption="Trke po dužini" />
    </I18nProvider>,
  )
}

describe('CategoryDonut', () => {
  it('names only the lengths this person has actually run', () => {
    renderDonut(
      new Map<RaceCategory, number>([
        ['short', 3],
        ['marathon', 1],
      ]),
    )

    // Two run, so two names beside the ring and two of them in the reading. The
    // three never run are not drawn at nought, which is what they used to be.
    expect(screen.getByRole('rowheader', { name: 'Kraća trka' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Maraton' })).toBeInTheDocument()
    expect(screen.queryByRole('rowheader', { name: 'Ultramaraton' })).not.toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('says the total in words as well as in the middle of the ring', () => {
    /* The number in the middle of the drawing is the one number this card is
       about, and the drawing is hidden from the reading. Without this row it
       existed nowhere else: the widget beside it stopped counting races in the
       same change that hid the ring. */
    renderDonut(
      new Map<RaceCategory, number>([
        ['short', 3],
        ['marathon', 1],
      ]),
    )

    const total = within(screen.getByRole('table')).getByRole('rowheader', { name: 'Zbirno' })

    expect(total.parentElement).toHaveTextContent('4 trke')
  })

  it('declines the word in the middle with the number above it', () => {
    /* Three is the count that tells the two forms apart. One and five both take
       "trka" in Serbian, so a test on either of those passes on a component that
       never declines anything at all. */
    renderDonut(new Map<RaceCategory, number>([['short', 3]]))
    expect(screen.getByText('trke')).toBeInTheDocument()
  })

  it('goes back to the other form where the number asks for it', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 5]]))
    expect(screen.getByText('trka')).toBeInTheDocument()
    expect(screen.queryByText('trke')).not.toBeInTheDocument()
  })

  it('survives a runner with nothing at all', () => {
    renderDonut(new Map())

    // Nought in the middle, the ring drawn as its bare track, and nothing
    // named: there is no length to name.
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(document.querySelectorAll('.donut__seg')).toHaveLength(0)
    expect(screen.queryAllByRole('rowheader')).toHaveLength(1)
    expect(
      within(screen.getByRole('table')).getByRole('rowheader', { name: 'Zbirno' }).parentElement,
    ).toHaveTextContent('0 trka')
  })

  it('is read once, off the table, and not a second time off the drawing', () => {
    /* Chrome does not treat the children of an `img` as presentational, so a
       named drawing was read out in full and then the table said the same thing
       again. */
    renderDonut(new Map<RaceCategory, number>([['short', 1]]))

    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Trke po dužini' })).toBeInTheDocument()
  })
})

describe('pointing at a slice', () => {
  it('grows the one under the pointer and leaves the rest alone', async () => {
    const user = setupUser()
    renderDonut(
      new Map<RaceCategory, number>([
        ['short', 3],
        ['marathon', 1],
      ]),
    )

    const slices = [...document.querySelectorAll('.donut__seg')]
    const before = slices.map((one) => one.getAttribute('stroke-width'))
    /* Hovered on the layer that reads the pointer, read off the layer that
       draws. They are the same slices in the same order; keeping them apart is
       what stops a grown slice from moving its own hit area (owner,
       01.08.2026). */
    const hits = [...document.querySelectorAll('.donut__hit')]

    await user.hover(first(hits))

    const during = [...document.querySelectorAll('.donut__seg')].map((one) =>
      one.getAttribute('stroke-width'),
    )

    /* It grows outwards, so the hole in the middle never changes size. The two
       widths are read through `at`, because a ring drawn with one slice fewer
       must fail this rather than find nothing on both sides and agree. */
    expect(Number(first(during))).toBeGreaterThan(Number(first(before)))
    expect(at(during, 1)).toBe(at(before, 1))

    await user.unhover(first(hits))
    expect(
      [...document.querySelectorAll('.donut__seg')].map((one) =>
        one.getAttribute('stroke-width'),
      ),
    ).toEqual(before)
  })

  it('declines the word in the middle with the number above it', async () => {
    const user = setupUser()
    renderDonut(new Map<RaceCategory, number>([['marathon', 3]]))

    await user.pointer({
      target: first(document.querySelectorAll('.donut__hit')),
      keys: '[TouchA]',
    })

    // Three is the count that tells the forms apart: one and five both take the
    // same one in Serbian.
    expect(document.querySelector('.donut__unit')?.textContent).toBe('maratona')
  })

  /* The geometry of the growth, which is the whole of the change and which two
     mutations used to walk straight through: growing on both edges instead of
     outwards, and measuring the longer arc on the old circle so the slice slides
     round the ring as it grows. */
  it('grows outwards, keeps its place on the ring, and stays inside the drawing', async () => {
    const user = setupUser()
    renderDonut(
      new Map<RaceCategory, number>([
        ['short', 3],
        ['marathon', 1],
      ]),
    )

    const read = (one: Element) => {
      /* The dash pattern is a pair: the length of line the browser draws, and
         the circumference it is measured against. Read through `at`, so a slice
         that has lost the attribute fails here saying which of the two was
         missing, rather than arriving three assertions further down as a NaN
         that could have come from any of them. */
      const dash = (one.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number)
      const drawn = first(dash)
      const round = at(dash, 1)

      return {
        radius: Number(one.getAttribute('r')),
        width: Number(one.getAttribute('stroke-width')),
        round,
        share: drawn / round,
        offset: Number(one.getAttribute('stroke-dashoffset')) / round,
      }
    }

    /* The marathon, which is the smaller of the two slices. Asked for again
       each time, because hovering draws a new one in its place. */
    /* The drawing is read; the layer over it is what the pointer touches. They
     are the same slices in the same order, so index 1 is the marathon in both. */
  const marathon = () => at(document.querySelectorAll('.donut__seg'), 1)
  const marathonHit = () => at(document.querySelectorAll('.donut__hit'), 1)

    const before = read(marathon())

    await user.hover(marathonHit())

    const after = read(marathon())

    // Outwards: the middle of the band moves out by half of what the band gains,
    // so the inner edge stands still.
    expect(after.radius).toBeCloseTo(before.radius + (after.width - before.width) / 2, 6)
    // And the slice is the same slice: same share of the circle, same place on it.
    expect(after.share).toBeCloseTo(before.share, 6)
    expect(after.offset).toBeCloseTo(before.offset, 6)
    /* Measured on its own circle, which is what keeps it there. A longer arc
       measured on the smaller circle is the same length of line laid on a wider
       ring, so the slice covers fewer degrees and slides round as it grows. */
    expect(after.round).toBeCloseTo(2 * Math.PI * after.radius, 6)
    expect(before.round).toBeCloseTo(2 * Math.PI * before.radius, 6)
    // The outer edge stays inside the square the drawing is given.
    expect(after.radius + after.width / 2).toBeLessThanOrEqual(100)
  })

  it('says which length it is, and how many', () => {
    renderDonut(new Map<RaceCategory, number>([['marathon', 4]]))

    // The browser's own tooltip, and what a screen reader reads off a shape.
    expect(document.querySelector('.donut__seg title')?.textContent).toBe('Maraton: 4')
  })

  /* A tooltip is a thing a finger cannot open, and the ring has no names on it
     any more, so on a telephone it was five unnamed colours (WCAG 2.2 SC 1.4.1).
     A touch chooses a slice and the middle of the ring answers. */
  it('answers in the middle of the ring, so a finger can ask too', async () => {
    const user = setupUser()
    renderDonut(
      new Map<RaceCategory, number>([
        ['short', 3],
        ['marathon', 1],
      ]),
    )

    // Left alone it is the total and the word for races.
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('trke')).toBeInTheDocument()

    await user.pointer({
      target: at(document.querySelectorAll('.donut__hit'), 1),
      keys: '[TouchA]',
    })

    /* Chosen, it is that length and its own count. Read off the drawing and not
       off the page, because the name of the length also stands in the table
       underneath, which is where a screen reader reads it. */
    const middle = document.querySelector('.donut__unit')
    const number = document.querySelector('.donut__total')

    /* The word declines with the number above it, and it is not in capitals:
       "ultramaratona" in small caps with spacing does not fit the hole in the
       middle and loses the shape the eye reads a word by (owner, 31.07.2026). */
    expect(middle?.textContent).toBe('maraton')
    expect(number?.textContent).toBe('1')
  })
})

describe('the line between two slices', () => {
  it('reads the pointer off a layer that never changes shape', () => {
    /* Reported from a screen recording: with the pointer resting on the line
       between two slices the ring swapped between them, over and over, without
       the mouse moving.

       The cause is geometric rather than accidental. The drawing caught the
       pointer, and a slice that grows moves its own edge: choosing the second
       slice grew it over the line, which put the pointer inside the first
       slice's grown body, which chose the first, which grew it back over the
       line, and so on for as long as the mouse stood still.

       jsdom lays nothing out, so what is held here is the arrangement that makes
       it impossible: every slice of the layer that reads the pointer is drawn at
       the resting radius and the resting width, whatever is chosen, and the
       layer that grows is not touchable at all. */
    renderDonut(
      new Map<RaceCategory, number>([
        ['short', 3],
        ['marathon', 1],
      ]),
    )

    const resting = (one: Element) => [one.getAttribute('r'), one.getAttribute('stroke-width')]
    const hits = [...document.querySelectorAll('.donut__hit')]
    const before = hits.map(resting)

    expect(hits).toHaveLength(2)
    expect(new Set(before.map(String)).size).toBe(1)

    fireEvent.pointerEnter(first(hits), { pointerType: 'mouse' })

    /* The chosen slice has grown, and not one of the hit areas has moved. */
    expect([...document.querySelectorAll('.donut__hit')].map(resting)).toEqual(before)
    expect(Number(first(document.querySelectorAll('.donut__seg')).getAttribute('stroke-width')))
      .toBeGreaterThan(Number(first(before)[1]))
  })
})
