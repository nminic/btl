import { describe, expect, it } from 'vitest'
import { MEMBERSHIP_BASES } from '../../data/types'
import {
  actsOn,
  askingToCancel,
  cancelling,
  granting,
  membershipOnTheRow,
  offeredFor,
  overTheExemption,
  TO_THE_EXEMPTION,
  WHEN_CANCELLING,
  WHEN_CHANGING_TO_THE_EXEMPTION,
  WHEN_GRANTING_AN_EXEMPTION,
  WHEN_PAYING_OVER_THE_EXEMPTION,
} from './memberMembership'
import { WHEN_RECORDING_ON_THE_ROW } from './memberPayment'

/**
 * WHAT THE MEMBER'S ROW OFFERS FOR THE SEASON ON SALE, decided without a render.
 *
 * The owner, 18.10.2026 (PDL P8): payment and exemption change in both directions, an activation from
 * the balance is only cancelled („storno ..., pa nova radnja”), and every basis may be cancelled.
 */
describe('the options on a member’s row', () => {
  it('offers the change to the exemption on a payment and the payment on an exemption, and nothing on a balance', () => {
    expect(offeredFor('payment')).toEqual({ toTheExemption: true, paymentOverTheExemption: false })
    expect(offeredFor('feeExempt')).toEqual({ toTheExemption: false, paymentOverTheExemption: true })
    expect(offeredFor('balance')).toEqual({ toTheExemption: false, paymentOverTheExemption: false })
    expect(offeredFor(undefined)).toEqual({ toTheExemption: false, paymentOverTheExemption: false })
  })

  it('sends the basis the screen showed, and a change that names both ends', () => {
    for (const basis of MEMBERSHIP_BASES) {
      expect(cancelling(basis, 2027)).toEqual({ basis, season: 2027 })
    }

    expect(TO_THE_EXEMPTION).toEqual({ from: 'payment', to: 'feeExempt' })
    expect(granting(2027)).toEqual({ basis: 'feeExempt', season: 2027 })
    /* The season is the box's, never a constant: a second season says a second number. */
    expect(granting(2028).season).toBe(2028)
    expect(cancelling('payment', 2028).season).toBe(2028)
    expect(overTheExemption({ received: 3200, method: 'ips' })).toEqual({
      from: 'feeExempt',
      to: 'payment',
      received: 3200,
      method: 'ips',
    })
  })

  it('goes to the address of the member it is about', () => {
    expect(membershipOnTheRow('000005')).toBe('/api/members/000005/membership')
  })

  it('asks before a cancellation in the words of each basis', () => {
    expect(MEMBERSHIP_BASES.map(askingToCancel)).toEqual([
      'admin.askCancel.payment',
      'admin.askCancel.feeExempt',
      'admin.askCancel.balance',
    ])
  })

  it('answers what each act can meet, and the cancellation never a change it cannot name', () => {
    expect(Object.keys(WHEN_CANCELLING).sort()).toEqual(
      ['theBasisHasChanged', 'theBasisIsNotKnown', 'theFormIsNotComplete', 'theSeasonIsNotOffered'].sort(),
    )
    expect(Object.keys(WHEN_GRANTING_AN_EXEMPTION).sort()).toEqual(
      [
        'theBasisHasChanged',
        'theBasisIsNotKnown',
        'theFormIsNotComplete',
        'theSeasonIsNotOffered',
        'thisChangeIsNotOffered',
      ].sort(),
    )
    expect(WHEN_CANCELLING.theSeasonIsNotOffered).toBe('admin.membershipRefused.theSeasonIsNotOffered')
    expect(WHEN_GRANTING_AN_EXEMPTION.theSeasonIsNotOffered).toBe('admin.membershipRefused.theSeasonIsNotOffered')
    expect(Object.keys(WHEN_CHANGING_TO_THE_EXEMPTION).sort()).toEqual(
      ['theBasisHasChanged', 'theBasisIsNotKnown', 'theFormIsNotComplete', 'thisChangeIsNotOffered'].sort(),
    )

    /* A payment over the exemption meets every reason of the row's payment, and the row's own sentence
       for the one name both carry. */
    for (const [reason, sentence] of Object.entries(WHEN_RECORDING_ON_THE_ROW)) {
      expect(WHEN_PAYING_OVER_THE_EXEMPTION[reason]).toBe(
        reason === 'theFormIsNotComplete' ? WHEN_CHANGING_TO_THE_EXEMPTION[reason] : sentence,
      )
    }

    expect(WHEN_PAYING_OVER_THE_EXEMPTION.thisChangeIsNotOffered).toBe(
      'admin.membershipRefused.thisChangeIsNotOffered',
    )
    /* `PUT` names no season, so neither act on it meets the season's reason. */
    expect(WHEN_CHANGING_TO_THE_EXEMPTION.theSeasonIsNotOffered).toBeUndefined()
    expect(WHEN_PAYING_OVER_THE_EXEMPTION.theSeasonIsNotOffered).toBeUndefined()
  })
})

/**
 * WHICH BOX ACTS (owner, 22.10.2026 „unazad", and 24.11.2026: „Sezona koja se završila ne dira se od 15.10.
 * do zamrzavanja 1.1. u 16:00: njena kućica je u tom prozoru neaktivna, a posle zamrzavanja se sme
 * štiklirati i odštiklirati."). Three seasons that are three: 2029 on sale, 2028 ended and not frozen,
 * 2027 frozen; and the season on sale is never in the list of frozen seasons, so neither answer can stand
 * on the other.
 */
describe('which box of the column of seasons acts', () => {
  it('acts on the season on sale and on a frozen season, and not on the season that ended and has not frozen', () => {
    expect(actsOn(2029, 2029, [2027])).toBe(true)
    expect(actsOn(2029, 2027, [2027])).toBe(true)
    expect(actsOn(2029, 2028, [2027])).toBe(false)
  })

  it('acts on no earlier season while nothing is known to have frozen', () => {
    expect(actsOn(2029, 2027, [])).toBe(false)
    expect(actsOn(2029, 2029, [])).toBe(true)
  })
})
