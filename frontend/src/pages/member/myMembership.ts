import { balanceIn, type MyBalance } from './myBalance'

/** Where what he owes is read from. Written once so the read and the cases about it cannot part. */
export const MY_MEMBERSHIP = '/api/me/membership'

/**
 * WHAT THIS MEMBER SENDS FOR THE SEASON ON SALE, as the server works it out.
 *
 * <p>The owner, 26.09.2026: „QR se kuje na iznos minus balans." The number on the slip is money and
 * money is decided on the server: `GET /api/me/membership` (`MyMembershipApi`) answers it out of
 * `MembershipInvoice.asTheSlipPromises`, the same call the letter after a confirmed address makes
 * (`TheLetterAfterTheAddress`), so the screen and the letter put one number in front of him. The
 * junior fee (the server knows the year of birth, this side does not), his money and the promise
 * the first look of a season fixes (owner, 27.09.2026) are all in it, and none of them is worked out
 * a second time here.
 *
 * <p><b>Only the fields the screen reads.</b> The route answers more (`fee`, `balance`, `priceKey`); a
 * field nothing reads is a field nothing holds, so it is not narrowed. `coveredByTheBalance` joined
 * the read on 25.10.2026 with the button that lets him in on his balance (`member/WhatHeSends.tsx`).
 * `data/contract.test.ts` holds every name below to a component of the Java record, so a rename on
 * either side fails there and not on a screen that quietly draws nothing.
 */
export type MyMembership = {
  /** The season the server is selling today; for any other one the screen says the amount did not arrive. */
  season: number
  /** A `membership` row already stands for him and this season, on any basis. */
  alreadyAMember: boolean
  /** How much of his balance this slip uses, as the promise of the season stands. */
  fromTheBalance: MyBalance
  /** What is left for him to send, and what the code is minted on. */
  toTransfer: MyBalance
  /** Charged on a euro transfer only, and nought where there is nothing to transfer. */
  processingFeeEur: number
  /**
   * The owner's „veći ili jednak", asked of the book TODAY and not of the promise: true is
   * `POST /api/me/membership` letting him in. It is NOT `toTransfer` being nought, and the two part
   * company for a member whose balance grew after his slip was minted - covered today, and still holding
   * a slip that asks for something. The owner, 25.10.2026: that member „vidi i dugme i uplatnicu, pa
   * bira", so the screen reads each fact off its own field.
   */
  coveredByTheBalance: boolean
}

/**
 * Read straight off the route, or nothing at all.
 *
 * <p>A plain `fetch` and no token, for the reason `myBalance.ts` gives beside its own read.
 * <b>Null covers every way this can fail and they are one outcome</b>: no server, 401, 404 (an
 * account that races for nobody, or a member freed of this season's fee), a body that is not JSON or
 * one that is not this answer. The screen draws no amount for any of them, because an amount it
 * could not read is not one it may guess.
 *
 * <p><b>THIS READ WRITES A ROW ON THE SERVER</b>: the first look of a season records what the code
 * promises (`MyMembershipApi`, owner 27.09.2026). So it is asked only where a slip is about to be
 * drawn, which is the screen's business (`member/WhatHeSends.tsx`).
 */
export async function whatIOwe(): Promise<MyMembership | null> {
  let answer: Response

  try {
    answer = await fetch(MY_MEMBERSHIP)
  } catch {
    return null
  }

  if (!answer.ok) {
    return null
  }

  let body: unknown

  try {
    body = await answer.json()
  } catch {
    return null
  }

  return owedIn(body)
}

/**
 * What he owes, narrowed by looking at the answer (ADL A14).
 *
 * <p>Exported so its own case can hand it bodies no real route would produce: this is the only place
 * that decides what counts as an invoice.
 */
export function owedIn(body: unknown): MyMembership | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const season: unknown = Reflect.get(body, 'season')
  const alreadyAMember: unknown = Reflect.get(body, 'alreadyAMember')
  const processingFeeEur: unknown = Reflect.get(body, 'processingFeeEur')
  const coveredByTheBalance: unknown = Reflect.get(body, 'coveredByTheBalance')
  const fromTheBalance = balanceIn(Reflect.get(body, 'fromTheBalance'))
  const toTransfer = balanceIn(Reflect.get(body, 'toTransfer'))

  if (typeof season !== 'number' || !Number.isInteger(season)) {
    return null
  }

  if (typeof alreadyAMember !== 'boolean') {
    return null
  }

  if (typeof processingFeeEur !== 'number' || !Number.isFinite(processingFeeEur)) {
    return null
  }

  if (typeof coveredByTheBalance !== 'boolean') {
    return null
  }

  if (fromTheBalance === null || toTransfer === null) {
    return null
  }

  return { season, alreadyAMember, fromTheBalance, toTransfer, processingFeeEur, coveredByTheBalance }
}
