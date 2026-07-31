import '@testing-library/jest-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, vi } from 'vitest'
import { clearResourceCache } from '../data/client'

// The data layer caches a resource for the whole visit. Tests are separate
// visits, so each one starts from an empty cache. So does the day the portal is
// being read as, which the development switch leaves behind in the tab
// (src/clock/ClockProvider.tsx): a test that moved it must not move it for the
// next one.
beforeEach(() => {
  clearResourceCache()
  sessionStorage.clear()
})

/* The data layer fetches /mock/<name>.json, which the dev server and nginx
 * serve out of public/. In tests there is no server, so fetch reads the same
 * files off disk. Tests therefore run against the real generated data, not
 * against a hand-written fixture that could drift away from it. */
const PUBLIC_DIR = join(process.cwd(), 'public')

vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
  const path = String(input)

  try {
    const body = readFileSync(join(PUBLIC_DIR, path), 'utf-8')
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
  } catch {
    return new Response('not found', { status: 404 })
  }
})

/* jsdom has no matchMedia. The theme reads the system preference through it on
 * the first visit, so a stub is needed; tests that care override .matches. */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

/* jsdom lays nothing out, so it has no scrolling either, and calling scrollTo
 * prints "Not implemented" once per navigation. ScrollRestoration in the shell
 * calls it on every one of them, which buried the real output of the suite under
 * a few hundred lines of noise. A stub, because there is nothing to scroll: what
 * the shell does with the scroll is checked in the browser, not here. */
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() })
