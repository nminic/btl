import {
  inYearlyWindow,
  referralMayBeSet,
  seasonOnSale,
  seasonRunning,
  transfersTakeEffect,
} from './season'

describe('the yearly window', () => {
  it('opens on the first of October and shuts with the year', () => {
    expect(inYearlyWindow('2026-09-30')).toBe(false)
    expect(inYearlyWindow('2026-10-01')).toBe(true)
    expect(inYearlyWindow('2026-12-31')).toBe(true)
    expect(inYearlyWindow('2027-01-01')).toBe(false)
  })

  it('sells next season once it is open, and this one before that', () => {
    expect(seasonOnSale('2026-07-29')).toBe(2026)
    expect(seasonOnSale('2026-10-02')).toBe(2027)
    expect(seasonOnSale('2026-12-31')).toBe(2027)
  })

  it('lands a transfer at the start of a season, never inside one', () => {
    expect(transfersTakeEffect('2026-11-15')).toBe(2027)
  })

  it('shuts the referral amount on the day the window opens, and not before', () => {
    /* Owner, 16.08.2026: „administrator podešava do 1.10. u 00 po CET za
       predstojeću godinu." The deadline and the opening of the window are one
       instant read two ways, which is why this is the negation of the window and
       not a second date to keep right.
     *
       Written here because the rule had no test of its own: the screen that
       obeys it was measured on 30 September and on 1 November, so the boundary
       itself, the one day the sentence is about, was never touched. And because
       the negation is what makes 1 January true again, which is a fact about the
       running season the screen has to admit to (pages/admin/AdminPricing.tsx). */
    expect(referralMayBeSet('2026-09-30')).toBe(true)
    expect(referralMayBeSet('2026-10-01')).toBe(false)
    expect(referralMayBeSet('2026-12-31')).toBe(false)
    expect(referralMayBeSet('2027-01-01')).toBe(true)
  })

  it('has no season running until the first one begins', () => {
    /* The one boundary this function exists for, and it had no test: the screen
       that reads it was measured in 2026 and in 2028, so the day the league's first
       season begins was never touched. A review made the comparison `<=` and the
       whole suite stayed green, which means that for the whole of 2027 the price
       list would silently drop the sentence „Sezona 2027 je u toku" and an
       administrator would set an amount in July 2027 without being told that the
       same save moves the amount standing for the season they are in.
     *
       The hour is not read, here or anywhere in this file. On 1 January until 16:00
       the portal has two seasons over one another (PDL P9 and P14: a result goes to
       the season that has closed, the widget already counts the new one), and this
       answers with the new one from midnight. Written down rather than pretended
       away, as with the hour in `referralMayBeSet` above. */
    expect(seasonRunning('2026-09-30')).toBeNull()
    expect(seasonRunning('2026-12-31')).toBeNull()
    expect(seasonRunning('2027-01-01')).toBe(2027)
    expect(seasonRunning('2027-12-31')).toBe(2027)
    expect(seasonRunning('2028-06-01')).toBe(2028)
  })
})
