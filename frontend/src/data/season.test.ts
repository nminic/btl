import { inYearlyWindow, referralMayBeSet, seasonOnSale, transfersTakeEffect } from './season'

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
})
