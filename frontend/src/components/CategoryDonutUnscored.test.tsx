import { render, screen, within } from '@testing-library/react'
import { at, first, must } from '../test/at'
import { setupUser } from '../test/user'
import { I18nProvider } from '../i18n/I18nProvider'
import type { RaceCategory } from '../data/types'
import { CategoryDonut } from './CategoryDonut'

/* The sixth slice of the ring: the races the league does not score (PDL, 14.11.2026, „Ostale
   discipline kao lična evidencija"). The five before it are measured in `CategoryDonut.test.tsx`; what
   is measured here is only what the sixth adds. */

function renderDonut(counts: Map<RaceCategory, number>, unscored?: number) {
  render(
    <I18nProvider locale="sr">
      <CategoryDonut counts={counts} unscored={unscored} caption="Trke po distanci" />
    </I18nProvider>,
  )
}

describe('the slice of the races the league does not score', () => {
  it('is named in the reading, with its count and its share of the whole', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 3]]), 1)

    const row = must(
      screen.getByRole('rowheader', { name: 'Nebodovane trke' }).parentElement,
      'row of the unscored slice',
    )

    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['1', '25%'])
  })

  it('is counted in the total in the middle and in the reading, though no figure beside the ring counts it', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 3]]), 2)

    const total = within(screen.getByRole('table')).getByRole('rowheader', { name: 'Zbirno' })

    expect(total.parentElement).toHaveTextContent('5 trka')
    expect(document.querySelector('.donut__total')).toHaveTextContent('5')
  })

  it('is a slice of its own, drawn after the five lengths', () => {
    renderDonut(new Map<RaceCategory, number>([['ultra', 1]]), 1)

    const slices = [...document.querySelectorAll('.donut__seg')]

    expect(slices).toHaveLength(2)
    expect(at(slices, 0)).toHaveAttribute('stroke', 'var(--length-ultra)')
    expect(at(slices, 1)).toHaveAttribute('stroke', 'var(--text-muted)')
  })

  it('draws no slice when there are none, and the ring of a team page is the ring it was', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 3]]))

    expect(document.querySelectorAll('.donut__seg')).toHaveLength(1)
    expect(screen.queryByRole('rowheader', { name: 'Nebodovane trke' })).not.toBeInTheDocument()
  })

  it('draws the ring of somebody who has run nothing the league scores but has swum', () => {
    renderDonut(new Map(), 4)

    expect(document.querySelectorAll('.donut__seg')).toHaveLength(1)
    expect(document.querySelector('.donut__total')).toHaveTextContent('4')
  })

  it('names itself in the tooltip of the layer that reads the pointer', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 3]]), 2)

    const hits = [...document.querySelectorAll('.donut__hit title')]

    expect(hits.map((one) => one.textContent)).toEqual(['Kraća trka: 3', 'Nebodovane trke: 2'])
  })

  /* One, two and five are the three forms: „1 nebodovana trka", „2 nebodovane trke" and „5 nebodovanih
     trka". A test on one of them passes on a component that never declines anything. */
  it.each([
    [1, 'nebodovana trka'],
    [2, 'nebodovane trke'],
    [5, 'nebodovanih trka'],
    [21, 'nebodovana trka'],
    [12, 'nebodovanih trka'],
  ])('says %i of them as „%s" while the slice is pointed at', async (count, word) => {
    const user = setupUser()
    renderDonut(new Map<RaceCategory, number>([['short', 3]]), count)

    await user.hover(at(document.querySelectorAll('.donut__hit'), 1))

    expect(document.querySelector('.donut__unit')).toHaveTextContent(word)
    expect(document.querySelector('.donut__total')).toHaveTextContent(String(count))
  })

  it('goes back to the word for the races when the pointer leaves it', async () => {
    const user = setupUser()
    renderDonut(new Map<RaceCategory, number>([['short', 3]]), 2)

    const hits = [...document.querySelectorAll('.donut__hit')]

    await user.hover(at(hits, 1))
    await user.unhover(at(hits, 1))

    expect(document.querySelector('.donut__unit')).toHaveTextContent('trka')
    expect(document.querySelector('.donut__total')).toHaveTextContent('5')
    expect(first(hits)).toBeInTheDocument()
  })
})
