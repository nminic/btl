import { render, screen, within } from '@testing-library/react'
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

    await user.hover(slices[0])

    const during = [...document.querySelectorAll('.donut__seg')].map((one) =>
      one.getAttribute('stroke-width'),
    )

    /* It grows on both edges, so the ring keeps its middle and the number in it
       does not jump. */
    expect(Number(during[0])).toBeGreaterThan(Number(before[0]))
    expect(during[1]).toBe(before[1])

    await user.unhover(slices[0])
    expect(
      [...document.querySelectorAll('.donut__seg')].map((one) =>
        one.getAttribute('stroke-width'),
      ),
    ).toEqual(before)
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

    await user.pointer({ target: document.querySelectorAll('.donut__seg')[1], keys: '[TouchA]' })

    /* Chosen, it is that length and its own count. Read off the drawing and not
       off the page, because the name of the length also stands in the table
       underneath, which is where a screen reader reads it. */
    const middle = document.querySelector('.donut__unit')
    const number = document.querySelector('.donut__total')

    expect(middle?.textContent).toBe('Maraton')
    expect(number?.textContent).toBe('1')
  })
})
