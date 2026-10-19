import { describe, expect, it } from 'vitest'
import { typedIn, WHEN_BOOKING_A_PAYMENT } from './activation'
import { paymentOnTheRow, recording, THE_BALANCE_ALWAYS_PAYS, WHEN_RECORDING_ON_THE_ROW } from './memberPayment'

/**
 * WHAT ONE PRESS OF „UPIŠI UPLATU" SENDS, WITHOUT MOUNTING ANYTHING.
 *
 * Every figure below is distinct from every other in the same case, so a decision read off the wrong
 * one of them is a different decision: the expected amount is not the price, and neither is the book.
 */
describe('recording a payment on a member’s row', () => {
  /** A member abroad: 38 expected with the fee, 35 without it, 5 on his book. */
  const ABROAD = { currency: 'EUR', expected: 38, price: 35, balance: 5 }

  /** A member in Serbia: 4.200 expected and no fee, 1.000 on his book. */
  const IN_SERBIA = { currency: 'RSD', expected: 4200, price: 4200, balance: 1000 }

  it('always lets the book pay the rest, because the row has no box', () => {
    expect(THE_BALANCE_ALWAYS_PAYS).toBe(true)
  })

  it('sends at once what is exact, what is more, and what the book makes whole', () => {
    expect(recording(ABROAD, typedIn('38'))).toEqual({
      press: 'sends',
      body: { received: 38, method: 'paypal' },
    })
    expect(recording(ABROAD, typedIn('50'))).toEqual({
      press: 'sends',
      body: { received: 50, method: 'paypal' },
    })
    /* 33 + 5 is 38: covered to the last cent, and covered by the book, which a row that read the box
       as cleared would refuse. */
    expect(recording(ABROAD, typedIn('33'))).toEqual({
      press: 'sends',
      body: { received: 33, method: 'paypal' },
    })
    expect(recording(IN_SERBIA, typedIn('3200'))).toEqual({
      press: 'sends',
      body: { received: 3200, method: 'ips' },
    })
  })

  it('asks about what is still missing once the book is spent, and measures it against the expected amount', () => {
    /* 32 + 5 is 37 against 38, so 1 is missing; measured against the price (35) nothing would be. */
    expect(recording(ABROAD, typedIn('32'))).toEqual({
      press: 'asksAboutTheShortfall',
      short: 1,
      body: { received: 32, method: 'paypal' },
    })
    expect(recording(IN_SERBIA, typedIn('3000'))).toEqual({
      press: 'asksAboutTheShortfall',
      short: 200,
      body: { received: 3000, method: 'ips' },
    })
  })

  it('sends nothing for an empty field, a nought, what it cannot read, or a money it cannot name', () => {
    for (const field of ['', '0', '00', '4.200', 'abc']) {
      expect(recording(IN_SERBIA, typedIn(field))).toEqual({ press: 'nothing' })
    }

    expect(recording({ ...IN_SERBIA, currency: 'CHF' }, typedIn('4200'))).toEqual({ press: 'nothing' })
  })

  it('goes to the address of the member it is about', () => {
    expect(paymentOnTheRow('000005')).toBe('/api/members/000005/payment')
  })

  it('answers every refusal the row can meet in the payments screen’s own words, and no other', () => {
    expect(Object.keys(WHEN_RECORDING_ON_THE_ROW).sort()).toEqual(
      [
        'theAmountIsNotKeptExactly',
        'theAmountIsNotMoney',
        'theAmountIsNotWhole',
        'theFormIsNotComplete',
        'theMembershipCostsNothing',
        'theMembershipIsAlreadyHeld',
        'theMethodIsNotKnown',
        'thePaymentWasReversed',
      ].sort(),
    )

    for (const [reason, sentence] of Object.entries(WHEN_RECORDING_ON_THE_ROW)) {
      expect(sentence).toBe(WHEN_BOOKING_A_PAYMENT[reason])
    }
  })
})
