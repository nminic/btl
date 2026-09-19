/**
 * A SERVER, FOR THE TWO SCREENS THAT HAVE ONE.
 *
 * Everything else on the portal reads generated files, and `test/setup.ts` answers
 * those off the disc. These helpers stand in front of that reader rather than
 * replacing it: what a case names is answered here, and everything else - the mock
 * the shell itself asks for while a screen is mounted - goes on to the disc exactly
 * as it did. Replacing it outright leaves every screen inside the shell empty, which
 * is a different fault reported as this one.
 *
 * `vi.unstubAllGlobals` is deliberately not used to put it back, for the reason
 * `pages/publicData.test.tsx` measured: it reverts to what stood before the setup
 * file installed the disc reader, which leaves every later case in the file with no
 * fetch at all.
 */

export type Asked = { path: string; init: RequestInit | undefined }

/**
 * Puts a server in front of the disc reader for the length of one case.
 *
 * @param answers what to answer, or null to let the disc reader have it. A promise
 *                is an answer that has not come back yet, which is the only way to
 *                measure what a screen does while it is waiting.
 * @returns everything that was asked for, in order, and the way to put it back
 */
export function serverThat(
  answers: (path: string, init: RequestInit | undefined) => Response | Promise<Response> | null,
): { asked: Asked[]; stop: () => void } {
  const asked: Asked[] = []
  const disc = globalThis.fetch

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)

    asked.push({ path, init })

    return answers(path, init) ?? disc(input, init)
  }

  return {
    asked,
    stop: () => {
      globalThis.fetch = disc
    },
  }
}

/** What both routes answer when they did the thing. */
export function did(): Response {
  return new Response(null, { status: 204 })
}

/** What a route answers when it refused and named why. */
export function refused(reason: string): Response {
  return new Response(JSON.stringify({ reason }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  })
}

/** An answer with nothing but a number on it. */
export function answeredWith(status: number): Response {
  return new Response(null, { status })
}

/**
 * Every cookie this document is holding, gone.
 *
 * jsdom keeps them for the whole file, so a case that leaves one behind decides what
 * the next case measures: the very shape this helper exists to make testable is
 * "there is no token yet".
 */
export function forgetEveryCookie(): void {
  for (const one of document.cookie.split(';')) {
    const name = (one.split('=')[0] ?? '').trim()

    if (name !== '') {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
  }
}
