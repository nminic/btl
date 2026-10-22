/** Where the book is read from. Written once so the read and the cases about it cannot part. */
export const MY_MEMBERSHIP = '/api/me/membership'

/**
 * WHAT THE BOOK ADDS UP TO FOR THIS MEMBER RIGHT NOW, in the money it is kept in.
 *
 * `GET /api/me/membership` answers it as `balance` (`MyMembershipApi.MyMembership`: „what the book
 * adds up to RIGHT NOW"), beside the fee and the slip, and it is the only place the portal serves
 * it. The currency comes WITH the amount and is the server's: since V42 a member has one balance in
 * one money, decided by his country on the server, so this side does not work it out a second time.
 */
export type MyBalance = {
  amount: number
  currency: 'RSD' | 'EUR'
}

/**
 * Read straight off the route, or nothing at all.
 *
 * A plain `fetch` and no token, for the reason `myCategory.ts` gives beside its own read: a read
 * needs none, and `ApiSecurity` protects what changes something.
 *
 * **Null covers every way this can fail and they are deliberately one outcome**, `myCategory.ts`'s
 * own decision for the same shape: no server, 401 for a visitor, 404 for an account that races for
 * nobody, a body that is not JSON, or a body without a balance. The screen draws no figure for any
 * of them, and a figure it could not read is not a nought: „0 RSD" over a book that holds six
 * hundred is exactly the fault this read replaces.
 *
 * **A member the Managing Board freed of this season's fee is among the 404s** (`MyMembershipApi`
 * answers him 404, the same refusal an account without a member gets), so he reads no balance here
 * either. That is the route's boundary and not a decision about what he is shown; it is written
 * down in `PENDING.md` for the owner.
 *
 * **THIS READ WRITES ONE ROW ON THE SERVER, the first time a season is looked at**
 * (`MyMembershipApi`: the promise a booking later takes off the book, the owner's decision of
 * 27.09.2026). It is not safe to prefetch and is made once per visit to the screen, never from a
 * place a member has not opened.
 */
export async function whatMyBalanceIs(): Promise<MyBalance | null> {
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

  return balanceIn(body)
}

/**
 * The `balance` of an answer, narrowed by looking at it (ADL A14).
 *
 * Exported so its own case can hand it bodies no real route would produce: this is the only place
 * that decides what counts as a balance.
 */
export function balanceIn(body: unknown): MyBalance | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const balance: unknown = Reflect.get(body, 'balance')

  if (typeof balance !== 'object' || balance === null) {
    return null
  }

  const amount: unknown = Reflect.get(balance, 'amount')
  const currency: unknown = Reflect.get(balance, 'currency')

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return null
  }

  if (currency !== 'RSD' && currency !== 'EUR') {
    return null
  }

  return { amount, currency }
}
