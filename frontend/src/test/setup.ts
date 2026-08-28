import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, vi } from 'vitest'
import { clearResourceCache } from '../data/client'
import { SLOW } from './slow'

/**
 * How long `findBy` and `waitFor` are given, which is the clock that really fires.
 *
 * A case has two of them. Vitest gives the case itself five seconds, and Testing
 * Library gives each `findBy` one, and it is the second that runs out first on
 * anything that draws a whole screen. Raising the first without the second is
 * raising the wrong one: the case is then allowed twenty seconds to reach an
 * assertion that gave up after one, and the gate comes back red with „Unable to
 * find role=table", which points at production code rather than at the clock.
 *
 * Measured by a review on 28.08.2026 on an untouched tree, in one full pass of the
 * gate out of three: `leagueResults > reaches across every column` failed at 1.314
 * milliseconds with exactly that message, while the case it sat in had twenty
 * seconds to spare.
 *
 * The same number as the case's own (`SLOW`), because it is the same fact about
 * the same runner and two numbers would drift apart. Raising it costs what every
 * such number costs: a genuinely missing element is reported later. That is paid
 * once per real failure, against a red gate that lied on every busy run.
 */
configure({ asyncUtilTimeout: SLOW })

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
