import { daysBetween, priceAfter, priceOn, registrationOpen } from './pricing'

describe('priceOn', () => {
  it('finds the price in force', () => {
    expect(priceOn('2026-10-01')?.eur).toBe(35)
    expect(priceOn('2026-10-05')?.eur).toBe(35)
    expect(priceOn('2026-10-06')?.eur).toBe(40)
    expect(priceOn('2026-11-30')?.eur).toBe(40)
    expect(priceOn('2026-12-01')?.eur).toBe(50)
    expect(priceOn('2026-12-31')?.eur).toBe(50)
  })

  it('has no price before registration opens', () => {
    // The period of looking around is not a price; nothing is sold then.
    expect(priceOn('2026-09-20')).toBeNull()
  })

  it('gives the in-season price no place in the standing', () => {
    expect(priceOn('2027-03-01')?.ranking).toBe(false)
    expect(priceOn('2026-10-01')?.ranking).toBe(true)
  })
})

describe('priceAfter', () => {
  it('finds what comes next, and nothing after the last one', () => {
    expect(priceAfter(priceOn('2026-10-01')!)?.eur).toBe(40)
    expect(priceAfter(priceOn('2027-03-01')!)).toBeNull()
  })
})

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-10-01', '2026-10-06')).toBe(5)
    expect(daysBetween('2026-10-06', '2026-10-06')).toBe(0)
  })
})

describe('registrationOpen', () => {
  it('is shut during the period of looking around', () => {
    expect(registrationOpen('2026-09-29')).toBe(false)
    expect(registrationOpen('2026-10-01')).toBe(true)
  })
})
