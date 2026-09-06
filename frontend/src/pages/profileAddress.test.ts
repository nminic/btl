import { addressOf, memberNumberIn, profilePath, redirectTo } from './profileAddress'
import type { Competitor } from '../data/types'

/* The address a profile lives at.
 *
 * Owner, 14.08.2026: „Treba da bude i ime i prezime. Zašto bi bila samo broj?"
 * PDL P11 had said the same since 31.07.2026 and named the shape. Twelve places
 * on the portal linked to a profile and every one of them wrote the address out
 * by hand, which is why this is one module with tests of its own: a rule kept in
 * twelve places is a rule kept in some of them.
 */

const someone = (over: Partial<Competitor> = {}): Competitor => ({
  memberNumber: '000127',
  firstName: 'Nikola',
  lastName: 'Minić',
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  birthYear: 1985,
  firstSeason2027: false,
  firstSeason: 2027,
  active: true,
  membershipBasis: 'payment',
  referralCode: 'proba0000',
  referredBy: null,
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  bio: '',
  ...over,
})

describe('the address a profile lives at', () => {
  it('carries the number first and the name behind it', () => {
    /* The number is what identifies anybody, so it goes in front where it can be
       read off without knowing anything about names, and the rest is for the
       person reading the address. */
    expect(profilePath(someone(), 'sr')).toBe('/sr/takmicar/000127-nikola-minic')
    expect(addressOf(someone())).toBe('000127-nikola-minic')
  })

  it('spells a name the way every other address on the portal is spelt', () => {
    /* The same `slugify` the rulebook and the teams use, letter for letter, so
       one name is one address wherever the portal writes it. The table spells
       „đ" as „d" rather than „dj", which is its decision and not this one. */
    expect(addressOf(someone({ firstName: 'Đorđe', lastName: 'Šušnjar' }))).toBe(
      '000127-dorde-susnjar',
    )
  })

  it('falls back to the number alone where a name makes no address', () => {
    /* Not impossible: `slugify` answers with nothing for a name written entirely
       in punctuation, and the league is run across a region whose alphabets it
       has had to learn one at a time. The number alone is a working address, so
       such a member keeps a profile rather than one ending in a bare dash. */
    expect(addressOf(someone({ firstName: '...', lastName: '???' }))).toBe('000127')
    expect(profilePath(someone({ firstName: '.', lastName: '.' }), 'en')).toBe('/en/takmicar/000127')
  })
})

describe('reading a number back out of an address', () => {
  it('takes everything in front of the first dash', () => {
    expect(memberNumberIn('000127-nikola-minic')).toBe('000127')
  })

  it('reads an address that carries no name at all', () => {
    /* A bookmark from before the name was in the address, and an address
       somebody typed the number of. Both open the profile they always did. */
    expect(memberNumberIn('000127')).toBe('000127')
  })

  it('reads a name that has been changed since the link was made', () => {
    /* The reason the number is in front rather than behind. Nothing on this
       portal has to be told when somebody marries. */
    expect(memberNumberIn('000127-nekim-drugim-imenom')).toBe('000127')
  })

  it('answers nothing where the address carried nothing', () => {
    expect(memberNumberIn(undefined)).toBeUndefined()
  })
})

describe('moving a reader to the one address', () => {
  it('leaves an address that is already the right one alone', () => {
    /* Every ordinary visit. A redirect on each of them would double the way
       back for everybody in order to tidy the address of a few. */
    expect(redirectTo(someone(), '000127-nikola-minic', 'sr')).toBeNull()
  })

  it('moves one that is only the number', () => {
    /* PDL P11 asks for one address and no alias. The number alone has to keep
       working, and this is what keeps it from being a second address: it is a
       way in rather than a place to stay. */
    expect(redirectTo(someone(), '000127', 'sr')).toBe('/sr/takmicar/000127-nikola-minic')
  })

  it('moves one that carries a name somebody has since changed', () => {
    expect(redirectTo(someone(), '000127-staro-ime', 'sr')).toBe('/sr/takmicar/000127-nikola-minic')
  })

  it('moves a reader within the language they are reading in', () => {
    /* P18: every address on the portal carries the language in front. Hardcoding
       `/sr/` here survived the whole suite, and it would have taken somebody
       reading the English branch silently onto the Serbian one. */
    expect(redirectTo(someone(), '000127', 'en')).toBe('/en/takmicar/000127-nikola-minic')
  })

  it('keeps whatever hangs off the end of it', () => {
    /* The trophies are a page of their own under the profile, and they are moved
       to the same one address with their own tail still on. */
    expect(redirectTo(someone(), '000127', 'sr', '/priznanja')).toBe(
      '/sr/takmicar/000127-nikola-minic/priznanja',
    )
  })
})
