import {
  daysBetween,
  juniorInSeason,
  PRICES,
  priceOn,
  registrationOpen,
  seasonBeingRenewed,
} from './pricing'
import { first, last } from '../test/at'

describe('the four periods', () => {
  it('tile the year with no gap and no overlap', () => {
    /* What lets priceOn always have an answer, and therefore what lets the
       screens stop carrying a "membership is not on sale yet" for the day the
       list runs out. If a period is ever moved, this is what says so. */
    const inOrder = [...PRICES].sort((left, right) => left.from.localeCompare(right.from))

    expect(first(inOrder).from).toBe('01-01')
    expect(last(inOrder).to).toBe('12-31')

    /* Each period against the one before it, walked rather than indexed: reduce
       without a starting value hands the row before to every step, and the pair
       is what "no gap and no overlap" is a claim about. It is also how priceOn
       walks the same list. */
    inOrder.reduce((before, row) => {
      const dayAfter = new Date(Date.parse(`2027-${before.to}T00:00:00Z`) + 86_400_000)

      expect(row.from).toBe(dayAfter.toISOString().slice(5, 10))

      return row
    })
  })
})

describe('priceOn', () => {
  it('finds the price in force', () => {
    expect(priceOn('2026-10-01').eur).toBe(35)
    expect(priceOn('2026-10-05').eur).toBe(35)
    expect(priceOn('2026-10-06').eur).toBe(40)
    expect(priceOn('2026-11-30').eur).toBe(40)
    expect(priceOn('2026-12-01').eur).toBe(50)
    expect(priceOn('2026-12-31').eur).toBe(50)
  })

  it('answers on any day of any year, because the periods repeat', () => {
    /* Owner, 30.07.2026: membership for 2027 is sold until 30 September 2027,
       and on 1 October the same four open again for 2028. Written as dates the
       list would have run out and the portal would have stopped having a price
       on a morning nobody was watching. */
    expect(priceOn('2031-10-02').eur).toBe(35)
    expect(priceOn('2031-05-05').eur).toBe(40)
    expect(priceOn('2026-09-20').eur).toBe(40)
    expect(priceOn('2026-01-01').eur).toBe(40)
  })

  it('gives the in-season price no place in the standing', () => {
    expect(priceOn('2027-03-01').ranking).toBe(false)
    expect(priceOn('2027-09-30').ranking).toBe(false)
    expect(priceOn('2026-10-01').ranking).toBe(true)
  })
})

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-10-01', '2026-10-06')).toBe(5)
    expect(daysBetween('2026-10-06', '2026-10-06')).toBe(0)
  })
})

describe('registrationOpen', () => {
  it('is shut during the period of looking around', () => {
    /* The launch happens once, so this is a real date and not a day of the
       year: the portal is open for looking only until 1 October 2026. */
    expect(registrationOpen('2026-09-29')).toBe(false)
    expect(registrationOpen('2026-10-01')).toBe(true)
  })
})

/* Two pieces went out on 04.08.2026 with the screens that read them: what the
 * next price is and when it starts, which the widget on the front page said, and
 * which season is on sale, which the page of prices said. Both screens are gone
 * (owner), and a function nothing calls is a function nothing can be wrong
 * about.
 */

describe('the season a renewal is for', () => {
  /* Read by the screen of prices, to name the season whose referral amount is
   * settled, and by the membership screen, to head the renewal. Three numbers
   * meet in it and a single day cannot tell them apart, which is how a review
   * replaced the whole call with the literal 2027 and passed: in October 2026 the
   * clock, the constant and the floor all answer the same thing.
   */

  it('is next year, once the portal is past the first official season', () => {
    expect(seasonBeingRenewed('2027-11-01')).toBe(2028)
    expect(seasonBeingRenewed('2028-01-15')).toBe(2029)
  })

  it('never answers a season before the first one the league runs', () => {
    /* The floor, and the only place it shows. Somebody reading the portal as an
       earlier year, which the switch of days allows, is renewing 2027 and nothing
       earlier: there is no 2026 season to renew. Without it the screen would head
       a renewal with a season the league never held. */
    expect(seasonBeingRenewed('2025-11-01')).toBe(2027)
    expect(seasonBeingRenewed('2024-01-01')).toBe(2027)
    expect(seasonBeingRenewed('2026-11-01')).toBe(2027)
  })
})

describe('who pays the junior fee', () => {
  /* **Tested here directly since 13.09.2026, and nowhere else.** Until then no case
     named this function: the only thing that ran it was the renewal screen, which
     read a member's year of birth off their record and reached it that way. The year
     has left the record because the record is served publicly and Clan 74 forbids one
     on it (`data/types.ts`), so the screen no longer calls this and the rule would
     have gone untested at the moment it stopped being applied.

     **It is kept, uncalled, on purpose.** It is the only written form of PDL P8's
     junior rule in this repository, the owner corrected its boundary by hand once
     (13.08.2026), and the backend has to arrive at the same answer. It takes two
     numbers rather than a record, so it asks nobody to put a year of birth back where
     one may not be. What no longer exists is a caller, and that is a boundary written
     up at `pages/member/Membership.tsx` and measured in `pages/memberFlows.test.tsx`. */

  it('measures the season rather than the day, so fifteen in it still pays junior', () => {
    /* Somebody born in 2012 turns fifteen during 2027 and was fourteen in January, so
       the season holds a day on which they were fourteen. That is the owner's sentence
       and it is why the test is `<= 15` and not `<= 14`. */
    expect(juniorInSeason(2027, 2012)).toBe(true)
    expect(juniorInSeason(2027, 2011)).toBe(false)
  })

  it('takes in everybody younger, because this is a ceiling and not a band', () => {
    /* Unlike an age band, which sorts people into one of four, this has only an upper
       edge: everybody below it is inside. A newborn pays the junior fee. */
    expect(juniorInSeason(2027, 2027)).toBe(true)
    expect(juniorInSeason(2027, 2020)).toBe(true)
  })

  it('moves with the season, so the same member ages out of it', () => {
    /* The one member of the served thirty two this applies to is born in 2013: junior
       in 2027 and 2028, and not in 2029. Read as three seasons against one year rather
       than one season against three years, because the season is what moves. */
    expect([2027, 2028, 2029].map((season) => juniorInSeason(season, 2013))).toEqual([
      true,
      true,
      false,
    ])
  })

  it('is not the sixteen of a parental signature', () => {
    /* Two rules about young members and they are deliberately different numbers,
       measured differently: this one through the season, the signature on the day the
       form is filled in (PDL P23). Joined once, they were corrected apart on
       12.08.2026. Somebody of sixteen in the season needs the signature question asked
       and does not pay the junior fee. */
    expect(juniorInSeason(2027, 2011)).toBe(false)
  })
})
