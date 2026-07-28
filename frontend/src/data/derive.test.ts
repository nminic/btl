import {
  categoriesOf,
  eventsInMonth,
  monthsWithEvents,
  rankingFor,
  resultsOf,
  seasonsWithResults,
  totalsOf,
} from './derive'
import type { BtlEvent, Competitor, Result } from './types'

const competitor = (memberNumber: string, extra: Partial<Competitor> = {}): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: 'Prezime',
  gender: memberNumber.startsWith('F') ? 'F' : 'M',
  city: 'Beograd',
  country: 'RS',
  categoryCode: memberNumber.startsWith('F') ? 'Ž A' : 'M A',
  firstSeason: 2027,
  active: true,
  membershipBasis: 'payment',
  teamId: null,
  ...extra,
})

const result = (memberNumber: string, date: string, points: number, extra: Partial<Result> = {}): Result => ({
  id: `${memberNumber}-${date}-${points}`,
  memberNumber,
  raceId: 'race',
  eventName: 'Trka',
  date,
  distanceKm: 10,
  ascentM: 100,
  descentM: 100,
  seconds: 3000,
  points,
  category: 'short',
  ...extra,
})

describe('totals', () => {
  it('adds up every measure', () => {
    expect(totalsOf([result('M0001', '2027-01-01', 5), result('M0001', '2027-02-01', 3)])).toEqual({
      races: 2,
      kilometers: 20,
      ascent: 200,
      descent: 200,
      seconds: 6000,
      points: 8,
    })
  })

  it('is zero for nobody', () => {
    expect(totalsOf([]).races).toBe(0)
  })
})

describe('seasonsWithResults', () => {
  it('lists each season once, newest first', () => {
    const results = [
      result('M0001', '2025-05-05', 1),
      result('M0001', '2027-05-05', 1),
      result('M0002', '2025-06-06', 1),
    ]

    expect(seasonsWithResults(results)).toEqual([2027, 2025])
  })
})

describe('resultsOf', () => {
  const results = [
    result('M0001', '2026-01-01', 1),
    result('M0001', '2027-03-03', 1),
    result('M0002', '2027-04-04', 1),
  ]

  it('takes one competitor, newest first', () => {
    expect(resultsOf(results, 'M0001').map((r) => r.date)).toEqual(['2027-03-03', '2026-01-01'])
  })

  it('narrows to one season when asked', () => {
    expect(resultsOf(results, 'M0001', 2026)).toHaveLength(1)
  })
})

describe('rankingFor', () => {
  const competitors = [
    competitor('M0001'),
    competitor('M0002'),
    competitor('M0003', { categoryCode: 'M B', firstName: 'Vukašin' }),
    competitor('F0001'),
  ]

  const results = [
    result('M0001', '2027-01-01', 10),
    result('M0002', '2027-01-01', 6),
    result('M0002', '2027-02-01', 4),
    result('M0003', '2027-02-01', 4),
    result('F0001', '2027-01-01', 20),
    result('M0001', '2026-01-01', 99),
  ]

  it('keeps the men and the women apart', () => {
    const men = rankingFor(competitors, results, { season: 2027, gender: 'M' })

    expect(men.map((row) => row.competitor.memberNumber)).toEqual(['M0002', 'M0001', 'M0003'])
    expect(rankingFor(competitors, results, { season: 2027, gender: 'F' })).toHaveLength(1)
  })

  it('sums every race of the season and no other season', () => {
    const [first, second] = rankingFor(competitors, results, { season: 2027, gender: 'M' })

    expect(first.points).toBe(10)
    expect(first.races).toBe(2)
    expect(second.points).toBe(10)
    // 99 points from 2026 must not leak into the 2027 standing.
    expect(second.races).toBe(1)
  })

  it('breaks a tie in favour of more races, never fewer', () => {
    const men = rankingFor(competitors, results, { season: 2027, gender: 'M' })

    // M0001 and M0002 both have 10 points; M0002 ran twice for them.
    expect(men[0].competitor.memberNumber).toBe('M0002')
    expect(men[0].position).toBe(1)
    expect(men[1].position).toBe(2)
  })

  it('leaves out anyone who did not race that season', () => {
    expect(rankingFor(competitors, results, { season: 2024, gender: 'M' })).toEqual([])
  })

  it('filters by category', () => {
    const rows = rankingFor(competitors, results, {
      season: 2027,
      gender: 'M',
      categoryCode: 'M B',
    })

    expect(rows.map((row) => row.competitor.memberNumber)).toEqual(['M0003'])
  })

  it('searches by name and by member number, keeping the real position', () => {
    const byName = rankingFor(competitors, results, {
      season: 2027,
      gender: 'M',
      search: 'vukašin',
    })
    const byNumber = rankingFor(competitors, results, {
      season: 2027,
      gender: 'M',
      search: 'M0001',
    })

    expect(byName).toHaveLength(1)
    // Position 3 and not 1: searching narrows the view, it does not re-rank.
    expect(byName[0].position).toBe(3)
    expect(byNumber[0].competitor.memberNumber).toBe('M0001')
  })

  it('ignores an empty search', () => {
    expect(rankingFor(competitors, results, { season: 2027, gender: 'M', search: '  ' })).toHaveLength(3)
  })
})

describe('categoriesOf', () => {
  it('lists the categories of one gender, sorted', () => {
    const competitors = [
      competitor('M0001', { categoryCode: 'M B' }),
      competitor('M0002', { categoryCode: 'M A' }),
      competitor('M0003', { categoryCode: 'M A' }),
      competitor('F0001'),
    ]

    expect(categoriesOf(competitors, 'M')).toEqual(['M A', 'M B'])
  })
})

describe('calendar helpers', () => {
  const events: BtlEvent[] = [
    {
      id: 'a', slug: 'a', name: 'A', date: '2027-03-06', city: 'Beograd', country: 'RS',
      organizer: 'x', status: 'confirmed', raceIds: [],
    },
    {
      id: 'b', slug: 'b', name: 'B', date: '2027-03-02', city: 'Niš', country: 'RS',
      organizer: 'x', status: 'announced', raceIds: [],
    },
    {
      id: 'c', slug: 'c', name: 'C', date: '2027-04-10', city: 'Niš', country: 'RS',
      organizer: 'x', status: 'announced', raceIds: [],
    },
  ]

  it('takes one month, in date order', () => {
    expect(eventsInMonth(events, 2027, 3).map((event) => event.id)).toEqual(['b', 'a'])
    expect(eventsInMonth(events, 2027, 12)).toEqual([])
  })

  it('lists the months that hold something, oldest first', () => {
    expect(monthsWithEvents(events)).toEqual(['2027-03', '2027-04'])
  })
})
