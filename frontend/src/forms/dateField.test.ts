import { ageOn, daysBetween, maskDate, parseDate, shiftDate } from './dateField'

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

describe('moving a date by whole days', () => {
  it('counts the days between two of them, in both directions', () => {
    expect(daysBetween('2027-04-03', '2028-04-01')).toBe(364)
    expect(daysBetween('2028-04-01', '2027-04-03')).toBe(-364)
    expect(daysBetween('2027-04-03', '2027-04-03')).toBe(0)
  })

  it('counts whole days across the change of clocks, not hours', () => {
    /* Serbia moves its clocks on the last Sunday in March and October. Counted
       by subtracting timestamps in local time, a week over either of those is
       six days and twenty three hours, which rounds to six: an event moved a
       week would take its races six days along and the Sunday race would land on
       the Saturday. */
    expect(daysBetween('2027-03-27', '2027-04-03')).toBe(7)
    expect(daysBetween('2027-10-30', '2027-11-06')).toBe(7)
  })

  it('answers nought where either of them is not a date', () => {
    expect(daysBetween('', '2027-04-03')).toBe(0)
    expect(daysBetween('2027-04-03', '03/04/2027')).toBe(0)
  })

  it('moves a date by that many days, over the end of a month and a year', () => {
    expect(shiftDate('2027-04-03', 1)).toBe('2027-04-04')
    expect(shiftDate('2027-04-30', 1)).toBe('2027-05-01')
    expect(shiftDate('2027-12-31', 1)).toBe('2028-01-01')
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDate('2027-04-03', -3)).toBe('2027-03-31')
  })

  it('hands back what it was given where that is not a date', () => {
    /* Rather than turning it into one: a value that is not a date is a fault
       somewhere else, and inventing a day here would hide it. */
    expect(shiftDate('', 7)).toBe('')
    expect(shiftDate('03/04/2027', 7)).toBe('03/04/2027')
  })
})
