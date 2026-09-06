import { earnedDucats, quantityOf } from './ducatEarned'
import type { DucatFamily } from './ducatRule'
import type { Competitor, Result } from './types'
import { first } from '../test/at'

const member: Competitor = {
  memberNumber: '000001',
  firstName: 'Ana',
  lastName: 'Ilić',
  gender: 'F',
  city: 'Novi Sad',
  country: 'RS',
  birthYear: 1990,
  firstSeason2027: false,
  firstSeason: 2027,
  active: true,
  membershipBasis: 'payment',
  referralCode: 'proba0000',
  referredBy: null,
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  bio: '',
}

let made = 0

/** One result, with only the numbers a rule ever reads spelled out. */
function race(date: string, over: Partial<Result> = {}): Result {
  made += 1

  return {
    id: `r${made}`,
    memberNumber: '000001',
    raceId: `t${made}`,
    raceName: 'Trka',
    eventName: 'Trka',
    eventSlug: 'trka',
    date,
    distanceKm: 10,
    ascentM: 100,
    descentM: 80,
    seconds: 3600,
    points: 20,
    category: 'short',
    ...over,
  }
}

const family: DucatFamily = {
  id: 'duk-proba',
  name: 'Proba',
  kind: 'raceCount',
  value: 2,
  period: 'always',
  top: 'ISTRČANIH',
  topFemale: '',
  bottom: 'TRKA',
  periodAt: 'none',
  mark: 'races',
  art: 'none',
  tier: 3,
  step: 0,
  last: 0,
  tierUpFrom: 0,
  counted: 'trka',
}

describe('the quantity a kind names', () => {
  const races = [
    race('2027-03-01', { category: 'marathon', distanceKm: 42.2, points: 60, seconds: 12600 }),
    race('2027-04-01', { category: 'half', distanceKm: 21.1, ascentM: 300, descentM: 250 }),
    race('2028-05-01', { category: 'ultra', distanceKm: 90 }),
    race('2028-06-01', { category: 'long' }),
    race('2028-07-01', { category: 'short' }),
  ]

  it('counts the races of each length, and all of them', () => {
    expect(quantityOf('raceCount', races)).toBe(5)
    expect(quantityOf('marathonCount', races)).toBe(1)
    expect(quantityOf('halfCount', races)).toBe(1)
    expect(quantityOf('ultraCount', races)).toBe(1)
    expect(quantityOf('longCount', races)).toBe(1)
    expect(quantityOf('shortCount', races)).toBe(1)
  })

  it('adds up what is added up', () => {
    expect(quantityOf('totalKm', races)).toBeCloseTo(173.3, 5)
    expect(quantityOf('totalAscent', races)).toBe(700)
    expect(quantityOf('totalDescent', races)).toBe(570)
    expect(quantityOf('points', races)).toBe(140)
  })

  it('counts time in hours, because that is what a rule about time is written in', () => {
    expect(quantityOf('totalTime', races)).toBeCloseTo(7.5, 5)
  })

  it('counts the seasons raced in, not the ones a member has been a member for', () => {
    expect(quantityOf('seasonCount', races)).toBe(2)
  })

  it('takes the best single race, never the sum of them', () => {
    expect(quantityOf('bestRacePoints', races)).toBe(60)
    expect(quantityOf('bestRaceKm', races)).toBe(90)
    expect(quantityOf('bestRaceAscent', races)).toBe(300)
  })

  it('answers nought for countries, and that is a debt rather than an answer', () => {
    /* A result does not carry the country; the event it belongs to does. Nought
       is the safe way round, because a ducat given wrongly is given for ever
       (ADL A12, 4 and 8). A family of ducats now depends on this, so it is owed
       to the database rather than merely noted. */
    expect(quantityOf('countryCount', races)).toBe(0)
  })
})

describe('the ducats a competitor has earned', () => {
  const races = [race('2027-01-05'), race('2027-01-20'), race('2027-02-03')]

  it('gives one when the quantity reaches the threshold', () => {
    expect(earnedDucats(member, races, [family], '2027-06-01')).toHaveLength(1)
  })

  it('gives none when it does not', () => {
    expect(earnedDucats(member, races, [{ ...family, value: 4 }], '2027-06-01')).toHaveLength(0)
  })

  it('weighs a month against that month alone', () => {
    /* The whole reason the families are expanded before they are compared: two
       races in January and one in February is a January ducat and no February
       one. Compared as one condition over the lot, it would be three races and
       every month would light up (ADL A12, 7). */
    const monthly = { ...family, period: 'month' as const, periodAt: 'bottom' as const, value: 2 }
    const earned = earnedDucats(member, races, [monthly], '2027-03-01')

    expect(earned).toHaveLength(1)
    expect(first(earned).from).toBe('2027-01-01')
  })

  it('reads the races of this member and nobody else', () => {
    const others = [...races, race('2027-02-04', { memberNumber: '000002' })]
    const monthly = { ...family, period: 'month' as const, value: 2 }

    expect(earnedDucats(member, others, [monthly], '2027-03-01')).toHaveLength(1)
  })

  it('gives every step of a series that has been passed, and no more', () => {
    const series = { ...family, value: 1, step: 1, last: 5 }
    const earned = earnedDucats(member, races, [series], '2027-06-01')

    expect(earned.map((one) => one.value)).toEqual([1, 2, 3])
  })

  it('reads the legend in the words of the member whose profile it is', () => {
    const gendered = { ...family, top: 'TRČAO U', topFemale: 'TRČALA U' }

    expect(first(earnedDucats(member, races, [gendered], '2027-06-01')).top).toBe('TRČALA U')
  })

  it('counts a race run on the first day of a period, and on the last', () => {
    /* Both ends of the range are inside it (ADL A12, 2b). Every other fixture
       here runs in the middle of a month, so the two comparisons that decide it
       could both be loosened without a test noticing: a member whose hundred and
       twenty fifth kilometre falls on the thirty first of July would simply not
       be given July. */
    const edges = [race('2027-07-01'), race('2027-07-31')]
    const monthly = { ...family, period: 'month' as const, value: 2 }
    const earned = earnedDucats(member, edges, [monthly], '2027-08-01')

    expect(earned).toHaveLength(1)
    expect(first(earned).from).toBe('2027-07-01')
  })

  it('leaves out a race one day outside the period on either side', () => {
    const outside = [race('2027-06-30'), race('2027-08-01')]
    const monthly = { ...family, period: 'month' as const, value: 1 }
    const earned = earnedDucats(member, outside, [monthly], '2027-08-01')

    expect(earned.map((one) => one.from)).toEqual(['2027-06-01', '2027-08-01'])
  })
})
