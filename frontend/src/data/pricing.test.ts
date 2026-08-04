import { daysBetween, PRICES, priceOn, registrationOpen } from './pricing'
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
