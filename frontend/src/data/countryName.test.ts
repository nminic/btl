import countries from './countries.json'
import { countryName } from './countryName'

/**
 * The words for a country code.
 *
 * Two screens asked the dictionary for these, and the dictionary held five: the
 * countries the league is run in. The select they are chosen from is filled from
 * countries.json, which holds two hundred and forty six, so anything picked
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
       two hundred and thirty five of the two hundred and forty six. */
    expect(countryName('SE')).toBe('Švedska')
  })

  it('answers for every code the select offers, and with a word for each', () => {
    /* Read off the file the select is filled from, so a country added to it
       cannot arrive without a name. */
    const all = [...countries.region, ...countries.rest]

    expect(all.length).toBeGreaterThan(200)
    expect(all.filter((one) => countryName(one.code) === one.code)).toEqual([])
  })

  it('offers a country once, and never the same one under two codes', () => {
    /* The list is built from what `Intl.DisplayNames` will name, and it will
       name codes that ISO has withdrawn: DY for Dahomey, SU for the Soviet
       Union, CS and YU for two states Serbia used to be part of. Each of them
       carries the modern name, so the select offered „Srbija" three times over
       and „Nemačka" twice, and an administrator choosing between two identical
       lines was choosing between a country and a country that no longer exists.
       Fifteen such pairs stood in it. */
    const all = [...countries.region, ...countries.rest]
    const seen = new Map<string, string>()
    const twice = all.filter((one) => {
      const first = seen.get(one.name)
      seen.set(one.name, one.code)

      return first !== undefined
    })

    expect(twice).toEqual([])
  })

  it('hands back the code where there is no country, rather than nothing', () => {
    /* Which is what a code that is not a country is: typed by hand, or arriving
       from a record written before the list had it. A name is missing either
       way, and the code at least says which. */
    expect(countryName('XX')).toBe('XX')
    expect(countryName('')).toBe('')
  })
})
