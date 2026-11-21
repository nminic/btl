import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { at, first, must } from '../test/at'
import { setupUser } from '../test/user'
import { I18nProvider } from '../i18n/I18nProvider'
import type { RaceCategory } from '../data/types'
import { CategoryDonut } from './CategoryDonut'

function renderDonut(counts: Map<RaceCategory, number>) {
  render(
    <I18nProvider locale="sr">
      <CategoryDonut counts={counts} caption="Trke po distanci" />
    </I18nProvider>,
  )
}

/** The outer and the inner radius a slice is drawn with, read off its path. */
function radii(one: Element) {
  const d = one.getAttribute('d') ?? ''
  const outer = /A ([\d.]+) [\d.]+ 0 \d 1/.exec(d)
  const inner = /A ([\d.]+) [\d.]+ 0 \d 0/.exec(d)

  return { outer: Number(at(outer ?? [], 1)), inner: Number(at(inner ?? [], 1)) }
}

const slicesNow = () => [...document.querySelectorAll('.donut__seg')]
const hitsNow = () => [...document.querySelectorAll('.donut__hit')]
const middle = () => [
  document.querySelector('.donut__total')?.textContent,
  document.querySelector('.donut__unit')?.textContent,
]

const TWO = () =>
  new Map<RaceCategory, number>([
    ['short', 3],
    ['marathon', 1],
  ])

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

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
    renderDonut(TWO())

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
       again. What is drawn stays hidden from a reader; only the slices a keyboard
       reaches are in the reading, as buttons, and the table is the one place the
       numbers are read out. */
    renderDonut(new Map<RaceCategory, number>([['short', 1]]))

    expect(document.querySelector('.donut__ring')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('.donut__total')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('.donut__unit')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Trke po distanci' })).toBeInTheDocument()
  })

  it('draws a ring that is whole when one length is all there is', () => {
    renderDonut(new Map<RaceCategory, number>([['short', 2]]))

    // One slice of the whole: two half circles each way, and a hole.
    expect(radii(first(slicesNow()))).toEqual({ outer: 85, inner: 55 })
  })
})

describe('pointing at a slice', () => {
  it('lifts the one under the pointer outwards and leaves the rest alone', async () => {
    const user = setupUser()
    renderDonut(TWO())

    const before = slicesNow().map(radii)

    await user.hover(first(hitsNow()))

    await vi.waitFor(() => {
      expect(radii(first(slicesNow())).outer).toBe(97)
    })

    const during = slicesNow().map(radii)

    // The inner edge is the same for every slice at every moment; only the outer edge of the chosen
    // one moved, by exactly the growth, and the other one did not.
    expect(during.map((one) => one.inner)).toEqual(before.map((one) => one.inner))
    expect(at(during, 1).outer).toBe(at(before, 1).outer)
    expect(first(slicesNow()).getAttribute('class')).not.toContain('dim')
    expect(at(slicesNow(), 1).getAttribute('class')).toContain('dim')

    await user.unhover(first(hitsNow()))

    await vi.waitFor(() => {
      expect(slicesNow().map(radii)).toEqual(before)
    })
    expect(slicesNow().map((one) => one.getAttribute('class'))).toEqual([
      'donut__seg',
      'donut__seg',
    ])
  })

  it('moves the outer edge by degrees and never the inner one while it does', () => {
    vi.useFakeTimers()
    renderDonut(TWO())

    fireEvent.pointerEnter(first(hitsNow()), { pointerType: 'mouse' })
    act(() => {
      vi.advanceTimersByTime(16)
    })
    act(() => {
      vi.advanceTimersByTime(80)
    })

    const half = radii(first(slicesNow()))

    expect(half.outer).toBeGreaterThan(85)
    expect(half.outer).toBeLessThan(97)
    expect(half.inner).toBe(55)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(radii(first(slicesNow())).outer).toBe(97)
  })

  it('does not move at all for those who ask for less of it', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    renderDonut(TWO())

    fireEvent.pointerEnter(first(hitsNow()), { pointerType: 'mouse' })

    expect(radii(first(slicesNow())).outer).toBe(97)
  })

  it('declines the word in the middle with the number above it', async () => {
    const user = setupUser()
    renderDonut(new Map<RaceCategory, number>([['marathon', 3]]))

    await user.pointer({ target: first(hitsNow()), keys: '[TouchA]' })

    // Three is the count that tells the forms apart: one and five both take the
    // same one in Serbian.
    expect(document.querySelector('.donut__unit')?.textContent).toBe('maratona')
  })

  it('says which length it is, and how many', () => {
    renderDonut(new Map<RaceCategory, number>([['marathon', 4]]))

    // The browser's own tooltip, and what a screen reader reads off a shape.
    expect(document.querySelector('.donut__hit title')?.textContent).toBe('Maraton: 4')
  })

  it('answers in the middle of the ring, so a finger can ask too', async () => {
    const user = setupUser()
    renderDonut(TWO())

    // Left alone it is the total and the word for races.
    expect(middle()).toEqual(['4', 'trke'])

    await user.pointer({ target: at(hitsNow(), 1), keys: '[TouchA]' })

    expect(middle()).toEqual(['1', 'maraton'])
  })
})

/* A finger on a browser that does not move focus to what it touches (Safari does not for an element
   that is not a form control), so nothing blurs and the only way back is the document's own listener.
   The events are sent as that finger sends them: a `pointerenter` and then a `pointerdown`, both
   `touch`. The tests above go through user-event, whose touch also moves focus, and focus leaving is a
   second way back that would hide the first. */
describe('going back, for a finger that moves no focus', () => {
  const ALL = ['4', 'trke']
  const touch = (one: Element) => {
    fireEvent.pointerEnter(one, { pointerType: 'touch' })
    fireEvent.pointerDown(one, { pointerType: 'touch' })
  }

  it('chooses on the first touch, though a pointerenter came just before it', () => {
    renderDonut(TWO())

    touch(first(hitsNow()))

    expect(middle()[0]).toBe('3')
  })

  it('goes back on a touch in the middle of the ring, and on one outside it', () => {
    renderDonut(TWO())

    touch(first(hitsNow()))
    fireEvent.pointerDown(must(document.querySelector('.donut__total'), 'the figure'), {
      pointerType: 'touch',
    })
    expect(middle()).toEqual(ALL)

    touch(first(hitsNow()))
    expect(middle()[0]).toBe('3')
    fireEvent.pointerDown(document.body, { pointerType: 'touch' })
    expect(middle()).toEqual(ALL)
  })

  it('goes back on the second touch of the same slice, and moves on a touch of another', () => {
    renderDonut(TWO())

    touch(first(hitsNow()))
    touch(at(hitsNow(), 1))
    expect(middle()).toEqual(['1', 'maraton'])

    touch(at(hitsNow(), 1))
    expect(middle()).toEqual(ALL)
  })
})

describe('going back to all the races', () => {
  const ALL = ['4', 'trke']

  it('goes back on a touch in the middle of the ring', async () => {
    const user = setupUser()
    renderDonut(TWO())

    await user.pointer({ target: first(hitsNow()), keys: '[TouchA]' })
    expect(middle()[0]).toBe('3')

    // The middle is not a slice: it is the figure the ring writes there, which no slice covers.
    await user.pointer({
      target: must(document.querySelector('.donut__total'), 'the figure in the middle'),
      keys: '[TouchA]',
    })
    expect(middle()).toEqual(ALL)
  })

  it('goes back on a second touch of the same slice, and not on a touch of another', async () => {
    const user = setupUser()
    renderDonut(TWO())

    await user.pointer({ target: first(hitsNow()), keys: '[TouchA]' })
    await user.pointer({ target: at(hitsNow(), 1), keys: '[TouchA]' })
    expect(middle()).toEqual(['1', 'maraton'])

    await user.pointer({ target: at(hitsNow(), 1), keys: '[TouchA]' })
    expect(middle()).toEqual(ALL)
  })

  it('goes back on a touch outside the ring', async () => {
    const user = setupUser()
    renderDonut(TWO())

    await user.pointer({ target: first(hitsNow()), keys: '[TouchA]' })
    expect(middle()[0]).toBe('3')
    await user.pointer({ target: document.body, keys: '[TouchA]' })

    expect(middle()).toEqual(ALL)
  })

  it('goes back on Esc, and ignores every other key', async () => {
    const user = setupUser()
    renderDonut(TWO())

    await user.pointer({ target: first(hitsNow()), keys: '[TouchA]' })
    await user.keyboard('a')
    expect(middle()[0]).toBe('3')

    await user.keyboard('{Escape}')
    expect(middle()).toEqual(ALL)
  })

  it('does not take a mouse click on the slice it already rests on for a let-go', async () => {
    const user = setupUser()
    renderDonut(TWO())

    await user.hover(first(hitsNow()))
    await user.click(first(hitsNow()))

    expect(middle()[0]).toBe('3')
  })

  it('chooses by focus and lets go by blur, and says which one is pressed', async () => {
    const user = setupUser()
    renderDonut(TWO())

    await user.tab()
    expect(first(hitsNow())).toHaveFocus()
    expect(first(hitsNow())).toHaveAttribute('aria-pressed', 'true')
    expect(middle()[0]).toBe('3')

    await user.tab()
    expect(at(hitsNow(), 1)).toHaveAttribute('aria-pressed', 'true')
    expect(first(hitsNow())).toHaveAttribute('aria-pressed', 'false')

    await user.tab()
    expect(middle()).toEqual(ALL)
  })
})

describe('the line between two slices', () => {
  it('reads the pointer off a layer that never changes shape', async () => {
    /* Reported from a screen recording: with the pointer resting on the line between two slices the
       ring swapped between them, over and over, without the mouse moving. The drawing does not take the
       pointer, and every slice of the layer that does is drawn at the size a chosen one reaches,
       whatever is chosen. jsdom lays nothing out, so what is held is the arrangement. */
    renderDonut(TWO())

    const before = hitsNow().map((one) => one.getAttribute('d'))

    fireEvent.pointerEnter(first(hitsNow()), { pointerType: 'mouse' })

    await vi.waitFor(() => {
      expect(radii(first(slicesNow())).outer).toBe(97)
    })
    expect(hitsNow().map((one) => one.getAttribute('d'))).toEqual(before)
    expect(hitsNow().map((one) => radii(one).outer)).toEqual([97, 97])
  })
})
