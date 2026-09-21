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

/* The data layer fetches /api/<name>, which on QA is Spring and in development is
 * the proxy in front of it. In tests there is no server, so a request for a
 * resource is answered off the disc out of the generated file of the same name.
 * Tests therefore run against the real generated data, not against a hand-written
 * fixture that could drift away from it.
 *
 * **The ADDRESS IS THE APPLICATION'S AND THE ANSWER IS THE DISC'S, and the two are
 * kept apart on purpose.** Until 21.09.2026 they were the same thing: the portal
 * asked for `/mock/teams.json` and that was a path under `public/`. It asks for
 * `/api/teams` now, so this is the one place that knows the generated file is
 * where a test's answer comes from, and every case that cares about the address
 * asks what was ASKED FOR (`test/serverAnswers.ts`, `asked`) rather than what came
 * back.
 *
 * **What this does NOT do, said out loud because it is the thing a green suite
 * could be hiding.** It does not reduce the file to what the server really
 * answers: `competitors.json` still carries `active` and a member whose fee has
 * lapsed, `pairs.json` still carries `since`, `teams.json` still carries a seat for
 * everybody. None of the three is READ any more - they are out of the types, so
 * the compiler refuses a screen that reaches for one - and the cases that turn on
 * the real answer build it themselves rather than trusting this
 * (`profile/visible.test.ts`, `data/realAnswer.test.tsx`). A field the answer does
 * not carry and the portal does not read is exactly what a real extra column on a
 * real table is, and it is handled the same way: ignored.
 *
 * Anything that is not a resource - a picture, a write, `/api/me` - has no file and
 * is answered 404 here, which is what it was before and is why `serverAnswers.ts`
 * exists. */
const PUBLIC_DIR = join(process.cwd(), 'public')

/** Which file under `public/` answers an address: the generated record of a
 *  resource, and otherwise the path itself, which is how a picture is still read. */
function fileFor(path: string): string {
  const resource = /^\/api\/([a-z]+)$/.exec(path)

  return resource === null ? path : `/mock/${resource[1] ?? ''}.json`
}

vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
  const at = fileFor(String(input))

  try {
    const body = readFileSync(join(PUBLIC_DIR, at), 'utf-8')
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
