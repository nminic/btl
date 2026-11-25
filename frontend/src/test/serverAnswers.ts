import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addressOf, ONE_MEMBERS_DOORS, RESOURCE_NAMES } from '../data/client'
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
  /* AND ONE MEMBER'S ANSWER OF A NAME (`ONE_MEMBERS_DOORS`, since 22.11.2026), which is a narrower answer
     of that resource and not a write, for the reason a query is: the profile reads its member's runs
     there, and a case that answered every address that is no resource with 404 left the profile with
     nothing to draw. Built by `addressOf` itself, so the two cannot spell the address differently. */
  const asked = withoutTheQuery(path)
  const his = /^\/api\/competitors\/([^/]+)\//.exec(asked)

  return (
    RESOURCE_NAMES.some((name) => asked === `/api/${name}`) ||
    (his !== null && ONE_MEMBERS_DOORS.some((door) => asked === addressOf(door, undefined, decodeURIComponent(his[1] ?? ''))))
  )
}

/**
 * The address without what was asked OF it.
 *
 * <p><b>A query names a narrower answer and never another resource</b>, which is the whole of
 * why this exists: `/api/pages?lang=en` is the written pages. Compared whole, the one name that sends a parameter since 28.09.2026 would
 * have answered false here, and the three cases that read this as „did this screen spend
 * anything it should not" would have counted a resource as a write.
 */
function withoutTheQuery(path: string): string {
  /* Written as a replacement rather than as `split('?')[0]`, which under this project's
     `noUncheckedIndexedAccess` needs a fallback for an element that cannot be absent - a
     branch nothing could ever take, which is exactly what the 100 per cent branch floor
     exists to catch. */
  return path.replace(/\?.*$/, '')
}

/**
 * THE ADDRESS A CASE IS WRITTEN FOR, whichever language the screen asked in. Since 25.11.2026 (owner, PDL P18,
 * „Automatski prevod sadržaja koji posetilac vidi”) the screen that draws a translated text reads its resource in the
 * language of the address (`useLeaguesInTheReadersLanguage` and the five beside it), and a case written for
 * `/api/leagues` is about the leagues and not about which language they were asked in. `asked` keeps the address as it
 * went, so a case that is about the language still reads it there, and `/api/pages?lang=` is left as it is, since a
 * case about the written pages is about the language.
 */
function withoutTheReadersLanguage(path: string): string {
  return path.replace(/^(\/api\/(?:leagues|comments|competitors|teams|pricing|ducats))\?lang=[a-z]+$/, '$1')
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

    return answers(withoutTheReadersLanguage(path), init) ?? disc(input, init)
  }

  return {
    asked,
    stop: () => {
      globalThis.fetch = disc
    },
  }
}

/**
 * WHAT ONE MEMBER'S DOOR ANSWERS, given what the league's door answers: the rows that carry his number, in
 * the order the league's answer holds them (`ResultApi.resultsOf`, which is the league's query with one
 * condition more). Anything that is not a list is answered as no runs at all.
 */
export function hisRunsFrom(league: unknown, memberNumber: string): unknown[] {
  return Array.isArray(league)
    ? league.filter((one: unknown) => Reflect.get(Object(one), 'memberNumber') === memberNumber)
    : []
}

/**
 * THE RUNS OF A CASE, ANSWERED AT BOTH DOORS THAT SERVE THEM: the league's (`/api/results`, or
 * `/api/unscored-results`) and every member's own (`/api/competitors/{broj}/results`), out of the one list
 * the case hands in. A case that answered only the league's door would hand the profile, which reads his
 * own door since 22.11.2026, the history of the disc instead of its own, and a case that wrote the two out
 * separately could hand the two doors two histories.
 *
 * @returns the answer, or null where the address is neither door
 */
export function runsAtBothDoors(
  path: string,
  door: 'results' | 'unscored-results',
  runs: unknown[],
): Response | null {
  const his = new RegExp(`^/api/competitors/([^/]+)/${door}$`).exec(path)
  const answer = path === `/api/${door}` ? runs : his === null ? null : hisRunsFrom(runs, decodeURIComponent(his[1] ?? ''))

  return answer === null
    ? null
    : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })
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
    readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
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

/** What `GET /api/me/category` answers, in the names it answers them under. */
export type CategoryAnswered = {
  season: number
  firstSeason: boolean
  firstSeasonAllowed: boolean
  category: string
  open: boolean
}

/**
 * `GET /api/me/category`, and what a write to it is answered with.
 *
 * <p><b>The five fields are given in full and never defaulted</b>, which is deliberate:
 * the whole of what the member's box draws comes off this answer since 27.09.2026, so a
 * case that left a field out would be measuring a screen against a state the route cannot
 * produce. Four of the five have both values in use across the cases.
 *
 * @param said  what the read answers, or null for a route that answers 404 - an account
 *              with no member, or a visitor. Both are „no box", which is the same outcome
 *              `myCategory.ts` folds every failure into.
 * @param wrote what a {@code PUT} to it answers. The default is the read's own body, which
 *              is what the route really does (it works the answer out again after writing),
 *              and a case about a refusal hands in `refused('theChoiceIsShut', 409)`.
 */
export function categoryAsServed(
  said: CategoryAnswered | null,
  wrote?: Response,
): { asked: Asked[]; stop: () => void } {
  return serverThat((path, init) => {
    if (path !== '/api/me/category') {
      return null
    }

    if (init?.method === 'PUT') {
      return wrote ?? answeringCategory(said)
    }

    return answeringCategory(said)
  })
}

/**
 * The body of a 200, or the 404 that stands for every way the read can fail.
 *
 * Exported because a case about the WRITE hands in what the write answers, and that is most
 * often a different state from what the read answered: the route works the whole answer out
 * again after writing, so a wish that cost the member his right comes back with the right
 * already gone.
 */
export function answeringCategory(said: CategoryAnswered | null): Response {
  return said === null
    ? new Response(null, { status: 404 })
    : new Response(JSON.stringify(said), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
}

/** What the book holds, in the money it is kept in: `Balance.Money` on the wire. */
export type BookAnswered = { amount: number; currency: 'RSD' | 'EUR' }

/**
 * `GET /api/me/balance`, and the book it reports.
 *
 * <p><b>The route answers the money and nothing else</b> (`MyBalanceApi`: `{amount, currency}`), so
 * that is the whole body here. It is served to every member, one the Managing Board freed of the
 * fee included, and it writes nothing.
 *
 * @param book what the book holds, or null for a route that answers 404: an account that races for
 *             nobody, or a visitor (401 on the real route). Both are „no figure" on the screen.
 */
export function bookAsServed(book: BookAnswered | null): { asked: Asked[]; stop: () => void } {
  return serverThat((path) => (path === '/api/me/balance' ? answeringBook(book) : null))
}

/** The body of a 200 for a book that holds `book`, or the 404 for no figure. */
export function answeringBook(book: BookAnswered | null): Response {
  return book === null
    ? new Response(null, { status: 404 })
    : new Response(JSON.stringify(book), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
}

/** The payer an `anInvoice` names unless a case says otherwise. */
export const THE_PAYER = 'Žarko Đurđević-Ćosić'

/** `MyMembershipApi.MyMembership` on the wire, every component of it. */
export type InvoiceAnswered = {
  season: number
  alreadyAMember: boolean
  priceKey: string
  fee: BookAnswered
  balance: BookAnswered
  fromTheBalance: BookAnswered
  toTransfer: BookAnswered
  processingFeeEur: number
  coveredByTheBalance: boolean
  payer: string
}

/**
 * WHAT `GET /api/me/membership` ANSWERS A MEMBER WHO OWES THE SEASON, built for a case.
 *
 * <p><b>The default figures are on no row of the served price list, and that is the point of
 * them.</b> The screen used to read the price list for this amount; an answer that repeated a row
 * of it (4.800 RSD, 40 EUR) would be drawn the same by a screen that never asked the route, so a case
 * standing on it would measure nothing (CLAUDE.md, „Dva izvora, jedna vrednost"). 3.700 dinars with
 * 1.100 off the balance, or 33,50 euro with 6,50 off it and a fee of 3, are figures only the route
 * can have put on the page.
 *
 * @param season   the season the answer is about, which the screen requires to be its own
 * @param currency his money, which the server decides by his country
 * @param changes  what this case changes over the defaults
 */
export function anInvoice(
  season: number,
  currency: 'RSD' | 'EUR',
  changes: {
    toTransfer?: number
    fromTheBalance?: number
    processingFeeEur?: number
    alreadyAMember?: boolean
    /** What the book holds today, which is `fromTheBalance` unless the case says otherwise: it
     *  parts company with it for a member whose balance grew after his code was minted, and it is what
     *  `coveredByTheBalance` is asked of. */
    balance?: number
    /** Who the slip names as the payer: a name on no member of the mock, so a screen that built it
     *  from the session or from the list draws another. */
    payer?: string
  } = {},
): InvoiceAnswered {
  const toTransfer = changes.toTransfer ?? (currency === 'RSD' ? 3700 : 33.5)
  const fromTheBalance = changes.fromTheBalance ?? (currency === 'RSD' ? 1100 : 6.5)
  const processingFeeEur = changes.processingFeeEur ?? (currency === 'EUR' && toTransfer > 0 ? 3 : 0)
  const money = (amount: number): BookAnswered => ({ amount, currency })

  return {
    season,
    alreadyAMember: changes.alreadyAMember ?? false,
    priceKey: 'regular',
    fee: money(toTransfer + fromTheBalance),
    balance: money(changes.balance ?? fromTheBalance),
    fromTheBalance: money(fromTheBalance),
    toTransfer: money(toTransfer),
    processingFeeEur,
    /* WHAT THE BOOK HOLDS TODAY AGAINST THE FEE, the server's own question (`Balance.against`), and
       NOT whether anything is left to transfer. The two agree for every default, and part company for
       a member whose balance grew past the fee after his slip was minted (owner, 25.10.2026: he „vidi i
       dugme i uplatnicu"). Written as `toTransfer === 0` until that day, which made that member a
       state no case could stand in. */
    coveredByTheBalance: (changes.balance ?? fromTheBalance) >= toTransfer + fromTheBalance,
    payer: changes.payer ?? THE_PAYER,
  }
}

/**
 * `GET /api/me/membership`, and what he owes.
 *
 * @param invoice what the route answers, null for its 404 (an account that races for nobody, or a
 *                member freed of the season), or a `Response` for any other way it can end
 */
export function invoiceAsServed(
  invoice: InvoiceAnswered | null | Response,
): { asked: Asked[]; stop: () => void } {
  return serverThat((path, init) =>
    path === '/api/me/membership' && init?.method === undefined ? answeringInvoice(invoice) : null,
  )
}

/** The body of a 200 for `invoice`, its 404 for null, or the response handed in. */
export function answeringInvoice(invoice: InvoiceAnswered | null | Response): Response {
  if (invoice instanceof Response) {
    return invoice
  }

  return invoice === null
    ? new Response(null, { status: 404 })
    : new Response(JSON.stringify(invoice), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
}
