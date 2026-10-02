import {
  countriesByName,
  nameBeforeItsBracket,
  placeName,
  placesLike,
  plainly,
  SUGGESTIONS,
  type Place,
} from './places'

/**
 * The codebook of the world's towns, and what is found in it.
 *
 * The list itself is generated (`btl-produkt/istorijski-podaci/napravi-mesta.py`)
 * and its shape is held by a contract test over the file (data.test.tsx). What
 * is held here is the search: a person entering a race types two letters on the
 * keyboard in front of them, which has no marks on it, and the right town has to
 * be among the first few offered.
 */

/* The first field is the town's GeoNames mark, and these are the real ones out
   of the shipped codebook rather than numbers made up here. Two of them earn
   their place: Boston in the United States and Boston in England are one name in
   two countries, and the mark is the only field that tells them apart. */
const BEOGRAD: Place = [792680, 'Beograd', 'RS', 'Belgrade']
const NOVI_SAD: Place = [3194360, 'Novi Sad', 'RS']
const UZICE: Place = [3188434, 'Užice', 'RS']
const BOSTON_US: Place = [4930956, 'Boston', 'US']
const BOSTON_GB: Place = [2655138, 'Boston', 'GB']

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
       10.08.2026), and the codebook is 1300 KB that nobody who merely opened a
       form has asked for. */
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
    const many: Place[] = Array.from({ length: 40 }, (_, at) => [1000 + at, `Nova ${String(at)}`, 'RS'])

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

/* Real towns again, and these are what 02.10.2026 did to the codebook: towns of
   one country that were called alike carry the nearest bigger town in brackets
   (owner, PDL „Odluke iz ciscenja nalaza (02.10.2026, vlasnik)"), and what a
   person types is still the bare name. */
const YANTAI: Place[] = [
  [1787093, 'Yantai (Dalian)', 'CN'],
  [1942254, 'Yantai (Chengxi)', 'CN'],
]
/* Italy keeps its bare Rome, and the two towns of the United States that are
   called Rome carry a label each. */
const ROME: Place[] = [
  [3169070, 'Rome', 'IT'],
  [4219762, 'Rome (Marietta)', 'US'],
  [5134295, 'Rome (Utica)', 'US'],
]
const BELOTIC: Place[] = [
  [3204307, 'Belotić (Bogatić)', 'RS'],
  [3204308, 'Belotić (Šabac)', 'RS'],
]
/* A bracket that is not a label. GeoNames writes this village of Serbia with
   one in its name, and no other town of Serbia is called Dubova: the bare
   Dubova of the codebook is the Romanian town. */
const DUBOVA: Place[] = [
  [678796, 'Dubova', 'RO'],
  [790977, 'Dubova (Driloni)', 'RS'],
]

describe('the name before a bracket', () => {
  it('is what stands before the last bracket group of a name', () => {
    expect(nameBeforeItsBracket('Yantai (Dalian)')).toBe('Yantai')
    /* A bracket a town was written with is read the same way. Whether it is a
       label is a question about how many towns carry it, asked below. */
    expect(nameBeforeItsBracket('Halle (Saale)')).toBe('Halle')
  })

  it('is nothing for a name that does not end in a bracket', () => {
    expect(nameBeforeItsBracket('Rome')).toBeUndefined()
    expect(nameBeforeItsBracket('Zürich (Kreis 4) / Aussersihl')).toBeUndefined()
  })

  it('is nothing for a bracket that is not a group of its own after a name and a space', () => {
    /* No space before it, a bracket inside it, and nothing before it. */
    expect(nameBeforeItsBracket('Foo(Bar)')).toBeUndefined()
    expect(nameBeforeItsBracket('Neustadt (Halle (Saale))')).toBeUndefined()
    expect(nameBeforeItsBracket(' (Bar)')).toBeUndefined()
  })
})

describe('the countries a name stands in', () => {
  it('is every country that holds a town of that name, folded the way a name is typed', () => {
    const countries = countriesByName(SOME)

    expect(countries.get('boston')).toEqual(new Set(['US', 'GB']))
    expect(countries.get('uzice')).toEqual(new Set(['RS']))
    /* The English name is a name of the town too. */
    expect(countries.get('belgrade')).toEqual(new Set(['RS']))
    expect(countries.get('beograd')).toEqual(new Set(['RS']))
    expect(countries.get('nowhere')).toBeUndefined()
  })

  it('reads the label a namesake carries as the bare name it was added to, and keeps the whole name too', () => {
    /* Before the labels „Yantai" stood in China twice, and a person who typed it
       out in full was in China. Written as it is now it stands nowhere, unless
       the bare name is read back out of the two that carry it. */
    const countries = countriesByName([...YANTAI, ...ROME, ...BELOTIC])

    expect(countries.get('yantai')).toEqual(new Set(['CN']))
    expect(countries.get('yantai (dalian)')).toEqual(new Set(['CN']))
    /* And a bare name the other towns of it no longer carry is still in the
       country that holds the bare one: Rome is Italian and American. */
    expect(countries.get('rome')).toEqual(new Set(['IT', 'US']))
    expect(countries.get('rome (utica)')).toEqual(new Set(['US']))
    /* The bare name is folded like every other, marks and capitals gone. */
    expect(countries.get('belotic')).toEqual(new Set(['RS']))
    expect(countries.get('belotic (sabac)')).toEqual(new Set(['RS']))
  })

  it('does not read a bracket that a town wrote itself as a label', () => {
    /* A label is what makes two namesakes two names, so it comes in twos. One
       town with a bracket of its own has no namesake to be told from, and its
       bare name was never a name of anything. */
    const countries = countriesByName(DUBOVA)

    expect(countries.get('dubova')).toEqual(new Set(['RO']))
    expect(countries.get('dubova (driloni)')).toEqual(new Set(['RS']))
    expect(countriesByName([[2925535, 'Frankfurt (Oder)', 'DE']]).get('frankfurt')).toBeUndefined()
  })

  it('counts the towns under one bare name country by country', () => {
    /* Made up, and the only such case in this file: no real codebook has a bare
       name carried under a bracket by one town in each of two other countries.
       Counted over the world these two would be a namesake pair and would take
       a country away from the bare Foo. Counted country by country each is one
       town with a bracket of its own, and Foo stays where it was. */
    const countries = countriesByName([
      [1, 'Foo', 'AA'],
      [2, 'Foo (Bar)', 'BB'],
      [3, 'Foo (Baz)', 'CC'],
    ])

    expect(countries.get('foo')).toEqual(new Set(['AA']))
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
