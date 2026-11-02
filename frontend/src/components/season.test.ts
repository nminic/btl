import { ALL_SEASONS, offeredSeason } from './season'

/* The two rules the comments in season.ts claim and nothing was holding them to:
 * that a year is four digits and not merely digits, and that the running season
 * is on the list whether or not this person raced in it. Both survived being
 * removed, which is another way of saying neither was tested. */
/* The address may pick from the options a screen offers; it may not extend
 * them. Letting it through put the control on a year none of its own options
 * carried, so the control fell to nothing selected and rendered blank while the
 * table under it showed something else entirely. */
describe('offeredSeason', () => {
  it('takes a year the screen offers', () => {
    expect(offeredSeason('2019', [2026, 2019, 2012], '2026')).toBe('2019')
  })

  it('ignores a year the screen does not offer, and keeps the default', () => {
    expect(offeredSeason('1999', [2026, 2019, 2012], '2026')).toBe('2026')
  })

  it('falls back to all of them where there is no year to fall back to', () => {
    expect(offeredSeason('1999', [2026, 2019], undefined)).toBe(ALL_SEASONS)
  })

  it('keeps all of them where that is what was asked for', () => {
    expect(offeredSeason(ALL_SEASONS, [2026, 2019], undefined)).toBe(ALL_SEASONS)
  })

  it('will not take a year that only looks like one', () => {
    /* Four digits pass the shape test in useSeason, so `0999` arrives here as a
       string while the option beside it carries the number 999. The comparison
       is on the string the option carries, which is what stops it. */
    expect(offeredSeason('0999', [2026, 999], undefined)).toBe(ALL_SEASONS)
  })
})
