import { act, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { must } from '../test/at'
import { setupUser } from '../test/user'
import { useColumns, useGrowing } from './growing'
import { LoadMore } from './LoadMore'

/**
 * A list that grows as it is read (owner, 11.08.2026).
 *
 * Scrolling is what the owner asked for and the button is what the thing is
 * made of: a keyboard has no scroll position, so a reader who tabs through the
 * page never fires the observer at all. Everything here goes through the
 * button, and the observer is asked separately, standing in for a browser jsdom
 * does not have.
 */

function Growing({ total, step }: { total: number; step: number }) {
  const { shown, whole, asked, more } = useGrowing(total, step)

  return (
    <>
      <ol aria-label="stvari">
        {Array.from({ length: shown }, (_, at) => (
          <li key={at}>{`stvar ${String(at + 1)}`}</li>
        ))}
      </ol>
      <LoadMore
        whole={whole}
        asked={asked}
        onMore={more}
        words={{
          more: 'Učitaj još',
          showing: `Prikazano ${String(shown)} od ${String(total)}`,
          whole: `To je svih ${String(total)}`,
        }}
      />
    </>
  )
}

function items(): number {
  return screen.getAllByRole('listitem').length
}

describe('a list that grows as it is read', () => {
  it('shows one step of it, and offers the rest', () => {
    render(<Growing total={25} step={10} />)

    expect(items()).toBe(10)
    expect(screen.getByRole('button', { name: 'Učitaj još' })).toBeVisible()
  })

  it('says nothing at all until somebody has asked for more', () => {
    /* The first ten arrived with the page. A status message about them is a
       message about nothing, read out to somebody who has just been read the
       whole list. */
    render(<Growing total={25} step={10} />)

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('grows by a step at a time, and says how far it has got', () => {
    const user = setupUser()
    render(<Growing total={25} step={10} />)

    return user.click(screen.getByRole('button', { name: 'Učitaj još' })).then(() => {
      expect(items()).toBe(20)
      /* Said out loud, because a list that grows under a reader who cannot see
         it has said nothing at all (WCAG 2.2 SC 4.1.3). */
      expect(screen.getByRole('status')).toHaveTextContent('Prikazano 20 od 25')
    })
  })

  it('says when there is nothing more, rather than simply stopping', async () => {
    /* A list that stops has not told anybody whether it ended or broke. */
    const user = setupUser()
    render(<Growing total={25} step={10} />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))

    expect(items()).toBe(25)
    expect(screen.queryByRole('button', { name: 'Učitaj još' })).toBeNull()
    expect(screen.getByText('To je svih 25')).toBeVisible()
  })

  it('offers nothing where one step is the whole of it', () => {
    render(<Growing total={4} step={10} />)

    expect(items()).toBe(4)
    expect(screen.queryByRole('button', { name: 'Učitaj još' })).toBeNull()
    expect(screen.getByText('To je svih 4')).toBeVisible()
  })

  it('never shows more than there is, however far it was grown', async () => {
    /* A list shrinks under a reader: a filter narrows it, a moderator takes a
       comment down. Grown to thirty and then handed four, what is on screen has
       to be four and not four with twenty six blanks after it. */
    const user = setupUser()
    const { rerender } = render(<Growing total={25} step={10} />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    expect(items()).toBe(20)

    rerender(<Growing total={4} step={10} />)

    expect(items()).toBe(4)
  })
})

/* The foot of the list coming into view is a browser's answer, and jsdom has
 * none, so it is stood in for the way the rulebook's reading position is
 * (pages/Rulebook.test.tsx). */
describe('the foot of the list coming into view', () => {
  let watch: IntersectionObserverCallback | undefined
  /* How many are watching right now, rather than whether one was ever taken
     down: an effect that re-runs disconnects on its way out, so "it
     disconnected" is true of a component that goes straight on watching. */
  let watching = 0

  class FakeObserver {
    constructor(callback: IntersectionObserverCallback) {
      watch = callback
    }

    observe() {
      watching += 1
    }

    disconnect() {
      watching -= 1
    }
  }

  beforeEach(() => {
    watch = undefined
    watching = 0
    vi.stubGlobal('IntersectionObserver', FakeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function comesIntoView(isIntersecting: boolean) {
    await waitFor(() => {
      expect(watch).toBeDefined()
    })

    act(() => {
      must(watch, 'the watcher')(
        [{ isIntersecting }] as unknown as IntersectionObserverEntry[],
        null as never,
      )
    })
  }

  it('grows the list, which is the scrolling the owner asked for', async () => {
    render(<Growing total={25} step={10} />)

    await comesIntoView(true)

    expect(items()).toBe(20)
  })

  it('grows nothing while the foot is somewhere below the window', async () => {
    render(<Growing total={25} step={10} />)

    await comesIntoView(false)

    expect(items()).toBe(10)
  })

  it('stops watching once there is nothing left to fetch', async () => {
    const user = setupUser()
    render(<Growing total={15} step={10} />)

    expect(watching).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))

    /* Nobody is watching, rather than somebody having stopped and started
       again: the whole list is on screen and the foot of it is going to be in
       view for as long as the reader stays there. */
    await waitFor(() => {
      expect(watching).toBe(0)
    })
  })

  it('holds up where the browser has no observer at all', () => {
    /* The button is the mechanism and the observer is laid over it, so a
       rendering without one is a list that still grows. */
    vi.stubGlobal('IntersectionObserver', undefined)

    render(<Growing total={25} step={10} />)

    expect(screen.getByRole('button', { name: 'Učitaj još' })).toBeVisible()
  })
})

/* How many things stand across one row, which is how the ducats are counted:
 * the owner asked for five rows and a row is six across on a desktop and two on
 * a telephone. */
describe('the columns of a wall', () => {
  function Wall({ columns }: { columns: string }) {
    const wall = useRef<HTMLUListElement>(null)
    const across = useColumns(wall)

    return (
      <>
        <ul ref={wall} style={{ gridTemplateColumns: columns }} aria-label="zid" />
        <p>{`kolona: ${String(across)}`}</p>
      </>
    )
  }

  class FakeResizeObserver {
    /* Written as a field and an assignment rather than a parameter property:
       this project compiles with `erasableSyntaxOnly`, so a constructor that
       declares a field is a syntax it will not take. */
    private readonly callback: () => void

    constructor(callback: () => void) {
      this.callback = callback
    }

    observe() {
      this.callback()
    }

    disconnect() {}
  }

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('counts the tracks the browser laid out', async () => {
    render(<Wall columns="1fr 1fr 1fr 1fr 1fr 1fr" />)

    expect(await screen.findByText('kolona: 6')).toBeVisible()
  })

  it('stands where it was where there is no layout to read', () => {
    /* jsdom computes none, and neither does a first render. One, so a list that
       cannot measure itself shows the fewest rows rather than the most. */
    render(<Wall columns="" />)

    expect(screen.getByText('kolona: 1')).toBeVisible()
  })

  it('holds up where the browser has no resize observer', () => {
    vi.stubGlobal('ResizeObserver', undefined)

    render(<Wall columns="1fr 1fr" />)

    expect(screen.getByText('kolona: 1')).toBeVisible()
  })
})
