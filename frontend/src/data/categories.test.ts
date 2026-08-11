import { ageBandFor, categoryCodeFor, categoryLabel, firstSeasonAllowed } from './categories'

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
    expect(categoryCodeFor('M', 1985, 2027, true)).toBe('M R')
    expect(categoryCodeFor('F', 1995, 2027, true)).toBe('Ž R')
  })
})

describe('categoryLabel', () => {
  /* A dictionary of two words, which is all this needs: the labeller is asked
     for one key and hands back what it is given. */
  const t = (key: string) =>
    key === 'category.rookieMale' ? 'Početnici' : key === 'category.rookieFemale' ? 'Početnice' : key

  it('names the beginners by the word that carries the gender', () => {
    /* Serbian says it in one word and needs no letter in front of it; English
       says `M R` and `F R`, because rookie does not carry the gender (owner,
       11.08.2026). So the label comes out of the dictionary and the code does
       not. */
    expect(categoryLabel('M R', t)).toBe('Početnici')
    expect(categoryLabel('Ž R', t)).toBe('Početnice')
  })

  it('leaves an age band exactly as it is', () => {
    /* The bands are the same in every language, so nothing looks them up. A
       label that went through the dictionary here would need forty keys saying
       what they already say. */
    expect(categoryLabel('M40-54', t)).toBe('M40-54')
    expect(categoryLabel('Ž25-39', t)).toBe('Ž25-39')
  })

  it('is not fooled by a band that merely ends in the letter', () => {
    /* The whole word, not the last letter: a band called `MR` is not the
       beginners' category, and a test that passes on `endsWith('R')` alone
       would let it through. */
    expect(categoryLabel('MR', t)).toBe('MR')
  })
})

describe('firstSeasonAllowed', () => {
  it('closes at twelve points, and never opens again', () => {
    expect(firstSeasonAllowed(11.99)).toBe(true)
    expect(firstSeasonAllowed(12)).toBe(false)
    expect(firstSeasonAllowed(40)).toBe(false)
  })
})
