import { render, screen, within } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nProvider'
import type { RaceCategory } from '../data/types'
import { CategoryDonut } from './CategoryDonut'
import { BAND, CX, CY, RADIUS, placeCallouts, roomForName } from './donutLayout'

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

    /* Both on the right, each filling a quarter of the ring, so their middles
       are at one and five o'clock and neither name is moved. The exact heights
       are what has to be asserted: "further apart than the minimum" is true of
       any pair this function has pushed apart, so it would pass on a version
       that moved names it had no business moving. */
    expect(placed[0].bendY).toBeCloseTo(44.85, 1)
    expect(placed[1].bendY).toBeCloseTo(155.15, 1)
  })

  it('keeps the bend clear of the band after moving a name', () => {
    /* Two slivers at the top: the second is pushed down, and its bend has to
       follow the new height back out onto a circle that clears the band. Left
       where the slice's own angle put it, the flat run of the line crossed the
       ring it belongs to. */
    const placed = placeCallouts([
      { one: 'short', value: 1, share: 0.01, offset: 0.24 },
      { one: 'long', value: 1, share: 0.01, offset: 0.25 },
    ])

    const outer = RADIUS + BAND / 2

    for (const one of placed) {
      const away = Math.hypot(one.bendX - CX, one.bendY - CY)
      expect(away).toBeGreaterThanOrEqual(outer)
    }
  })

  it('leaves a name more room than the longest one can take', () => {
    /* The widest the data can produce is "129 Ultramaraton", which measures
       ninety-four units in Segoe UI and ninety-three in Arial, the two ends of
       the stack Windows resolves. This is the guard on the number that decides
       it: it has been set too tight twice already, and when it is too tight the
       drawing clips the name without a sound. */
    expect(roomForName()).toBeGreaterThanOrEqual(100)
  })
})
