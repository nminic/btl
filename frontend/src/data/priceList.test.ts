import { describe, expect, it } from 'vitest'
import {
  A_FEE,
  A_LEVEL,
  A_PERIOD,
  A_REFERRAL,
  inForceOn,
  ofKind,
  pricedInBoth,
  ranksByPeriod,
  windowOf,
} from './priceList'
import type { Price } from './types'
import served from '../../public/mock/pricing.json'

/**
 * HOW THE SERVED PRICE LIST IS TAKEN APART, measured over the answer itself.
 *
 * <p><b>The rows come out of `public/mock/pricing.json` and not out of literals written
 * here</b>, because that is the file `test/setup.ts` answers `/api/pricing` with: a fixture
 * of its own would be a fifth home for an amount, and the whole reason this module exists is
 * that the portal had four.
 *
 * <p><b>What is written out by hand is the SHAPES that file does not carry</b>, and only
 * those: a period with no window, a level with two of them, a list with no period at all.
 * Each names a state V4 forbids on the server and this side cannot rule out, and each one is
 * here because the behaviour when it arrives is a decision rather than an accident.
 */

const ROWS: Price[] = served

/** One row built from a served one, with something about it moved. */
function like(key: string, change: Partial<Price>): Price {
  const row = ROWS.find((one) => one.key === key)

  if (row === undefined) {
    throw new Error(`the served price list has no row "${key}"`)
  }

  return { ...row, ...change }
}

describe('the rows that can be shown in both currencies', () => {
  it('is every row but the processing fee, which has no dinar side', () => {
    /* V4's own equivalence, `price_row_only_fee_has_no_rsd`: the fee is the one row with no
       dinar price, because there is no payment intermediary on that side to pay (PDL, owner
       04.08.2026). So the count is six of seven, and the one left out is named rather than
       counted. */
    expect(ROWS).toHaveLength(7)
    expect(pricedInBoth(ROWS).map((one) => one.key)).toEqual([
      'early',
      'regular',
      'late',
      'season',
      'junior',
      'referral',
    ])
    expect(pricedInBoth(ROWS).some((one) => one.kind === A_FEE)).toBe(false)
  })

  it('keeps the order the answer came in, and does not sort it', () => {
    /* `PricingApi` answers in `sort_order` and says why the order is the answer rather than a
       field: „a position said twice ... is two things to keep equal, and the day they
       disagree there is nothing to say which of them the reader should believe." Measured
       against a list handed over BACKWARDS, so „keeps the order" cannot be satisfied by a
       function that happens to sort into the one the file is written in. */
    const backwards = [...ROWS].reverse()

    expect(pricedInBoth(backwards).map((one) => one.key)).toEqual([
      'referral',
      'junior',
      'season',
      'late',
      'regular',
      'early',
    ])
  })

  it('hands back a number where the answer had a nullable one', () => {
    /* The point of the whole function: what comes out is readable by `money`, which takes a
       number, without anything being asserted about it (ADL A14). */
    const only = pricedInBoth([like('early', {})])

    expect(only.map((one) => one.rsd)).toEqual([4200])
  })
})

describe('the rows of one kind', () => {
  it('is found by the kind and never by the key', () => {
    /* ADL A36 O12: the kind is what tells the rows apart, and `price_row_kind_known` is V4's
       list of the four there are. Measured on a key the portal has never heard of, which is
       the whole difference from asking by key: a row added to the table tomorrow is placed by
       what it IS rather than by whether this build knows its name. */
    const winter = like('early', { key: 'winter' })

    expect(ofKind([...ROWS, winter], A_PERIOD).map((one) => one.key)).toContain('winter')
    expect(ofKind(ROWS, A_LEVEL).map((one) => one.key)).toEqual(['junior'])
    expect(ofKind(ROWS, A_REFERRAL).map((one) => one.key)).toEqual(['referral'])
    expect(ofKind(ROWS, A_FEE).map((one) => one.key)).toEqual(['processing'])
  })

  it('is an empty list where the answer carries none of that kind', () => {
    /* Which is what lets a screen walk it: „the case where it is missing is the empty list
       and needs no guard at all". */
    expect(ofKind(ROWS.filter((one) => one.kind !== A_REFERRAL), A_REFERRAL)).toEqual([])
  })
})

describe('what membership costs on a day', () => {
  const bands = pricedInBoth(ROWS)

  it('is the last period whose first day has passed, all the year round', () => {
    /* The four periods tile the year with no gap and no overlap, and every one of them is
       reached: the year opens inside `season`, and the selling year opens on 1 October.
       Boundaries on both sides of each window, because „the last period whose first day has
       passed" and „the period whose window contains today" are the same answer everywhere
       except on a boundary got wrong. */
    const on = (day: string) => inForceOn(bands, day).map((one) => one.key)

    expect(on('2027-01-01')).toEqual(['season'])
    expect(on('2027-09-30')).toEqual(['season'])
    expect(on('2027-10-01')).toEqual(['early'])
    expect(on('2027-10-05')).toEqual(['early'])
    expect(on('2027-10-06')).toEqual(['regular'])
    expect(on('2027-11-30')).toEqual(['regular'])
    expect(on('2027-12-01')).toEqual(['late'])
    expect(on('2027-12-31')).toEqual(['late'])
  })

  it('reads the window and not the order the answer arrived in', () => {
    /* THE SOURCE SWAP FOR THIS FUNCTION, and it is the one that matters: the served list
       OPENS with 1 October and the year opens on 1 January, so a function that took the
       first row, or the last, or trusted the answer's order would be right about some days
       and wrong about these. Handed the same rows backwards it has to answer the same thing.
     */
    const backwards = pricedInBoth([...ROWS].reverse())

    expect(inForceOn(backwards, '2027-01-15').map((one) => one.key)).toEqual(['season'])
    expect(inForceOn(backwards, '2027-10-03').map((one) => one.key)).toEqual(['early'])
  })

  it('answers nothing where the list holds no period at all', () => {
    /* Which the constant could never do - it was four rows a test held to tiling the year -
       and an answer can. A screen with no price to quote says nothing rather than quoting a
       figure nobody sent. */
    expect(inForceOn(pricedInBoth(ROWS.filter((one) => one.kind !== A_PERIOD)), '2027-10-03')).toEqual(
      [],
    )
  })

  it('drops a period that arrived with no window instead of opening the year with it', () => {
    /* V4 forbids the state (`price_row_period_has_days`); this is what this side does if it
       arrives all the same. Standing in for the missing day with the empty string - the first
       draft - made it the price in force on EVERY day of the year, because `'' <= day` is
       true of every day there is. Measured on the two days either side of the real answer, so
       „it is dropped" is held rather than „it is not first". */
    const broken = pricedInBoth([...ROWS, like('early', { key: 'no-window', from: null })])

    expect(inForceOn(broken, '2027-01-15').map((one) => one.key)).toEqual(['season'])
    expect(inForceOn(broken, '2027-10-03').map((one) => one.key)).toEqual(['early'])
  })
})

describe('the window a row is sold in', () => {
  it('is the two days of the year, as a day is read', () => {
    expect(windowOf(like('early', {}))).toBe('1.10. - 5.10.')
    expect(windowOf(like('regular', {}))).toBe('6.10. - 30.11.')
  })

  it('is nothing at all where the row has no window', () => {
    /* Both of them asked about and not only the first, although V4 ties them together: a cell
       reading „1.10. - undefined" is what one answer alone would draw. */
    expect(windowOf(like('junior', {}))).toBeNull()
    expect(windowOf(like('early', { to: null }))).toBeNull()
    expect(windowOf(like('early', { from: null }))).toBeNull()
  })
})

describe('whether a row answers the ranking column itself', () => {
  it('points at the periods where the answer said nothing', () => {
    /* Asked of the ANSWER's null and no longer of the key, which is what lets a second level
       arrive and be read correctly: `ranking === null` is a claim about the row in hand, and
       `key === 'junior'` was a claim that the junior level is the only row that will ever be
       in that position. */
    expect(ranksByPeriod(like('junior', {}))).toBe(true)
    expect(ranksByPeriod(like('junior', { key: 'cadet' }))).toBe(true)
    expect(ranksByPeriod(like('early', {}))).toBe(false)
    expect(ranksByPeriod(like('season', {}))).toBe(false)
  })

  it('tells „no answer of its own" from „no place in the standing"', () => {
    /* The distinction the whole function is for. `season` answers `false` - it buys a profile
       and no place in the standing - and the junior level answers nothing at all. Read
       through one value those two are the same cell, which is what drew „Ne" under a question
       the level does not answer. */
    expect(like('season', {}).ranking).toBe(false)
    expect(like('junior', {}).ranking).toBeNull()
    expect(ranksByPeriod(like('season', {}))).not.toBe(ranksByPeriod(like('junior', {})))
  })
})
