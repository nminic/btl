import {
  daysBetween,
  nextPrice,
  nextPriceStart,
  PRICES,
  priceOn,
  registrationOpen,
  seasonOnOffer,
} from './pricing'

describe('the four periods', () => {
  it('tile the year with no gap and no overlap', () => {
    /* What lets priceOn always have an answer, and therefore what lets the
       screens stop carrying a "membership is not on sale yet" for the day the
       list runs out. If a period is ever moved, this is what says so. */
    const inOrder = [...PRICES].sort((left, right) => left.from.localeCompare(right.from))

    expect(inOrder[0].from).toBe('01-01')
    expect(inOrder[inOrder.length - 1].to).toBe('12-31')

    inOrder.slice(1).forEach((row, index) => {
      const before = inOrder[index]
      const dayAfter = new Date(Date.parse(`2027-${before.to}T00:00:00Z`) + 86_400_000)

      expect(row.from).toBe(dayAfter.toISOString().slice(5, 10))
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

describe('what comes next', () => {
  it('is the next period of the year', () => {
    expect(nextPrice('2026-10-01').eur).toBe(40)
    expect(nextPriceStart('2026-10-01')).toBe('2026-10-06')
  })

  it('wraps to the next year rather than running out', () => {
    // After the last period of the year the list starts again, in January.
    expect(nextPrice('2026-12-20').key).toBe('season')
    expect(nextPriceStart('2026-12-20')).toBe('2027-01-01')
  })

  it('is the first period of the selling year while the season is running', () => {
    expect(nextPrice('2027-03-01').eur).toBe(35)
    expect(nextPriceStart('2027-03-01')).toBe('2027-10-01')
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

describe('seasonOnOffer', () => {
  it('never offers a season before the first one', () => {
    /* 2026 is the year the portal is built in and there is no 2026 season
       (PDL P2). The price list was quoting for it through the whole summer,
       because the calendar answer in July 2026 is 2026. */
    expect(seasonOnOffer('2026-07-30')).toBe(2027)
    expect(seasonOnOffer('2026-10-02')).toBe(2027)
  })

  it('turns over on the first of October, every year after that', () => {
    expect(seasonOnOffer('2027-09-30')).toBe(2027)
    expect(seasonOnOffer('2027-10-01')).toBe(2028)
    expect(seasonOnOffer('2031-03-01')).toBe(2031)
  })
})
