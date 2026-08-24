import { categoryOf } from './raceCategory'
import { describe, expect, it } from 'vitest'

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
})
