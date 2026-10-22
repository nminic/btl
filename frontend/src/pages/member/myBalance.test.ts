import { describe, expect, it } from 'vitest'
import { first } from '../../test/at'
import { answeringBook, serverThat } from '../../test/serverAnswers'
import { balanceIn, MY_MEMBERSHIP, whatMyBalanceIs } from './myBalance'

/**
 * WHAT COUNTS AS A BALANCE FROM `GET /api/me/membership`, AND WHAT DOES NOT.
 *
 * <p>The line under the referral programme is drawn off this, and every refusal here is the same
 * outcome on purpose (`null`, which the screen draws as no figure). That is exactly why each is
 * measured on its own: folded into one answer, six different faults look alike, and a reader that
 * stopped checking one of them would pass every case about the other five.
 */
describe('what the server says the book holds', () => {
  it('reads the amount and the currency off the balance of a full answer', async () => {
    const { stop } = serverThat((path) =>
      path === MY_MEMBERSHIP ? answeringBook({ amount: 600, currency: 'RSD' }) : null,
    )

    try {
      expect(await whatMyBalanceIs()).toEqual({ amount: 600, currency: 'RSD' })
    } finally {
      stop()
    }
  })

  it('reads the balance and not the promise or the fee beside it', async () => {
    /* `fromTheBalance` is what the first look of the season fixed and `fee` is another thing
       again; only `balance` is what the book holds now. All three are different numbers here,
       so a reader that took the wrong one is a failure. */
    const { stop } = serverThat(() => answeringBook({ amount: 600, currency: 'EUR' }, 300))

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

      expect(first(asked).path).toBe('/api/me/membership')
      /* A read, which is what a GET is: `ApiSecurity` guards what changes something. */
      expect(first(asked).init).toBeUndefined()
    } finally {
      stop()
    }
  })

  it.each([
    ['a visitor', () => new Response(null, { status: 401 })],
    [
      'an account with no member, or one freed of the fee',
      () => new Response(null, { status: 404 }),
    ],
    ['a portal that is broken', () => new Response(null, { status: 500 })],
    ['a body that is not JSON', () => new Response('not json', { status: 200 })],
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
    ['an answer without a balance', {}],
    ['a balance that is not an object', { balance: 600 }],
    ['a balance that is null', { balance: null }],
    ['an amount that is a string', { balance: { amount: '600', currency: 'RSD' } }],
    ['an amount that is missing', { balance: { currency: 'RSD' } }],
    [
      'an amount that is not a finite number',
      { balance: { amount: Number.POSITIVE_INFINITY, currency: 'RSD' } },
    ],
    ['a currency the portal does not keep', { balance: { amount: 600, currency: 'USD' } }],
    ['a currency that is missing', { balance: { amount: 600 } }],
    ['a currency in the wrong case', { balance: { amount: 600, currency: 'rsd' } }],
  ])('believes nothing of %s', (_what, body) => {
    expect(balanceIn(body)).toBeNull()
  })

  it('believes a book of nought, which is a balance and not an absence', () => {
    expect(balanceIn({ balance: { amount: 0, currency: 'EUR' } })).toEqual({
      amount: 0,
      currency: 'EUR',
    })
  })
})
