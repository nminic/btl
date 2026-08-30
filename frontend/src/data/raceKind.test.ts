import { describe, expect, it } from 'vitest'
import { RACE_KINDS } from './types'
import { raceKind } from './raceKind'

/* The one home for reading which of the three kinds a race is, asked directly.
 *
 * ADL A31 asks for that: a fact moved into one home gets a guard of its own beside
 * it, rather than being held only through whoever happens to call it. Six places
 * call this one, and each of them would go on passing if this answered a fourth
 * thing to somebody else's word.
 */
describe('a race kind read off a record', () => {
  it('hands back each of the three words it knows, unchanged', () => {
    /* Walked over the list rather than named one by one, so a kind added to
       `RACE_KINDS` is asked the same question without anybody remembering to. */
    for (const known of RACE_KINDS) {
      expect(raceKind(known), known).toBe(known)
    }
  })

  it('reads anything else as a race of a length', () => {
    /* Which is what every race was before the field existed and what all 1612 in the
       file still are, so a word this portal has never heard of is read as the thing
       it would have been read as anyway.

       Four shapes of „anything else", because they arrive by different roads: a
       misspelling of a real kind, a word from another domain, the empty string a
       record written before this field existed carries, and a word that differs only
       in case, since the store keeps every value as text and nothing upper-cases it
       on the way. */
    expect(raceKind('lenght')).toBe('length')
    expect(raceKind('ludilo')).toBe('length')
    expect(raceKind('')).toBe('length')
    expect(raceKind('Time')).toBe('length')
  })
})
