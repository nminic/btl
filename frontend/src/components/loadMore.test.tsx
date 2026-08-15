import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, render, screen, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import { must } from '../test/at'
import { intersecting, watcher } from '../test/intersection'
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

function Growing({ total, step, over = '' }: { total: number; step: number; over?: string }) {
  const { shown, whole, asked, more } = useGrowing(total, step, over)

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

/**
 * The same list with filters over it, which is where the focus goes wrong.
 *
 * A filter is a control the reader is standing on when they press it, and that
 * is the whole of what these tests measure: a rerender changes the list without
 * anybody standing anywhere, so it can prove that the focus did not move and
 * never that it was not stolen.
 *
 * `named` is whether the list says what it is of as well as how long it is,
 * which is the difference between telling two equally long filters apart and
 * not (components/growing.ts).
 */
function Filtering({ sizes, step, named = false }: { sizes: number[]; step: number; named?: boolean }) {
  const [at, setAt] = useState(0)

  return (
    <>
      {sizes.map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => {
            setAt(index)
          }}
        >
          {`filter ${String(index + 1)}`}
        </button>
      ))}
      <Growing total={must(sizes[at], 'the size of the chosen filter')} step={step} over={named ? `filter-${String(at)}` : ''} />
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

  it('follows a step that arrives after the first render', async () => {
    /* The ducats are counted in rows and how many stand across is measured off
       the grid one render after the first, so the step the state was seeded
       with is one column's worth. Held to the step as it is now: seeded and
       forgotten, five rows of six was permanently five ducats, and neither the
       first page nor any boundary after it was a whole number of rows. */
    const { rerender } = render(<Growing total={40} step={5} />)

    expect(items()).toBe(5)

    rerender(<Growing total={40} step={30} />)

    expect(items()).toBe(30)
  })

  it('does not shrink when the step shrinks under a list already grown', async () => {
    /* The other direction: a window narrowed from six columns to two must not
       take back what the reader has already been shown. */
    const user = setupUser()
    const { rerender } = render(<Growing total={40} step={12} />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    expect(items()).toBe(24)

    rerender(<Growing total={40} step={4} />)

    expect(items()).toBe(24)
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

/* Where the focus lands when a list becomes whole, which is the one thing about
 * this mechanism that nothing on screen shows and that three attempts got
 * wrong.
 *
 * The closing sentence takes the focus when a reader reaches the end, because
 * the button they were standing on has just been replaced by it and a keyboard
 * reader would otherwise be dropped at the top of the document (WCAG 2.2 SC
 * 2.4.3). It must not take the focus when the list became whole by itself,
 * which on a table with filters over it happens every time somebody presses
 * one: the reader is standing on the filter and gets thrown to the foot of the
 * table (SC 3.2.2).
 *
 * Both of the earlier attempts passed every test in this file. The first
 * remembered a plain yes; the second remembered the length the asking was about
 * and compared it, which is true again the moment a reader widens a filter back
 * to where they started. So each of these presses a control and then asks where
 * the focus is, which is the only question that separates the three.
 */
describe('the focus, when a list becomes whole', () => {
  const end = (total: number) => screen.getByText(`To je svih ${String(total)}`)

  it('stays on the filter that made the list whole', async () => {
    /* The plain case, and the one that has to be measured at the moment the
       foot of the list changes: the sentence takes the focus in an effect that
       runs when „whole" turns true, so a test where it was already true proves
       nothing at all. Half way down a list of forty, press a filter leaving
       fifteen. The list becomes whole under a reader standing on the filter,
       and the reader stays on the filter. */
    const user = setupUser()

    render(<Filtering sizes={[40, 15]} step={10} />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    expect(screen.getByRole('button', { name: 'Učitaj još' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'filter 2' }))

    expect(screen.getByRole('button', { name: 'filter 2' })).toHaveFocus()
    expect(end(15)).not.toHaveFocus()
  })

  it('follows the reader who read to the end', async () => {
    const user = setupUser()
    render(<Growing total={15} step={10} />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))

    expect(end(15)).toHaveFocus()
  })

  it('stays where it is when the list becomes whole under the reader', async () => {
    /* Nobody asked. The button was never pressed, the list simply became short
       enough to hold in one, and taking the focus to a sentence at the foot of
       it moves a reader who touched nothing. */
    const user = setupUser()
    const { rerender } = render(<Growing total={40} step={10} />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    rerender(<Growing total={5} step={10} />)

    expect(end(5)).not.toHaveFocus()
  })

  it('stays on the filter that was pressed, even one widened back to where it began', async () => {
    /* The case the second attempt let through, and the reason `asked` is
       cleared by the change rather than checked against a length. Read a table
       of 229 to the end, narrow it to marathons, then widen it back: the total
       is 229 again, so „I asked about 229" came back true and the focus jumped
       to the foot of the table from a filter nobody had pressed twice.

       Pressed rather than rerendered, because where the focus was before is the
       whole of the question: a reader who reached the end is standing on the
       closing sentence and can hardly be thrown off it, and a reader who
       pressed a filter is standing on the filter. */
    const user = setupUser()

    render(<Filtering sizes={[25, 4, 25]} step={10} />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    expect(end(25)).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'filter 2' }))
    await user.click(screen.getByRole('button', { name: 'filter 3' }))

    expect(screen.getByRole('button', { name: 'filter 3' })).toHaveFocus()
    expect(end(25)).not.toHaveFocus()
  })

  it('goes quiet about a filter of the same size as the last one', async () => {
    /* Two filters of equal length cannot steal the focus from each other, since
       nothing about the foot of the list changes: what they can do is speak. A
       reader who pressed „Ultramaraton" and hears „Prikazano 20 od 25" has been
       told how far they have read through a list they have not read at all
       (WCAG 2.2 SC 4.1.3).

       A length is not an identity, and on a table of results by category there
       is nothing unusual about two of them holding the same number of races. So
       the list is told what it is of, which is what separates the two here. */
    const user = setupUser()

    render(<Filtering sizes={[25, 25]} step={10} named />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    expect(screen.getByRole('status')).toHaveTextContent('Prikazano 20 od 25')

    await user.click(screen.getByRole('button', { name: 'filter 2' }))

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('is told what the list is of by the one screen that has filters', () => {
    /* The argument only helps where it is actually passed, and the tests above
       pass it themselves from a harness of their own. A review took it off the
       real call and watched all 1888 tests pass with coverage still at 100 per
       cent, which is the same shape of hole as every other finding this week.

       Read off the source, because nothing on the profile can show it: with
       today`s data no two of that member`s filters hold the same number of
       races, so the screen behaves identically either way, and it is the day
       somebody`s results happen to line up that this stops being true. */
    const profile = readFileSync(join(process.cwd(), 'src/pages/CompetitorProfile.tsx'), 'utf-8')
    const call = must(/useGrowing\(([^)]*)\)/.exec(profile), 'the call that grows the table')[1]

    expect(call).toContain('params')
    expect(must(call, 'the arguments').split(',')).toHaveLength(3)
  })

  it('goes on talking where it is told only how long the list is', async () => {
    /* The limit of counting, held as a test rather than as a sentence nobody
       would check. Told nothing but a length, two filters of equal size are one
       list and the announcement stands. This is why `useGrowing` takes what the
       list is of and why the profile hands it both of its filters
       (pages/CompetitorProfile.tsx); left unproved, that argument reads as belt
       and braces and the next tidy-up takes it out. */
    const user = setupUser()

    render(<Filtering sizes={[25, 25]} step={10} />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    await user.click(screen.getByRole('button', { name: 'filter 2' }))

    expect(screen.getByRole('status')).toHaveTextContent('Prikazano 20 od 25')
  })

  it('says nothing about a list the reader has not asked about', async () => {
    /* The same fact, heard rather than seen. The live region speaks only to
       somebody who pressed the button, so a filter that quietly makes a list
       whole must not announce how much of it is showing either. */
    const user = setupUser()
    const { rerender } = render(<Growing total={25} step={10} />)

    await user.click(screen.getByRole('button', { name: 'Učitaj još' }))
    expect(screen.getByRole('status')).toHaveTextContent('Prikazano 20 od 25')

    rerender(<Growing total={4} step={10} />)

    expect(screen.getByRole('status')).toHaveTextContent('')
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
      must(watch, 'the watcher')([intersecting({ isIntersecting })], watcher())
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

  /* What the wall was measured against, and how many are watching it. Counted,
     because `useColumns` measures once by hand before it starts watching: a
     version that never observed anything passed every test here, and turning a
     telephone sideways is exactly the case that needs the watching. */
  let watched: Element[] = []

  class FakeResizeObserver {
    /* Written as a field and an assignment rather than a parameter property:
       this project compiles with `erasableSyntaxOnly`, so a constructor that
       declares a field is a syntax it will not take. */
    private readonly callback: () => void

    constructor(callback: () => void) {
      this.callback = callback
    }

    observe(what: Element) {
      watched.push(what)
      this.callback()
    }

    disconnect() {
      watched = []
    }
  }

  beforeEach(() => {
    watched = []
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('counts the tracks the browser laid out, and goes on watching the wall', async () => {
    render(<Wall columns="1fr 1fr 1fr 1fr 1fr 1fr" />)

    expect(await screen.findByText('kolona: 6')).toBeVisible()
    /* The wall itself, and not something else: a row of five ducats is five
       rows at one across and one row at five, and which it is changes when the
       window does. */
    expect(watched).toEqual([screen.getByRole('list', { name: 'zid' })])
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
