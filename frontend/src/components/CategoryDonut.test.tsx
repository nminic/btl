import { render, screen, within } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nProvider'
import type { RaceCategory } from '../data/types'
import { CategoryDonut } from './CategoryDonut'
import { placeCallouts } from './donutLayout'

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

    // Two run, so two names beside the ring and two rows in the reading. The
    // three never run are not drawn at nought, which is what they used to be.
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('rowheader', { name: 'Kraća trka' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Maraton' })).toBeInTheDocument()
    expect(screen.queryByRole('rowheader', { name: 'Ultramaraton' })).not.toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('declines the word in the middle with the number above it', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 1]]))
    expect(screen.getByText('trka')).toBeInTheDocument()
  })

  it('declines it the other way for the counts that ask for it', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 3]]))
    expect(screen.getByText('trke')).toBeInTheDocument()
  })

  it('ties every name to the middle of its own slice with a line', () => {
    renderDonut(
      new Map<RaceCategory, number>([
        ['short', 3],
        ['marathon', 1],
      ]),
    )

    // One line per name, and no line without a name.
    expect(document.querySelectorAll('.donut__leader')).toHaveLength(2)
  })

  it('survives a runner with nothing at all', () => {
    renderDonut(new Map())

    // Nought in the middle, the ring drawn as its bare track, and nothing
    // named: there is no length to name.
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(document.querySelectorAll('.donut__seg')).toHaveLength(0)
    expect(document.querySelectorAll('.donut__leader')).toHaveLength(0)
    expect(within(screen.getByRole('table')).queryAllByRole('row')).toHaveLength(0)
  })

  it('is one drawing with one name, not a picture beside a caption', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 1]]))
    expect(screen.getByRole('img', { name: 'Trke po dužini' })).toBeInTheDocument()
  })
})

describe('placeCallouts', () => {
  it('puts a name on the side of the ring its slice is on', () => {
    // Half the ring each: the first fills the right side from twelve o'clock,
    // the second fills the left.
    const placed = placeCallouts([
      { one: 'short', value: 1, share: 0.5, offset: 0 },
      { one: 'long', value: 1, share: 0.5, offset: 0.5 },
    ])

    expect(placed.map((one) => one.right)).toEqual([true, false])
    expect(placed[0].nameX).toBeGreaterThan(placed[1].nameX)
  })

  it('moves two names apart when their slices are too thin to keep them apart', () => {
    /* Two slivers next to each other at the top. Their middles are within a
       degree of one another, so without nudging both names are drawn on the same
       line and neither can be read. */
    const placed = placeCallouts([
      { one: 'short', value: 1, share: 0.01, offset: 0.24 },
      { one: 'long', value: 1, share: 0.01, offset: 0.25 },
    ])

    expect(placed[0].right).toBe(true)
    expect(placed[1].right).toBe(true)
    expect(Math.abs(placed[0].bendY - placed[1].bendY)).toBeGreaterThanOrEqual(15)
  })

  it('leaves names alone when the slices already keep them apart', () => {
    const placed = placeCallouts([
      { one: 'short', value: 1, share: 0.25, offset: 0 },
      { one: 'long', value: 1, share: 0.25, offset: 0.25 },
    ])

    // Both on the right, a quarter of the ring apart, so neither is moved and
    // the line still meets the middle of its slice.
    expect(placed[0].bendY).toBeLessThan(placed[1].bendY)
    expect(placed[1].bendY - placed[0].bendY).toBeGreaterThan(15)
  })
})
