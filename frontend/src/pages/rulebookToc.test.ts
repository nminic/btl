import { at } from '../test/at'
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

  it('spells Cyrillic out, so one name in the two scripts is one address', () => {
    /* The league is Balkan and both are written across it. Without this a name
       in Cyrillic made no address at all, and the two things whose addresses are
       read off a name, a team and an event, ended up with none (ADL A4d). */
    expect(slugify('Дунавски тркачи')).toBe('dunavski-trkaci')
    /* Macedonian and Bulgarian, since the league runs in both. */
    expect(slugify('Скопски полумаратон')).toBe('skopski-polumaraton')
    expect(slugify('Щастливи бегачи')).toBe('stastlivi-begaci')
  })

  it('spells it the way the address already spells the Latin twin of it', () => {
    /* Which is the rule, and the one thing a transliteration table gets wrong.
       Spelt "correctly", ђ becomes dj and Ђердап answers at `djerdap` while
       Đerdap answers at `derdap`: two teams under one name, which is the very
       thing an address is compared for (PDL P13). */
    for (const pair of [
      ['Ђердап', 'Đerdap'],
      ['Ђаци и чекање, журба, ћутање', 'Đaci i čekanje, žurba, ćutanje'],
      ['Џиновски успон', 'Džinovski uspon'],
      ['Ѓорче Петров', 'Gjorče Petrov'],
      ['Ќоседа', 'Kjoseda'],
      ['Ёлка', 'Jolka'],
    ]) {
      const address = slugify(at(pair, 0))

      /* Said as well as compared: the two sides of an equality that both came
         out empty would be equal and would be no address at all. */
      expect(address).not.toBe('')
      expect(address).toBe(slugify(at(pair, 1)))
    }
  })

  it('carries the alphabets the league does not run in as well', () => {
    /* Not for the sake of completeness but for the sentence a member is shown
       when a name makes no address: it says "a letter of Cyrillic", so every
       Cyrillic alphabet in use has to be one. Left out, Ігор and Гор were one
       address and the second was refused as the first. */
    expect(slugify('Ігор')).toBe('igor')
    expect(slugify('Ігор')).not.toBe(slugify('Гор'))
    expect(slugify('Їжак і ґуля')).toBe('jizak-i-gulja')
    expect(slugify('Шумскі ўзгоркі')).toBe('sumski-uzgorki')
  })

  it('drops a Cyrillic letter no alphabet in use writes', () => {
    /* Old letters are not in the table: guessing at what ѣ sounded like buys
       nothing, and a name of nothing but those is refused rather than filed
       under no address (teamProposal.ts). */
    expect(slugify('Језеро ѣ')).toBe('jezero')
    expect(slugify('ѣ')).toBe('')
  })

  it('gives nothing back where a name holds nothing an address can carry', () => {
    /* Which is what the two callers who read an address off a name have to
       refuse, rather than take and file under no address at all. */
    expect(slugify('???')).toBe('')
    expect(slugify('Δρομείς Αθηνών')).toBe('')
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
