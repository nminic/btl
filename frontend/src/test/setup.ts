import '@testing-library/jest-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, vi } from 'vitest'
import { clearResourceCache } from '../data/client'

// The data layer caches a resource for the whole visit. Tests are separate
// visits, so each one starts from an empty cache.
beforeEach(() => {
  clearResourceCache()
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
