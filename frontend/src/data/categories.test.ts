import { ageBandFor, categoryCodeFor, firstSeasonAllowed } from './categories'

describe('ageBandFor', () => {
  it('uses the age reached during the season, not the age on the day', () => {
    // Turns 40 in November 2027: in the 40-54 band from 1 January 2027.
    expect(ageBandFor(1987, 2027)).toBe('40-54')
    expect(ageBandFor(1987, 2026)).toBe('25-39')
  })

  it('holds the boundaries the rulebook fixes', () => {
    expect(ageBandFor(2003, 2027)).toBe('24-')
    expect(ageBandFor(2002, 2027)).toBe('25-39')
    expect(ageBandFor(1988, 2027)).toBe('25-39')
    expect(ageBandFor(1973, 2027)).toBe('40-54')
    expect(ageBandFor(1972, 2027)).toBe('55+')
  })
})

describe('categoryCodeFor', () => {
  it('writes the band with the gender mark', () => {
    expect(categoryCodeFor('M', 1985, 2027, false)).toBe('M40-54')
    expect(categoryCodeFor('F', 1995, 2027, false)).toBe('Ž25-39')
  })

  it('puts a first season member in their own category instead of a band', () => {
    expect(categoryCodeFor('M', 1985, 2027, true)).toBe('M PS')
    expect(categoryCodeFor('F', 1995, 2027, true)).toBe('Ž PS')
  })
})

describe('firstSeasonAllowed', () => {
  it('closes at twelve points, and never opens again', () => {
    expect(firstSeasonAllowed(11.99)).toBe(true)
    expect(firstSeasonAllowed(12)).toBe(false)
    expect(firstSeasonAllowed(40)).toBe(false)
  })
})
