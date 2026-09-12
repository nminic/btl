import { categoryOf } from './raceCategory'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MOCK = join(process.cwd(), 'public/mock')

type Served = { file: string; distanceKm: number; category: string }

/**
 * Every record the portal serves that carries a length AND a category, found by
 * reading the directory rather than by naming the files.
 *
 * A list of files here would be the same mistake one level up: the first round of
 * this floor knew `races.json` and missed `results.json`, where every one of 3528
 * results carries its own category and three screens read it straight off the
 * record. Asked of the directory, a file that starts carrying a category tomorrow
 * is swept the day it appears, and no list has to be remembered.
 */
function everythingServedWithACategory(): Served[] {
  return readdirSync(MOCK)
    .filter((name) => name.endsWith('.json'))
    .flatMap((file) => {
      const parsed: unknown = JSON.parse(readFileSync(join(MOCK, file), 'utf-8'))
      const records: unknown[] = Array.isArray(parsed) ? parsed : Object.values(parsed as object)

      return records
        .filter(
          (one): one is { distanceKm: number; category: string } =>
            typeof one === 'object' && one !== null && 'distanceKm' in one && 'category' in one,
        )
        .map((one) => ({ file, distanceKm: one.distanceKm, category: one.category }))
    })
}

const SERVED: Served[] = everythingServedWithACategory()

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

  it('answers what the portal serves, everywhere the portal serves a category', () => {
    /* ONE RULE WITH FIVE HOMES, and this floor holds the two that live in the
       browser. `race.category` and `result.category` are generated columns and the
       backend holds those two against `races.json`
       (`RaceCategoryMatchesWhatThePortalServesTest`). The other two are served
       files - `races.json` and `results.json`, the second with a category on each
       of 3528 results, read straight off the record by the competitor's profile,
       the event page and „Moji rezultati" - and the fifth is `categoryOf` here,
       which the administration's form and a reported result draw with.

       Both rounds that found this were the same mistake at different depths: round
       one knew three homes and missed this function, round two knew four and missed
       `results.json`. So nothing here is named: the sweep reads the directory, and
       whatever is served with a length and a category is compared with what this
       function answers for that length.

       The case above is the rule asked at its edges; this one is the rule asked of
       every length the portal has ever served, which is a sweep nobody typed. */
    const lengths = new Set(SERVED.map((one) => one.distanceKm))
    const files = new Set(SERVED.map((one) => one.file))

    expect(files.size).toBeGreaterThan(1)
    expect(SERVED.length).toBeGreaterThan(4000)
    expect(lengths).toContain(42.2)
    expect(lengths).toContain(21.1)

    const disagreed = SERVED.filter((one) => categoryOf(one.distanceKm) !== one.category)

    expect(
      disagreed.slice(0, 5).map((one) => `${one.file}, ${one.distanceKm} km: served ${one.category}`),
    ).toEqual([])
  })
})
