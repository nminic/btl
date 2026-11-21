import { act, screen, within } from '@testing-library/react'
import { setupUser } from '../test/user'
import { matchingMedia } from '../test/media'
import { renderAt } from '../test/render'
import { TWO_COLUMNS } from './home/rowsThatFit'

/**
 * THE ORDER OF THE FRONT PAGE'S MARKUP IS THE ORDER IT IS SEEN IN, ON BOTH LAYOUTS (ADL A7, owner, 21.11.2026:
 * „Kod prati ekran").
 *
 * Under 860px one column, written as a phone shows it since 31.07.2026: the boards, the figures of the
 * season, the turning chart, what is next, the address, the sponsor of the day, the calculator. From 860px
 * two columns, written as they stand: left, from the top, the Top 10 boards, then the turning chart, then
 * the address of the president (PDL P24: „Levo, od vrha: Top 10 …, pa rotirajući grafikon, pa obraćanje
 * predsednika"); right, the figures, what is next, the sponsor, the calculator. The stylesheet moves nothing
 * (`home/homeLayoutStyle.test.ts`), and `geometry/frontPage.geometry.ts` holds in Chrome that on a phone the
 * order of the markup is the order of the eye.
 */

const BOXES = ['boards', 'figures', 'chart', 'next', 'address', 'sponsor', 'calc']

/** The boxes among the children of an element, by the name they carry, in the order they are written. */
function boxesOf(element: Element): string[] {
  return [...element.children].flatMap((one) => {
    const found = BOXES.find((name) => one.classList.contains(`home__${name}`))

    return found === undefined ? [] : [found]
  })
}

async function draw(wide: boolean) {
  const previous = window.matchMedia

  window.matchMedia = matchingMedia((query) => wide && query === TWO_COLUMNS)
  renderAt('/sr')

  await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })

  return () => {
    window.matchMedia = previous
  }
}

function split(): Element {
  const found = document.querySelector('.home__split')

  if (found === null) {
    throw new Error('the front page has no grid')
  }

  return found
}

describe('the markup of the front page', () => {
  it('is one column in the order a phone shows, under the width of two columns', async () => {
    const restore = await draw(false)

    try {
      expect(document.querySelector('.home__colL')).toBeNull()
      expect(document.querySelector('.home__colR')).toBeNull()
      expect(boxesOf(split())).toEqual(['boards', 'figures', 'chart', 'next', 'address', 'calc'])
    } finally {
      restore()
    }
  })

  it('is two columns from the width of two columns, the chart between the boards and the address', async () => {
    const restore = await draw(true)

    try {
      const left = document.querySelector('.home__colL')
      const right = document.querySelector('.home__colR')

      expect(left).not.toBeNull()
      expect(right).not.toBeNull()
      expect(boxesOf(left ?? split())).toEqual(['boards', 'chart', 'address'])
      expect(boxesOf(right ?? split())).toEqual(['figures', 'next', 'calc'])
      expect(boxesOf(split())).toEqual([])
    } finally {
      restore()
    }
  })
})

/** A window whose width can change after the page is drawn: the answer of the query, and everybody who asked. */
function aWindow(wide: boolean) {
  let now = wide
  const listening = new Set<EventListener>()

  window.matchMedia = (query) => ({
    get matches() {
      return now && query === TWO_COLUMNS
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listening.add(listener)
      }
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listening.delete(listener)
      }
    },
    dispatchEvent: () => true,
  })

  return {
    /** The window is widened or narrowed, and the browser tells whoever asked. */
    become(next: boolean) {
      now = next
      act(() => {
        for (const told of listening) {
          told(new Event('change'))
        }
      })
    },
  }
}

describe('the front page while its window changes width', () => {
  const previous = window.matchMedia

  afterEach(() => {
    window.matchMedia = previous
  })

  /* A reader turns a tablet or drags a window across 860px with the page open: the browser says so through the
     query and the page writes itself in the other order, without being asked again. */
  it('is written again in the other order when the answer of the query changes after it was drawn', async () => {
    const view = aWindow(false)

    renderAt('/sr')
    await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })
    expect(boxesOf(split())).toEqual(['boards', 'figures', 'chart', 'next', 'address', 'calc'])

    view.become(true)

    expect(boxesOf(document.querySelector('.home__colL') ?? split())).toEqual(['boards', 'chart', 'address'])
    expect(boxesOf(document.querySelector('.home__colR') ?? split())).toEqual(['figures', 'next', 'calc'])

    view.become(false)

    expect(document.querySelector('.home__colL')).toBeNull()
    expect(boxesOf(split())).toEqual(['boards', 'figures', 'chart', 'next', 'address', 'calc'])
  })

  /* Owner, 21.11.2026: only a chosen length and the chart go back to their beginning when the page is written
     again. What somebody typed into the calculator and where their cursor was stay. */
  it('keeps what was typed in the calculator, and the cursor in it, across the width of two columns', async () => {
    const user = setupUser()
    const view = aWindow(true)

    renderAt('/sr')
    await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })

    const calc = () => screen.getByRole('region', { name: 'BTL kalkulator' })

    await user.type(within(calc()).getByLabelText('Dužina (km)'), '10')
    await user.type(within(calc()).getByLabelText('Uspon (m)'), '100')
    await user.type(within(calc()).getByLabelText('Spust (m)'), '50')

    expect(within(calc()).getByLabelText('Spust (m)')).toHaveFocus()

    view.become(false)

    expect(within(calc()).getByLabelText('Dužina (km)')).toHaveValue('10')
    expect(within(calc()).getByLabelText('Uspon (m)')).toHaveValue('100')
    expect(within(calc()).getByLabelText('Spust (m)')).toHaveValue('50')
    expect(within(calc()).getByLabelText('Spust (m)')).toHaveFocus()
    // And it stands in the box of the page where it belongs, the last of the one column.
    expect(boxesOf(split()).at(-1)).toBe('calc')
    expect(document.querySelector('.home__calc')?.contains(calc())).toBe(true)
  })

  it('puts the focus back on the same thing in a widget that is written again', async () => {
    const user = setupUser()
    const view = aWindow(true)

    renderAt('/sr')
    await screen.findByRole('heading', { level: 2, name: 'Priprema, pozor, SAD!' })

    await user.click(screen.getByRole('button', { name: 'Ultra, Ultramaraton' }))
    expect(screen.getByRole('button', { name: 'Ultra, Ultramaraton' })).toHaveFocus()

    view.become(false)

    // A new element, the filter at its beginning (accepted), and the focus on the same button of it.
    expect(screen.getByRole('button', { name: 'Ultra, Ultramaraton' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Ultra, Ultramaraton' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Sve distance' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('leaves the focus alone where it was never in a widget that is written again', async () => {
    const user = setupUser()
    const view = aWindow(true)

    renderAt('/sr')
    await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })
    await user.click(document.body)

    view.become(false)

    expect(document.body).toHaveFocus()
  })
})
