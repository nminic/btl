import { categoryOf } from './raceCategory'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Every race the portal serves, with the category it is served with. */
const SERVED: { distanceKm: number; category: string }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/races.json'), 'utf-8'),
)

/* The category of a race is read off its length and nobody is ever asked for it.
   Until 24.08.2026 the only guard over that reading was the cell it was drawn in,
   in the table of races of the administration; that column came out on the owner's
   word („U dodavanju trka na događaju (administriranje) ne treba da postoji
   Kategorija kolona ipak"), and the reading would have been left without one.

   Asked of the function instead of a screen, because that is where the rule lives
   and it is read by the boards, the filters and the ducats as well. */
describe('the category of a race', () => {
  it('recognises the two named lengths by the exact value, with no tolerance', () => {
    /* PDL P5. A hundred metres short of a marathon is not a marathon, and the board
       of most marathons must not count it as one. The same on the other side: the
       tolerance nobody granted would make 42.19 one too. */
    expect(categoryOf(42.2)).toBe('marathon')
    expect(categoryOf(42.19)).toBe('long')
    expect(categoryOf(42.1)).toBe('long')

    expect(categoryOf(21.1)).toBe('half')
    expect(categoryOf(21.09)).toBe('short')
  })

  it('reads everything else off the two, and the ends as well', () => {
    /* Over a marathon is an ultra, over a half is long, and the rest is short. The
       ends are asked because the two named lengths are compared before the ranges
       are, so an ordering mistake shows here first. */
    expect(categoryOf(42.21)).toBe('ultra')
    expect(categoryOf(100)).toBe('ultra')

    expect(categoryOf(30)).toBe('long')
    expect(categoryOf(21.11)).toBe('long')

    expect(categoryOf(10)).toBe('short')
    expect(categoryOf(0)).toBe('short')
  })

  it('answers what the portal serves, for every length the portal serves', () => {
    /* THIS FUNCTION IS THE FOURTH HOME OF ONE RULE and until 12.09.2026 it was the
       only one without a floor. The other three are `race.category`,
       `result.category` and this served file, and the backend holds those three
       against the file (`RaceCategoryMatchesWhatThePortalServesTest`). A Java test
       cannot run TypeScript, so this half is held here, against the SAME file: four
       homes pinned to one reference rather than to each other.

       What it caught: the threshold moved here from 42.2 to 42.3 left the whole
       backend floor green, and the administration's form and a reported result would
       have drawn one category while the database scored another.

       The case above is the rule asked at its edges; this one is the rule asked of
       1612 races over 436 distinct lengths, which is a sweep nobody typed. */
    const lengths = new Set(SERVED.map((one) => one.distanceKm))

    expect(lengths.size).toBeGreaterThan(400)
    expect(lengths).toContain(42.2)
    expect(lengths).toContain(21.1)

    const disagreed = SERVED.filter((one) => categoryOf(one.distanceKm) !== one.category)

    expect(
      disagreed.slice(0, 5).map((one) => `${one.distanceKm} km: served ${one.category}`),
    ).toEqual([])
  })
})
