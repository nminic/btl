import { describe, expect, it, vi } from 'vitest'
import { reloadOnceWhenAPieceIsGone, type APage } from './staleChunks'

/* A PIECE OF THE PORTAL THAT A DEPLOY REPLACED (`app/staleChunks.ts`).

   THE AXES, and where the set-up keeps each pair apart:

   - how the browser says the page was loaded: by following a link or an address, from the history, by a
     reload, or it does not say at all. Only the first two are read again, so „once" can pass neither as
     „never" nor as „every time";
   - Vite's own event against any other failure on the page, so the reload is not something every error
     sets off. */

const A_PIECE = new TypeError('Failed to fetch dynamically imported module: /assets/Calendar-AAAA.js')

function aPage(loaded: unknown[]): {
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
      location: { reload },
      performance: { getEntriesByType: (type) => (type === 'navigation' ? loaded : []) },
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

describe('a piece that is gone after a deploy', () => {
  it.each(['navigate', 'back_forward'])(
    'reads a page loaded by %s again once, and says so to Vite, so the screen does not fail first',
    (how) => {
      const { page, fire, reload } = aPage([{ type: how }])

      reloadOnceWhenAPieceIsGone(page)
      const event = fire('vite:preloadError', A_PIECE)

      expect(reload).toHaveBeenCalledTimes(1)
      expect(event.defaultPrevented).toBe(true)
    },
  )

  it('does not read again a page that a reload brought, which a fresh page did not find the piece on either', () => {
    const { page, fire, reload } = aPage([{ type: 'reload' }])

    reloadOnceWhenAPieceIsGone(page)
    const event = fire('vite:preloadError', A_PIECE)

    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented, 'the failure was hidden from the screen and nothing was done').toBe(false)
  })

  it('does nothing where the browser does not say how the page was loaded, since that is the circle', () => {
    for (const loaded of [[], [{}], [{ type: 7 }]]) {
      const { page, fire, reload } = aPage(loaded)

      reloadOnceWhenAPieceIsGone(page)
      const event = fire('vite:preloadError', A_PIECE)

      expect(reload, JSON.stringify(loaded)).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    }
  })

  it('answers no failure but the one Vite names', () => {
    const { page, fire, reload } = aPage([{ type: 'navigate' }])

    reloadOnceWhenAPieceIsGone(page)
    fire('error', A_PIECE)
    fire('unhandledrejection', A_PIECE)

    expect(reload).not.toHaveBeenCalled()
  })
})
