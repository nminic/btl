import {
  inYearlyWindow,
  referralMayBeSet,
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

  /* **The season a transfer lands in, on both sides of the window and on both sides of
     New Year.** It shared a body with „what is being sold" until 06.09.2026, and outside
     the window that body answered with the season that is **running**: a proposal decided
     on 5 January put its founder into a squad in the middle of a season. The two look
     alike and are not, so this asks on the four days where they used to disagree. */
  it('lands a transfer at the start of a season, never inside one', () => {
    expect(transfersTakeEffect('2026-09-30')).toBe(2027)
    expect(transfersTakeEffect('2026-10-01')).toBe(2027)
    expect(transfersTakeEffect('2026-12-31')).toBe(2027)
    expect(transfersTakeEffect('2027-01-01')).toBe(2028)
    /* And never a season the league does not have: the clock can be put back, and
       „the next year" before the first season is a year nothing was run in. */
    expect(transfersTakeEffect('2025-11-15')).toBe(2027)
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
