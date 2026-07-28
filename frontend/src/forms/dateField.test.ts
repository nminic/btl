import { ageOn, maskDate, parseDate } from './dateField'

describe('parseDate', () => {
  it('reads dd/mm/gggg', () => {
    expect(parseDate('12/04/1985')?.toISOString().slice(0, 10)).toBe('1985-04-12')
  })

  it('refuses anything that is not that shape', () => {
    expect(parseDate('1985-04-12')).toBeNull()
    expect(parseDate('12/4/1985')).toBeNull()
    expect(parseDate('')).toBeNull()
  })

  it('refuses a day that does not exist', () => {
    // Date would quietly roll this into March.
    expect(parseDate('31/02/2027')).toBeNull()
    expect(parseDate('31/04/2027')).toBeNull()
    expect(parseDate('13/13/2027')).toBeNull()
    expect(parseDate('29/02/2028')).not.toBeNull()
  })
})

describe('ageOn', () => {
  const today = new Date(Date.UTC(2026, 6, 28))

  it('counts full years', () => {
    expect(ageOn(new Date(Date.UTC(2010, 6, 28)), today)).toBe(16)
  })

  it('does not count a birthday that has not happened yet', () => {
    expect(ageOn(new Date(Date.UTC(2010, 6, 29)), today)).toBe(15)
    expect(ageOn(new Date(Date.UTC(2010, 11, 1)), today)).toBe(15)
  })
})

describe('maskDate', () => {
  it('puts the slashes in as the digits arrive', () => {
    expect(maskDate('1')).toBe('1')
    expect(maskDate('12')).toBe('12')
    expect(maskDate('1204')).toBe('12/04')
    expect(maskDate('12041985')).toBe('12/04/1985')
  })

  it('throws away everything that is not a digit, and anything past eight', () => {
    expect(maskDate('12/04/1985')).toBe('12/04/1985')
    expect(maskDate('abc12x04-1985999')).toBe('12/04/1985')
    expect(maskDate('')).toBe('')
  })
})
