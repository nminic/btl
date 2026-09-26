import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES } from '../data/client'
import { aCompetitor, asAnswered, myOwnRow } from './theAnswer'

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
 * Whether an address is one of the fourteen resources rather than a write or a
 * question about the visit.
 *
 * **Why this exists at all, and it is the switch of 21.09.2026 rather than a
 * convenience.** Until that day a resource lived under `/mock` and everything the
 * portal spent on the server lived under `/api`, so „did this screen speak to the
 * server" was answerable with `path.startsWith('/api')`. Three cases were written
 * that way and all three are about a screen that must spend NOTHING: two say a
 * password link that carries no token asks for nothing, and one answers 404 to
 * everything the screen is not meant to reach.
 *
 * Both kinds are under `/api` now, so that question has to be asked in two words.
 * Derived from `RESOURCE_NAMES` and never listed, so a fifteenth resource is one of
 * these on the day it is added rather than on the day somebody remembers.
 */
export function isResource(path: string): boolean {
  return RESOURCE_NAMES.some((name) => path === `/api/${name}`)
}

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

/**
 * What a route answers when it refused and named why.
 *
 * <p><b>The number is an argument because one refusal on the portal does not use 400.</b>
 * `/api/registration` answers 409 for `theAddressIsTaken` and 400 for its other two.
 * Nailed to 400, this helper could not express that refusal at all, so the case about a
 * taken address would have had to build its own `Response` - and a case that builds its
 * own body is a case that can quietly stop looking like what the server really sends.
 * The default is 400 because that is what most of them are, so no existing caller moves.
 */
export function refused(reason: string, status = 400): Response {
  return new Response(JSON.stringify({ reason }), {
    status,
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

/**
 * THE MEMBERS `/api/competitors` REALLY ANSWERS WITH, in front of the disc reader
 * for the length of one case.
 *
 * **Why a case has to build this and cannot read it.** `test/setup.ts` answers a
 * request for a resource out of the generated file of the same name, which is what
 * keeps the suite running against real data rather than a fixture. That file is
 * older than the resource it now stands in for, and it still carries a member whose
 * fee has lapsed, with a flag saying so. The server carries neither: the owner
 * closed it on 13.09.2026, so a member whose fee has run out is not on the list at
 * all, and `CompetitorApi` says why in one line - nothing may be read out of the
 * DIFFERENCE between one answer and another.
 *
 * So a case about what happens to somebody the portal no longer has must be given
 * the answer the portal will really get, and a case that read the flag instead
 * would be measuring the file rather than the portal. This is the one place that
 * knows the two differ.
 *
 * @returns the numbers of the members the answer leaves out, and the way to put the
 *          disc reader back
 */
export function membersAsServed(mine?: string): { lapsed: string[]; stop: () => void } {
  const file: FileMember[] = JSON.parse(
    readFileSync(join(process.cwd(), 'public/mock/competitors.json'), 'utf-8'),
  )

  const lapsed = file.filter((one) => !one.active).map((one) => one.memberNumber)

  /* **NO LIST OF FIELDS TO TAKE AWAY, AND THAT IS THE POINT** (21.09.2026). This kept
     one, and a hand-written list is the thing that goes short: `active` was on it,
     `referredBy` was on it, and `membershipBasis` was not, so a member's own fee screen
     went on reading a field the server does not give him with every case green. What is
     kept now is the KEYS of the record the server declares (`test/theAnswer.ts`), so a
     field the answer has not got has no key to be copied into and nothing has to
     remember it. */
  /* EVERY ROW THE SAME SINCE 25.09.2026, and the caller is still named because a case
     that asks „as whom" and gets „it makes no difference" is the claim P26a bought.
     Until that day his own row carried two fields more and the count had to be worked
     out here the way the server's SQL works it out; `meAnswering` is where both live
     now, because `/api/me` is where the server answers them. */
  const answered = file
    .filter((one) => one.active)
    .map((row) => asAnswered(row, row.memberNumber === mine ? myOwnRow : aCompetitor))

  const { stop } = serverThat((path) =>
    path === '/api/competitors'
      ? new Response(JSON.stringify(answered), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      : null,
  )

  return { lapsed, stop }
}

/**
 * The generated record, in the names the answer does not carry.
 *
 * `referralCode` and `referredBy` are both here and both are the file's: since 25.09.2026
 * neither leaves through this resource for anybody, and the count they used to produce is
 * `/api/me`'s (`test/setup.ts`, `broughtIn`).
 */
type FileMember = {
  memberNumber: string
  active: boolean
}
