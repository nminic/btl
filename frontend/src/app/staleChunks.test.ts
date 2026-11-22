import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RELOADED_FOR, reloadOnceWhenAPieceIsGone, type APage } from './staleChunks'

/* A PIECE OF THE PORTAL THAT A DEPLOY REPLACED (`app/staleChunks.ts`).

   THE AXES, and where the set-up keeps each pair apart:

   - the same piece failing twice against two different pieces, so „once per piece" can pass neither as
     „once ever" nor as „every time";
   - a tab that can remember against one whose storage refuses, so the reload that cannot be remembered is
     never made;
   - Vite's own event against any other failure on the page, so the reload is not something every error
     sets off. */

const A_PIECE = new TypeError('Failed to fetch dynamically imported module: /assets/Calendar-AAAA.js')
const ANOTHER_PIECE = new TypeError('Failed to fetch dynamically imported module: /assets/Rankings-BBBB.js')

function aPage(storage: Pick<Storage, 'getItem' | 'setItem'> = window.sessionStorage): {
  page: APage
  fire: (type: string, payload: unknown) => Event
  reload: ReturnType<typeof vi.fn>
} {
  const listeners = new Map<string, ((event: Event) => void)[]>()
  const reload = vi.fn()

  return {
    reload,
    page: {
      addEventListener: (type, listener) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener])
      },
      sessionStorage: storage,
      location: { reload },
    },
    fire: (type, payload) => {
      const event = new Event(type, { cancelable: true })

      Reflect.set(event, 'payload', payload)

      for (const listener of listeners.get(type) ?? []) {
        listener(event)
      }

      return event
    },
  }
}

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('a piece that is gone after a deploy', () => {
  it('reads the page again once, and says so to Vite, so the screen does not fail first', () => {
    const { page, fire, reload } = aPage()

    reloadOnceWhenAPieceIsGone(page)
    const event = fire('vite:preloadError', A_PIECE)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
    expect(window.sessionStorage.getItem(RELOADED_FOR)).toBe(String(A_PIECE))
  })

  it('does not read it again for the same piece, which a fresh page did not find either', () => {
    const { page, fire, reload } = aPage()

    reloadOnceWhenAPieceIsGone(page)
    fire('vite:preloadError', A_PIECE)
    const again = fire('vite:preloadError', A_PIECE)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(again.defaultPrevented, 'the second failure of one piece was hidden from the screen').toBe(false)
  })

  it('remembers across the reload, which is a new page reading the same tab', () => {
    const before = aPage()

    reloadOnceWhenAPieceIsGone(before.page)
    before.fire('vite:preloadError', A_PIECE)

    const after = aPage()

    reloadOnceWhenAPieceIsGone(after.page)
    after.fire('vite:preloadError', A_PIECE)

    expect(after.reload).not.toHaveBeenCalled()
  })

  it('reads it again once for another piece, after a later deploy', () => {
    const { page, fire, reload } = aPage()

    reloadOnceWhenAPieceIsGone(page)
    fire('vite:preloadError', A_PIECE)
    fire('vite:preloadError', ANOTHER_PIECE)

    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does nothing where the tab cannot remember, since a reload it cannot remember is the circle', () => {
    const refusing = {
      getItem: () => {
        throw new Error('storage refused')
      },
      setItem: () => {
        throw new Error('storage refused')
      },
    }
    const { page, fire, reload } = aPage(refusing)

    reloadOnceWhenAPieceIsGone(page)
    const event = fire('vite:preloadError', A_PIECE)

    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('answers no failure but the one Vite names', () => {
    const { page, fire, reload } = aPage()

    reloadOnceWhenAPieceIsGone(page)
    fire('error', A_PIECE)
    fire('unhandledrejection', A_PIECE)

    expect(reload).not.toHaveBeenCalled()
  })
})
