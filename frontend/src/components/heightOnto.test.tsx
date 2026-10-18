import { useRef } from 'react'
import { render, screen } from '@testing-library/react'
import { useHeightOnto } from './heightOnto'

/**
 * ONE ELEMENT'S HEIGHT WRITTEN ONTO ANOTHER, AND KEPT WRITTEN.
 *
 * <p>jsdom lays nothing out and has no `ResizeObserver`, so the observer is stood in for, and the
 * measured element is handed a height of its own: what is held is that the height of THE ONE
 * MEASURED lands on THE OTHER, once at once and again whenever the observer says it changed. What a
 * browser makes of it is `geometry/paySlip.geometry.ts`'s.
 */

let watched: Element[] = []
let changed: (() => void) | null = null

class FakeResizeObserver {
  /* A field and an assignment rather than a parameter property: this project compiles with
     `erasableSyntaxOnly` (`components/loadMore.test.tsx` says the same). */
  private readonly callback: () => void

  constructor(callback: () => void) {
    this.callback = callback
  }

  observe(what: Element) {
    watched.push(what)
    changed = this.callback
  }

  disconnect() {
    watched = []
    changed = null
  }
}

function Probe({ attached = true }: { attached?: boolean }) {
  const onto = useRef<HTMLDivElement>(null)
  const of = useRef<HTMLDivElement>(null)

  useHeightOnto('--measured', of, onto)

  return (
    <div role="group" aria-label="onto" ref={attached ? onto : undefined}>
      <div role="group" aria-label="other" />
      <div role="group" aria-label="of" ref={attached ? of : undefined} />
    </div>
  )
}

/** A height for the measured element, read the way the hook reads it. */
function heightOf(name: string, height: number): void {
  const element = screen.getByRole('group', { name })

  element.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 10, height })
}

beforeEach(() => {
  watched = []
  changed = null
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a height written onto another element', () => {
  it('is the measured one’s, written at once, and again each time it changes', () => {
    const { rerender } = render(<Probe />)

    /* At once: what jsdom answers for a box it never laid out, which is nought. */
    expect(screen.getByRole('group', { name: 'onto' }).style.getPropertyValue('--measured')).toBe('0px')
    /* And the one watched is the one measured, and not its neighbour or the one written on. */
    expect(watched).toEqual([screen.getByRole('group', { name: 'of' })])

    heightOf('of', 159.125)
    heightOf('other', 999)
    changed?.()

    expect(screen.getByRole('group', { name: 'onto' }).style.getPropertyValue('--measured')).toBe('159.125px')
    expect(screen.getByRole('group', { name: 'other' }).style.getPropertyValue('--measured')).toBe('')

    rerender(<Probe />)
    expect(watched).toHaveLength(1)
  })

  it('stops watching when it goes', () => {
    const { unmount } = render(<Probe />)

    unmount()

    expect(watched).toEqual([])
    expect(changed).toBeNull()
  })

  it('writes nothing where the browser has no resize observer', () => {
    vi.stubGlobal('ResizeObserver', undefined)

    render(<Probe />)

    expect(screen.getByRole('group', { name: 'onto' }).style.getPropertyValue('--measured')).toBe('')
  })

  it('writes nothing where there is nothing to measure or nothing to write on', () => {
    render(<Probe attached={false} />)

    expect(watched).toEqual([])
    expect(screen.getByRole('group', { name: 'onto' }).style.getPropertyValue('--measured')).toBe('')
  })
})
