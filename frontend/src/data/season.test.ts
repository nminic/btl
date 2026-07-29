import { inYearlyWindow, seasonOnSale, transfersTakeEffect } from './season'

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
})
