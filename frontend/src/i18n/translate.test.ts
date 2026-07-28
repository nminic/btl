import { translate, type Dictionary } from './translate'

const dictionary: Dictionary = {
  app: { name: 'Balkanska trkačka liga' },
  greeting: 'Zdravo, {name}!',
  races: {
    one: '{count} trka',
    few: '{count} trke',
    other: '{count} trka',
  },
  onlyOther: { other: 'nešto' },
  broken: { few: 'samo few' },
  section: { deep: { key: 'duboko' } },
}

describe('translate', () => {
  it('resolves a dotted key', () => {
    expect(translate(dictionary, 'sr', 'section.deep.key')).toBe('duboko')
  })

  it('returns the key itself when it is missing', () => {
    expect(translate(dictionary, 'sr', 'nema.ovoga')).toBe('nema.ovoga')
  })

  it('returns the key when the path runs through a string', () => {
    expect(translate(dictionary, 'sr', 'greeting.dalje')).toBe('greeting.dalje')
  })

  it('interpolates parameters', () => {
    expect(translate(dictionary, 'sr', 'greeting', { name: 'Nikola' })).toBe('Zdravo, Nikola!')
  })

  it('leaves an unknown placeholder as written', () => {
    expect(translate(dictionary, 'sr', 'greeting')).toBe('Zdravo, {name}!')
  })

  it('picks the Serbian plural forms', () => {
    expect(translate(dictionary, 'sr', 'races', { count: 1 })).toBe('1 trka')
    expect(translate(dictionary, 'sr', 'races', { count: 3 })).toBe('3 trke')
    expect(translate(dictionary, 'sr', 'races', { count: 7 })).toBe('7 trka')
  })

  it('gets the awkward Serbian numbers right', () => {
    // These are the cases a refactor breaks first: 21 is "one", 22 is "few",
    // and zero is "other".
    expect(translate(dictionary, 'sr', 'races', { count: 0 })).toBe('0 trka')
    expect(translate(dictionary, 'sr', 'races', { count: 21 })).toBe('21 trka')
    expect(translate(dictionary, 'sr', 'races', { count: 22 })).toBe('22 trke')
    expect(translate(dictionary, 'sr', 'races', { count: 25 })).toBe('25 trka')
  })

  it('falls back to the other form when the category is missing', () => {
    expect(translate(dictionary, 'sr', 'onlyOther', { count: 1 })).toBe('nešto')
  })

  it('returns the key when a plural entry is used without a count', () => {
    expect(translate(dictionary, 'sr', 'races')).toBe('races')
  })

  it('returns the key when no usable plural form exists', () => {
    expect(translate(dictionary, 'sr', 'broken', { count: 7 })).toBe('broken')
  })
})
