import { describe, expect, it } from 'vitest'
import { first } from '../../test/at'
import { answeringBook, serverThat } from '../../test/serverAnswers'
import { balanceIn, MY_BALANCE, whatMyBalanceIs } from './myBalance'

/**
 * WHAT COUNTS AS A BALANCE FROM `GET /api/me/balance`, AND WHAT DOES NOT.
 *
 * <p>The line under the referral programme is drawn off this, and every refusal here is the same
 * outcome on purpose (`null`, which the screen draws as no figure). That is exactly why each is
 * measured on its own: folded into one answer, six different faults look alike, and a reader that
 * stopped checking one of them would pass every case about the other five.
 */
describe('what the server says the book holds', () => {
  it('reads the amount and the currency off the balance of a full answer', async () => {
    const { stop } = serverThat((path) =>
      path === MY_BALANCE ? answeringBook({ amount: 600, currency: 'RSD' }) : null,
    )

    try {
      expect(await whatMyBalanceIs()).toEqual({ amount: 600, currency: 'RSD' })
    } finally {
      stop()
    }
  })

  it('reads the money off the top of the answer, whatever else the route adds', async () => {
    /* `Balance.Money` serialises a derived `nothing` beside the two; a reader that insisted on exactly
       two keys would draw no figure for every member on the day a field is added. */
    const { stop } = serverThat(
      () =>
        new Response(JSON.stringify({ amount: 600, currency: 'EUR', nothing: false }), { status: 200 }),
    )

    try {
      expect(await whatMyBalanceIs()).toEqual({ amount: 600, currency: 'EUR' })
    } finally {
      stop()
    }
  })

  it('asks the one address, with no method and no token', async () => {
    const { asked, stop } = serverThat(() => answeringBook({ amount: 1, currency: 'RSD' }))

    try {
      await whatMyBalanceIs()

      expect(first(asked).path).toBe('/api/me/balance')
      /* A read, which is what a GET is: `ApiSecurity` guards what changes something. */
      expect(first(asked).init).toBeUndefined()
    } finally {
      stop()
    }
  })

  it.each([
    ['a visitor', () => new Response(null, { status: 401 })],
    [
      'an account with no member',
      () => new Response(null, { status: 404 }),
    ],
    ['a portal that is broken', () => new Response(null, { status: 500 })],
    ['a body that is not JSON', () => new Response('not json', { status: 200 })],
    [
      'a refusal whose body is shaped like an answer anyway',
      () => new Response(JSON.stringify({ amount: 600, currency: 'RSD' }), { status: 500 }),
    ],
    [
      'no server at all',
      () => {
        throw new TypeError('failed to fetch')
      },
    ],
  ])('answers nothing for %s', async (_what, answering) => {
    const { stop } = serverThat(() => answering())

    try {
      expect(await whatMyBalanceIs()).toBeNull()
    } finally {
      stop()
    }
  })

  it.each([
    ['a body that is not an object', 'balance'],
    ['no body at all', null],
    ['an answer without an amount', { currency: 'RSD' }],
    ['an amount that is a string', { amount: '600', currency: 'RSD' }],
    ['an amount that is null', { amount: null, currency: 'RSD' }],
    ['an amount that is not a finite number', { amount: Number.POSITIVE_INFINITY, currency: 'RSD' }],
    ['a currency the portal does not keep', { amount: 600, currency: 'USD' }],
    ['a currency that is missing', { amount: 600 }],
    ['a currency in the wrong case', { amount: 600, currency: 'rsd' }],
    ['the old answer, with the money under a key', { balance: { amount: 600, currency: 'RSD' } }],
  ])('believes nothing of %s', (_what, body) => {
    expect(balanceIn(body)).toBeNull()
  })

  it('believes a book of nought, which is a balance and not an absence', () => {
    expect(balanceIn({ amount: 0, currency: 'EUR' })).toEqual({
      amount: 0,
      currency: 'EUR',
    })
  })
})
