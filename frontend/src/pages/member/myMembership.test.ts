import { describe, expect, it } from 'vitest'
import { first } from '../../test/at'
import { componentsOf } from '../../test/javaRecords'
import { anInvoice, answeringInvoice, serverThat } from '../../test/serverAnswers'
import { MY_MEMBERSHIP, owedIn, whatIOwe } from './myMembership'

/**
 * WHAT COUNTS AS AN ANSWER FROM `GET /api/me/membership`, AND WHAT DOES NOT.
 *
 * <p>The slip, its code and the PayPal amount are drawn off this, and every refusal here is the same
 * outcome on purpose (`null`, which the screen draws as „Iznos za uplatu nije stigao"). Each is
 * measured on its own, because folded into one answer a reader that stopped checking one field
 * would pass every case about the others.
 */
const FULL = anInvoice(2027, 'RSD')

describe('what the server says he sends', () => {
  it('reads the season, the membership, both amounts and the fee off a full answer', async () => {
    const { stop } = serverThat((path) => (path === MY_MEMBERSHIP ? answeringInvoice(FULL) : null))

    try {
      expect(await whatIOwe()).toEqual({
        season: 2027,
        alreadyAMember: false,
        fromTheBalance: { amount: 1100, currency: 'RSD' },
        toTransfer: { amount: 3700, currency: 'RSD' },
        processingFeeEur: 0,
      })
    } finally {
      stop()
    }
  })

  it('asks the one address, with no method and no token', async () => {
    const { asked, stop } = serverThat(() => answeringInvoice(FULL))

    try {
      await whatIOwe()

      expect(first(asked).path).toBe('/api/me/membership')
      expect(first(asked).init).toBeUndefined()
    } finally {
      stop()
    }
  })

  it.each([
    ['a visitor', () => new Response(null, { status: 401 })],
    ['an account with no member, or a member freed of the season', () => new Response(null, { status: 404 })],
    ['a server that fails', () => new Response(null, { status: 500 })],
    ['a body that is not JSON', () => new Response('<html>', { status: 200 })],
    ['no server at all', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('is nothing for %s', async (_what, answer) => {
    const { stop } = serverThat(answer)

    try {
      expect(await whatIOwe()).toBeNull()
    } finally {
      stop()
    }
  })
})

describe('the answer, narrowed by looking at it', () => {
  it.each([
    ['nothing at all', null],
    ['a number', 7],
    ['a season that is not a whole number', { ...FULL, season: 2027.5 }],
    ['a season that is a string', { ...FULL, season: '2027' }],
    ['no word on a membership', { ...FULL, alreadyAMember: undefined }],
    ['a fee that is not a number', { ...FULL, processingFeeEur: '3' }],
    ['a fee that is not finite', { ...FULL, processingFeeEur: Number.POSITIVE_INFINITY }],
    ['no amount to transfer', { ...FULL, toTransfer: undefined }],
    ['an amount to transfer in a money the portal does not know', { ...FULL, toTransfer: { amount: 1, currency: 'USD' } }],
    ['no share of the balance', { ...FULL, fromTheBalance: undefined }],
  ])('is nothing for %s', (_what, body) => {
    expect(owedIn(body)).toBeNull()
  })

  it('keeps the two amounts apart, so neither can stand in for the other', () => {
    const said = owedIn(anInvoice(2028, 'EUR', { toTransfer: 12, fromTheBalance: 28, processingFeeEur: 3 }))

    expect(said?.toTransfer).toEqual({ amount: 12, currency: 'EUR' })
    expect(said?.fromTheBalance).toEqual({ amount: 28, currency: 'EUR' })
    expect(said?.processingFeeEur).toBe(3)
    expect(said?.season).toBe(2028)
  })
})

describe('the names it reads, against the record the route serves', () => {
  /* THE SPOJ BETWEEN THE TWO SIDES IS THE NAME, so it is asked of both: every name this side reads
     is a component of `MyMembershipApi.MyMembership`, and the answer the cases stand in with is
     that record exactly. A rename on the server fails here instead of leaving the screen to draw no
     amount for everybody. */
  it('reads only names the Java record declares', () => {
    const declared = componentsOf('MyMembership', 'MyMembershipApi.java')
    const read = Object.keys(owedIn(FULL) ?? {})

    expect(declared.length, 'the record was found and read').toBeGreaterThan(5)
    expect(read.length).toBe(5)
    expect(read.filter((name) => !declared.includes(name))).toEqual([])
  })

  it('stands in with the record exactly, no name more and none less', () => {
    expect(Object.keys(FULL).sort()).toEqual(componentsOf('MyMembership', 'MyMembershipApi.java'))
  })
})
