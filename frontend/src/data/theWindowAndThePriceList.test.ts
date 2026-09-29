import { describe, expect, it } from 'vitest'

import { PRICES } from './pricing'
import { inYearlyWindow } from './season'

/* THE DAY THE PRICE LIST STARTS SELLING NEXT SEASON IS THE DAY THE YEARLY WINDOW OPENS.
 *
 * **Why this file exists.** One boundary lives in two constants that cannot see each other:
 * `PRICES` in `data/pricing.ts` holds the days the selling year runs between, and
 * `WINDOW_OPENS` in `data/season.ts` holds the day renewal and transfers open. The owner's
 * decision of 29.09.2026 is that they are ONE fact - „Zelim da prvi period postane 15-31.
 * oktobar [...] S tim na umu zelim i da se prelazni rok i sve ostalo otvara 15.10. ubuduce, a
 * ne 1.10." - and until this file nothing would have noticed if one of them moved alone.
 *
 * **NEITHER SIDE IS A COPY OF THE OTHER.** No day of the year is written here: the expected
 * side is read out of `PRICES`, and the measured side is `inYearlyWindow`'s BEHAVIOUR. The two
 * modules share no constant, so a mutation that moves one cannot move the other with it - which
 * is the whole failure of a floor that repeats the condition it measures (ADL, 29.09.2026).
 *
 * **WHICH ROWS ARE THE SELLING YEAR IS DERIVED AND NOT NAMED.** A period that buys a place in
 * the standing sells a season that has not begun; the one that does not (`ranking: false`) is
 * the season already running, sold without the right to be ranked. So the boundary is taken
 * from the ranked rows and no key - not 'early', not 'late' - appears in this file. A fifth
 * period added tomorrow is inside this question the day it is written.
 *
 * **The backend carries the identical pair and the identical floor**, in
 * `TheSellingYearAndTheTransferWindowOpenOnOneDayTest`, which asks `price_row` for the day and
 * `SeasonClock` for the behaviour. Four homes, one boundary, and a floor on each side.
 */

/** The two years walked, neither of them 2026, and the second a leap year. */
const SEASONS = [2027, 2028]

const ranked = PRICES.filter((row) => row.ranking)

/* Reduced rather than sorted and indexed, and the reason is a type rather than taste:
   `sort()[0]` is `string | undefined` because an array may be empty, and this repository
   forbids `as` (ADL A14) - so the choice is a cast, a helper, or an expression that is
   definite by construction. `reduce` with no initial value is the third. What happens on
   an empty list is an exception rather than a wrong answer, and the case above asserts
   the list is not empty before any of this is read.

   Found by `npm run build` and by nothing else: vitest strips types rather than checking
   them, so this file was green while it would not compile. */
function sellingYearOpens(): string {
  return ranked.map((row) => row.from).reduce((first, day) => (day < first ? day : first))
}

function sellingYearCloses(): string {
  return ranked.map((row) => row.to).reduce((last, day) => (day > last ? day : last))
}

/** `YYYY-MM-DD`, moved by whole days through the one calendar the platform has. */
function dayAround(season: number, monthDay: string, by: number): string {
  const day = new Date(Date.UTC(season, Number(monthDay.slice(0, 2)) - 1, Number(monthDay.slice(3))))

  day.setUTCDate(day.getUTCDate() + by)

  return day.toISOString().slice(0, 10)
}

describe('the yearly window and the selling year open on one day', () => {
  it('has a selling year to read the boundary off, or it measures nothing', () => {
    expect(ranked.length).toBeGreaterThan(0)
    expect(sellingYearOpens()).toMatch(/^\d{2}-\d{2}$/)
    expect(sellingYearCloses()).toMatch(/^\d{2}-\d{2}$/)
  })

  it.each(SEASONS)('opens in %i on the day the price list starts selling next season', (season) => {
    const opens = sellingYearOpens()

    /* Both sides, because one alone says nothing: a window open on every day of the year
       would pass the second, and one that never opened would pass the first. */
    expect(inYearlyWindow(dayAround(season, opens, -1))).toBe(false)
    expect(inYearlyWindow(dayAround(season, opens, 0))).toBe(true)
  })

  it.each(SEASONS)('and shuts in %i when the selling year does', (season) => {
    const closes = sellingYearCloses()

    expect(inYearlyWindow(dayAround(season, closes, 0))).toBe(true)
    expect(inYearlyWindow(dayAround(season, closes, 1))).toBe(false)
  })
})
