import { placeName, placesLike, plainly, SUGGESTIONS, type Place } from './places'

/**
 * The codebook of the world's towns, and what is found in it.
 *
 * The list itself is generated (`btl-produkt/istorijski-podaci/napravi-mesta.py`)
 * and its shape is held by a contract test over the file (data.test.tsx). What
 * is held here is the search: a person entering a race types two letters on the
 * keyboard in front of them, which has no marks on it, and the right town has to
 * be among the first few offered.
 */

const BEOGRAD: Place = ['Beograd', 'RS', 'Belgrade']
const NOVI_SAD: Place = ['Novi Sad', 'RS']
const UZICE: Place = ['Užice', 'RS']
const BOSTON_US: Place = ['Boston', 'US']
const BOSTON_GB: Place = ['Boston', 'GB']

const SOME: Place[] = [BEOGRAD, NOVI_SAD, UZICE, BOSTON_US, BOSTON_GB]

describe('the letters of a town as they are typed', () => {
  it('is the word without the marks above it', () => {
    /* The keyboard in front of somebody entering a race has no ž on it, and the
       town is called Užice either way. */
    expect(plainly('Užice')).toBe('uzice')
    expect(plainly('Čačak')).toBe('cacak')
    expect(plainly('Šid')).toBe('sid')
  })

  it('writes out the two letters that have no marks to take off', () => {
    /* Đ and Ø are single letters rather than a letter and a mark, so splitting
       them apart yields nothing to drop. The generator writes the same two out
       the same way, and a town in Denmark is what noticed. */
    expect(plainly('Đerdap')).toBe('djerdap')
    expect(plainly('Ørsta')).toBe('orsta')
  })
})

describe('the town somebody is typing', () => {
  it('says nothing until two letters have been typed', () => {
    /* One letter matches thousands of towns and answers nothing (owner,
       10.08.2026), and the codebook is nine hundred kilobytes that nobody who
       merely opened a form has asked for. */
    expect(placesLike(SOME, '')).toEqual([])
    expect(placesLike(SOME, 'b')).toEqual([])
    expect(placesLike(SOME, 'be')).toEqual([BEOGRAD])
  })

  it('is matched from the start of the name, not from the middle of it', () => {
    /* "no" offers Novi Sad, and not every town in the world with an N and an O
       somewhere in it. */
    expect(placesLike(SOME, 'no')).toEqual([NOVI_SAD])
    expect(placesLike(SOME, 'os')).toEqual([])
  })

  it('is found however the marks are typed, in either direction', () => {
    expect(placesLike(SOME, 'uzi')).toEqual([UZICE])
    expect(placesLike(SOME, 'Uži')).toEqual([UZICE])
  })

  it('is found by its English name too, whatever language the page is in', () => {
    /* The keyboard does not change with the page. Somebody who has always typed
       "belgrade" finds Beograd on the Serbian portal. */
    expect(placesLike(SOME, 'belg')).toEqual([BEOGRAD])
  })

  it('keeps the spaces in a name of two words', () => {
    expect(placesLike(SOME, 'novi s')).toEqual([NOVI_SAD])
  })

  it('offers both towns of one name, which is what the country beside them is for', () => {
    expect(placesLike(SOME, 'bost')).toEqual([BOSTON_US, BOSTON_GB])
  })

  it('stops at eight, because a list longer than the form is not a suggestion', () => {
    const many: Place[] = Array.from({ length: 40 }, (_, at) => [`Nova ${String(at)}`, 'RS'])

    expect(placesLike(many, 'nova')).toHaveLength(8)
    /* And the constant is that number, said separately: written as
       `toHaveLength(SUGGESTIONS)` the test measured itself and passed at any
       number at all. */
    expect(SUGGESTIONS).toBe(8)
    /* And they are the first eight of the codebook, which is in order of size:
       the largest town of a name comes before the village of the same name. */
    expect(placesLike(many, 'nova')[0]).toEqual(many[0])
  })
})

describe('the name a town is written under', () => {
  it('is the English one on the English portal, and the local one otherwise', () => {
    expect(placeName(BEOGRAD, 'en')).toBe('Belgrade')
    expect(placeName(BEOGRAD, 'sr')).toBe('Beograd')
  })

  it('is the same in both where the town is not called anything else', () => {
    expect(placeName(NOVI_SAD, 'en')).toBe('Novi Sad')
    expect(placeName(NOVI_SAD, 'sr')).toBe('Novi Sad')
  })
})
