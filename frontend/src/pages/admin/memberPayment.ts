import { methodFor, type PaymentMethod } from '../../data/paymentQr'
import type { Member } from '../../data/types'
import { WHEN_BOOKING_A_PAYMENT, whatToDo, type Typed } from './activation'

/**
 * WHAT ONE PRESS OF „UPIŠI UPLATU" ON A MEMBER'S ROW SENDS, AND WHETHER IT ASKS FIRST.
 *
 * The owner, 18.10.2026 (PDL P8, the section „Osnov članstva ima jedan dom”): „Upis uplate na redu
 * člana: kaže se „uplata” i koliko je dinara uplaćeno; ostatak do članarine se skida sa balansa.” The
 * journal derives in the same entry that it is „isto pravilo kao na redu za aktivaciju na ekranu
 * Uplate ..., ne novo”, so the decision is `activation.ts#whatToDo`, asked rather than copied, and the
 * one thing that differs is said once, below, as {@link THE_BALANCE_ALWAYS_PAYS}.
 *
 * Its own module rather than a function beside the row, for the reason `activation.ts` gives: a test
 * that has to mount React to ask which prompt a number leads to measures a render, not a decision.
 */

/**
 * THE ROW HAS NO BOX, AND THIS IS WHAT A BOX THAT IS ALWAYS TICKED SAYS.
 *
 * PDL P8, „[IZVEDENO 18.10.2026, iz vlasnikove rečenice „Ostalo se skida sa balansa”] Na redu člana
 * balans se uvek koristi za ostatak; nema kućice kao na ekranu Uplate.”
 */
export const THE_BALANCE_ALWAYS_PAYS = true

/** The address, built in one place so a test cannot agree with a typo. */
export function paymentOnTheRow(memberNumber: string): string {
  return `/api/members/${memberNumber}/payment`
}

/** `MemberPaymentApi.Paid`: what arrived and how, and nothing else a moderator chooses. */
export type RowBooking = {
  received: number
  method: PaymentMethod
}

export type RowPress =
  /**
   * Nothing can be sent: the field is empty, holds a nought, cannot be read, or the money is one
   * `methodFor` does not know. An empty field and a nought are not a payment (PDL 19 point 5), and on
   * this row they are not a question about an exemption either, because „Oslobođenje ostaje izbor na
   * redu člana” (PDL P8, 18.10.2026), which is its own option and not this one.
   */
  | { press: 'nothing' }
  /** His 1, 2 and 7 on the payments screen: the money with the balance covers it, or more came. */
  | { press: 'sends'; body: RowBooking }
  /**
   * His 3: „Prihvatam umanjen ukupan iznos? Da / Ne”, which is the question the owner's decision of
   * 18.10.2026 asks before anything is sent (PDL P8, „da bi upis uplate pitao „Prihvatam umanjen
   * ukupan iznos?” pre slanja”). „Da" sends the same body; „Ne" sends nothing.
   *
   * @param short what is still missing after his book is spent to the last
   */
  | { press: 'asksAboutTheShortfall'; short: number; body: RowBooking }

/**
 * @param one   the row: his money, what he is expected to send, the price and his book, all for the
 *              season on sale, as `GET /api/members` answers them
 * @param typed the field, read by `activation.ts#typedIn`
 */
export function recording(
  one: Pick<Member, 'currency' | 'expected' | 'price' | 'balance'>,
  typed: Typed,
): RowPress {
  if (typed.got !== 'amount') {
    return { press: 'nothing' }
  }

  const method = methodFor(one.currency)

  if (method === null) {
    return { press: 'nothing' }
  }

  const body: RowBooking = { received: typed.value, method }
  const what = whatToDo(typed, one.expected, one.price, one.balance, THE_BALANCE_ALWAYS_PAYS)

  return what.does === 'asksAboutTheShortfall'
    ? { press: 'asksAboutTheShortfall', short: what.short, body }
    : { press: 'sends', body }
}

/**
 * WHAT THE ROW'S DOOR CAN REFUSE, in the payments screen's own words, because the reasons are
 * `PaymentApi`'s and so are the sentences.
 *
 * Three of `WHEN_BOOKING_A_PAYMENT`'s are left out because this door cannot answer them: a reference
 * is never sent, so `theReferenceIsNotShaped` and `theReferenceIsTaken` have nothing to be about, and
 * the member is found by his number under a lock before anything else, so `theCompetitorDoesNotExist`
 * arrives as the empty 404 of an address that is not there (ADL A8) instead.
 */
export const WHEN_RECORDING_ON_THE_ROW: Record<string, string> = Object.fromEntries(
  Object.entries(WHEN_BOOKING_A_PAYMENT).filter(
    ([reason]) =>
      reason !== 'theReferenceIsNotShaped' &&
      reason !== 'theReferenceIsTaken' &&
      reason !== 'theCompetitorDoesNotExist',
  ),
)
