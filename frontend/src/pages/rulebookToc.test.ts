import { slugify, tableOfContents } from './rulebookToc'

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

describe('tableOfContents', () => {
  it('gives every heading the id its link points at', () => {
    expect(tableOfContents(['1. Uvodne odredbe', '2. Sezona i rokovi'])).toEqual([
      { heading: '1. Uvodne odredbe', id: '1-uvodne-odredbe' },
      { heading: '2. Sezona i rokovi', id: '2-sezona-i-rokovi' },
    ])
  })

  it('falls back to the position when two headings read the same', () => {
    expect(tableOfContents(['Nagrade', 'Nagrade'])).toEqual([
      { heading: 'Nagrade', id: 'nagrade' },
      { heading: 'Nagrade', id: 'sekcija-2' },
    ])
  })

  it('falls back to the position when a heading holds no letters', () => {
    expect(tableOfContents(['***'])).toEqual([{ heading: '***', id: 'sekcija-1' }])
  })

  it('goes past the fallback when a heading already reads like one', () => {
    // "Sekcija 3" slugifies to the very id the third heading falls back to.
    const entries = tableOfContents(['Sekcija 3', 'x', 'x'])

    expect(entries.map((one) => one.id)).toEqual(['sekcija-3', 'x', 'sekcija-3-2'])
    expect(new Set(entries.map((one) => one.id)).size).toBe(entries.length)
  })
})
