import countries from './countries.json'
import { countryName } from './countryName'

/**
 * The words for a country code.
 *
 * Two screens asked the dictionary for these, and the dictionary held five: the
 * countries the league is run in. The select they are chosen from is filled from
 * countries.json, which holds two hundred and fifty two, so anything picked
 * outside those five reached a moderator as the words `country.SI` (owner's
 * screens: the queue of new teams and the queue of payments). The five are gone
 * and this is the one answer.
 */
describe('what a country code is called', () => {
  it('names one of the region, where the dictionary used to be the only answer', () => {
    expect(countryName('RS')).toBe('Srbija')
    expect(countryName('BA')).toBe('Bosna i Hercegovina')
  })

  it('names one from outside it, which is where the five ran out', () => {
    expect(countryName('SI')).toBe('Slovenija')
    /* Off the rest of the world rather than the top of the list, since that is
       two hundred and forty one of the two hundred and fifty two. */
    expect(countryName('SE')).toBe('Švedska')
  })

  it('answers for every code the select offers, and with a word for each', () => {
    /* Read off the file the select is filled from, so a country added to it
       cannot arrive without a name. */
    const all = [...countries.region, ...countries.rest]

    expect(all.length).toBeGreaterThan(200)
    expect(all.filter((one) => countryName(one.code) === one.code)).toEqual([])
  })

  it('hands back the code where there is no country, rather than nothing', () => {
    /* Which is what a code that is not a country is: typed by hand, or arriving
       from a record written before the list had it. A name is missing either
       way, and the code at least says which. */
    expect(countryName('XX')).toBe('XX')
    expect(countryName('')).toBe('')
  })
})
