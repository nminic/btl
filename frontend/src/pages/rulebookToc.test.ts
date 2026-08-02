import { slugify, withIds } from './rulebookToc'

/* The four cases below were written against a wrapper that turned a list of
   headings into the shape `withIds` takes. The wrapper had no caller left on the
   portal, so it is gone and the shaping is here, where it belongs to the tests
   that need it. */
const only = (headings: string[]) => headings.map((heading) => ({ heading }))

describe('slugify', () => {
  it('carries our letters into an address', () => {
    expect(slugify('Šta se boduje')).toBe('sta-se-boduje')
    expect(slugify('Član 5. Đaci i čekanje, žurba, ćutanje')).toBe(
      'clan-5-daci-i-cekanje-zurba-cutanje',
    )
  })

  it('leaves nothing but lowercase letters, digits and hyphens', () => {
    expect(slugify('12. Rang liste i plasman')).toBe('12-rang-liste-i-plasman')
    expect(slugify('  Nagrade (i beneficije)!  ')).toBe('nagrade-i-beneficije')
  })
})

describe('withIds', () => {
  it('gives every heading the id its link points at', () => {
    expect(withIds(only(['1. Uvodne odredbe', '2. Sezona i rokovi']))).toEqual([
      { heading: '1. Uvodne odredbe', id: '1-uvodne-odredbe' },
      { heading: '2. Sezona i rokovi', id: '2-sezona-i-rokovi' },
    ])
  })

  it('falls back to the position when two headings read the same', () => {
    expect(withIds(only(['Nagrade', 'Nagrade']))).toEqual([
      { heading: 'Nagrade', id: 'nagrade' },
      { heading: 'Nagrade', id: 'sekcija-2' },
    ])
  })

  it('falls back to the position when a heading holds no letters', () => {
    expect(withIds(only(['***']))).toEqual([{ heading: '***', id: 'sekcija-1' }])
  })

  it('goes past the fallback when a heading already reads like one', () => {
    // "Sekcija 3" slugifies to the very id the third heading falls back to.
    const entries = withIds(only(['Sekcija 3', 'x', 'x']))

    expect(entries.map((one) => one.id)).toEqual(['sekcija-3', 'x', 'sekcija-3-2'])
    expect(new Set(entries.map((one) => one.id)).size).toBe(entries.length)
  })
})
