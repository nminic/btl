import {
  categoriesOf,
  topByCategory,
  defaultMonth,
  defaultSeason,
  monthGrid,
  eventsInMonth,
  monthsWithEvents,
  bestSingleRaces,
  rankingFor,
  topByKilometers,
  topByTimeOnCourse,
  rankTeams,
  resultsOf,
  seasonsWithResults,
  totalsOf,
} from './derive'
import type { BtlEvent, Competitor, Result, Team } from './types'

const competitor = (memberNumber: string, extra: Partial<Competitor> = {}): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: 'Prezime',
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  birthYear: 1985,
  firstSeason2027: false,
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
    expect(totalsOf([result('000001', '2027-01-01', 5), result('000001', '2027-02-01', 3)])).toEqual({
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
      result('000001', '2025-05-05', 1),
      result('000001', '2027-05-05', 1),
      result('000002', '2025-06-06', 1),
    ]

    expect(seasonsWithResults(results)).toEqual([2027, 2025])
  })
})

describe('resultsOf', () => {
  const results = [
    result('000001', '2026-01-01', 1),
    result('000001', '2027-03-03', 1),
    result('000002', '2027-04-04', 1),
  ]

  it('takes one competitor, newest first', () => {
    expect(resultsOf(results, '000001').map((r) => r.date)).toEqual(['2027-03-03', '2026-01-01'])
  })

  it('narrows to one season when asked', () => {
    expect(resultsOf(results, '000001', 2026)).toHaveLength(1)
  })
})

describe('rankingFor', () => {
  const competitors = [
    competitor('000001'),
    competitor('000002'),
    competitor('000004', { birthYear: 1960, firstName: 'Vukašin' }),
    competitor('000003', { gender: 'F' }),
  ]

  const results = [
    result('000001', '2027-01-01', 10),
    result('000002', '2027-01-01', 6),
    result('000002', '2027-02-01', 4),
    result('000004', '2027-02-01', 4),
    result('000003', '2027-01-01', 20),
    result('000001', '2026-01-01', 99),
  ]

  it('keeps the men and the women apart', () => {
    const men = rankingFor(competitors, results, { season: 2027, gender: 'M' })

    expect(men.map((row) => row.competitor.memberNumber)).toEqual(['000002', '000001', '000004'])
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

    // 000001 and 000002 both have 10 points; 000002 ran twice for them.
    expect(men[0].competitor.memberNumber).toBe('000002')
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
      // Born in 1960, so in the oldest band in 2027 while the rest are 40-54.
      categoryCode: 'M55+',
    })

    expect(rows.map((row) => row.competitor.memberNumber)).toEqual(['000004'])
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
      search: '000001',
    })

    expect(byName).toHaveLength(1)
    // Position 3 and not 1: searching narrows the view, it does not re-rank.
    expect(byName[0].position).toBe(3)
    expect(byNumber[0].competitor.memberNumber).toBe('000001')
  })

  it('ignores an empty search', () => {
    expect(rankingFor(competitors, results, { season: 2027, gender: 'M', search: '  ' })).toHaveLength(3)
  })
})

describe('categoriesOf', () => {
  it('lists the categories of one gender for a season, sorted', () => {
    const competitors = [
      competitor('000001', { birthYear: 1960 }),
      competitor('000002', { birthYear: 1990 }),
      competitor('000004', { birthYear: 1990 }),
      competitor('000003', { gender: 'F' }),
    ]

    expect(categoriesOf(competitors, 'M', 2027)).toEqual(['M25-39', 'M55+'])
  })

  it('moves a member into the next band as the season turns', () => {
    const competitors = [competitor('000001', { birthYear: 1987 })]

    expect(categoriesOf(competitors, 'M', 2026)).toEqual(['M25-39'])
    expect(categoriesOf(competitors, 'M', 2027)).toEqual(['M40-54'])
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

describe('defaultMonth', () => {
  const events: BtlEvent[] = [
    { id: 'a', slug: 'a', name: 'A', date: '2026-03-06', city: 'x', country: 'RS', organizer: 'x', status: 'confirmed', raceIds: [] },
    { id: 'b', slug: 'b', name: 'B', date: '2027-05-02', city: 'x', country: 'RS', organizer: 'x', status: 'confirmed', raceIds: [] },
  ]

  it('opens on the first month from today onwards that holds something', () => {
    expect(defaultMonth(events, '2026-08-01')).toBe('2027-05')
  })

  it('opens on the current month when that month has events', () => {
    expect(defaultMonth(events, '2026-03-15')).toBe('2026-03')
  })

  it('falls back to the last month there is once everything is past', () => {
    expect(defaultMonth(events, '2030-01-01')).toBe('2027-05')
  })

  it('falls back to today when there are no events at all', () => {
    expect(defaultMonth([], '2030-01-01')).toBe('2030-01')
  })
})

describe('monthGrid', () => {
  it('pads to whole weeks, Monday first', () => {
    // 1 May 2027 is a Saturday, so five blanks come first.
    const may = monthGrid(2027, 5)

    expect(may.slice(0, 6)).toEqual([null, null, null, null, null, 1])
    expect(may.length % 7).toBe(0)
    expect(may.filter((day) => day !== null)).toHaveLength(31)
  })

  it('needs no padding when a month starts on Monday and ends on Sunday', () => {
    // February 2027 starts on a Monday and has 28 days.
    expect(monthGrid(2027, 2)).toHaveLength(28)
  })
})

describe('defaultSeason', () => {
  const results = [
    result('000001', '2026-01-01', 1),
    result('000001', '2019-01-01', 1),
    result('000002', '2019-02-01', 1),
    result('000004', '2019-03-01', 1),
  ]

  it('opens on the running season once it has a field', () => {
    const started = [
      ...results,
      result('000002', '2026-02-02', 1),
      result('000004', '2026-03-03', 1),
    ]

    expect(defaultSeason(started, '2026-08-01')).toBe(2026)
  })

  it('skips a season too thin to fill a podium', () => {
    // Two people are not a standing, and a table judged on them looks broken.
    const two = [...results, result('000002', '2026-02-02', 1)]

    expect(defaultSeason(results, '2026-08-01')).toBe(2019)
    expect(defaultSeason(two, '2026-08-01')).toBe(2019)
  })

  it('opens on the fullest season when the running one is still empty', () => {
    expect(defaultSeason(results, '2027-03-01')).toBe(2019)
  })

  it('falls back to the running season when there is nothing at all', () => {
    expect(defaultSeason([], '2027-03-01')).toBe(2027)
  })
})

describe('rankTeams', () => {
  const team = (id: string): Team => ({
    id,
    slug: id,
    name: id,
    city: 'Beograd',
    country: 'RS',
    organizerMemberNumber: '000001',
  })

  it('sums every member, without normalising for team size', () => {
    const teams = [team('a'), team('b')]
    const competitors = [
      competitor('000001', { teamId: 'a' }),
      competitor('000002', { teamId: 'b' }),
      competitor('000004', { teamId: 'b' }),
    ]
    const results = [
      result('000001', '2027-01-01', 30),
      result('000002', '2027-01-01', 20),
      result('000004', '2027-01-01', 20),
    ]

    // b wins with 40 against 30, although its average per member is lower.
    expect(rankTeams(teams, competitors, results).map((row) => row.team.id)).toEqual(['b', 'a'])
  })

  it('breaks a tie in favour of the bigger team', () => {
    const teams = [team('small'), team('big')]
    const competitors = [
      competitor('000001', { teamId: 'small' }),
      competitor('000002', { teamId: 'big' }),
      competitor('000004', { teamId: 'big' }),
    ]
    const results = [
      result('000001', '2027-01-01', 20),
      result('000002', '2027-01-01', 10),
      result('000004', '2027-01-01', 10),
    ]

    const ranked = rankTeams(teams, competitors, results)

    expect(ranked[0].team.id).toBe('big')
    expect(ranked[0].members).toBe(2)
  })
})

describe('topByCategory', () => {
  const competitors = [competitor('000001'), competitor('000002'), competitor('000004')]
  const results = [
    result('000001', '2027-01-01', 1),
    result('000001', '2027-02-01', 1),
    result('000002', '2027-03-01', 1),
    result('000004', '2026-01-01', 1),
    { ...result('000002', '2027-04-01', 1), category: 'marathon' as const },
  ]

  it('counts one length, in one season, tallest first', () => {
    const columns = topByCategory(competitors, results, 2027, 'short', 10)

    expect(columns.map((one) => one.competitor.memberNumber)).toEqual(['000001', '000002'])
    expect(columns[0].count).toBe(2)
  })

  it('leaves out anyone who ran none of that length', () => {
    // 000004 ran, but in another season, and 000002 ran only one marathon.
    expect(topByCategory(competitors, results, 2027, 'marathon', 10)).toHaveLength(1)
    expect(topByCategory(competitors, results, 2027, 'ultra', 10)).toEqual([])
  })

  it('stops at the limit it is given', () => {
    expect(topByCategory(competitors, results, 2027, 'short', 1)).toHaveLength(1)
  })
})

describe('topByKilometers', () => {
  /* Every rung of the ladder from PDL P12 is exercised here, in order:
   * kilometres, then more races, then vertical, then points, and finally two
   * rows that stay level all the way down. */
  const competitors = [
    competitor('000001'),
    competitor('000002'),
    competitor('000004'),
    competitor('000005'),
    competitor('000007'),
    competitor('000008'),
  ]
  const results = [
    result('000001', '2027-01-01', 1, { distanceKm: 30 }),
    result('000002', '2027-01-01', 1, { distanceKm: 20 }),
    result('000008', '2027-01-01', 1, { distanceKm: 20 }),
    result('000004', '2027-01-01', 1, { distanceKm: 10 }),
    result('000004', '2027-02-01', 1, { distanceKm: 10 }),
    result('000005', '2027-01-01', 1, { distanceKm: 20, ascentM: 500 }),
    result('000007', '2027-01-01', 9, { distanceKm: 20 }),
    result('000002', '2026-01-01', 1, { distanceKm: 500 }),
  ]

  it('takes the whole ladder in order, and never rewards the smaller volume', () => {
    const rows = topByKilometers(competitors, results, 2027, 10)

    expect(rows.map((row) => row.competitor.memberNumber)).toEqual([
      // 30 km beats every 20 km.
      '000001',
      // Level on 20 km, and two races beat one.
      '000004',
      // One race each, and more vertical decides.
      '000005',
      // Vertical level too, so the points settle it.
      '000007',
      // Level down to the last rung; input order is all that separates them.
      '000002',
      '000008',
    ])
    expect(rows[0].kilometers).toBe(30)
  })

  it('counts one season and stops at the limit it is given', () => {
    // 000002 ran 500 km in 2026, which the 2027 board knows nothing about.
    expect(topByKilometers(competitors, results, 2027, 2).map((row) => row.kilometers)).toEqual([
      30, 20,
    ])
    expect(topByKilometers(competitors, results, 2025, 10)).toEqual([])
  })
})

describe('topByTimeOnCourse', () => {
  const competitors = [
    competitor('000001'),
    competitor('000002'),
    competitor('000004'),
    competitor('000005'),
  ]
  const results = [
    result('000001', '2027-01-01', 1),
    result('000001', '2027-02-01', 1),
    result('000002', '2027-01-01', 1, { seconds: 5000 }),
    result('000004', '2027-01-01', 1, { seconds: 5000, ascentM: 300 }),
    result('000005', '2027-01-01', 1, { seconds: 5000, distanceKm: 15 }),
  ]

  it('ranks by time, and settles a level time by volume', () => {
    expect(
      topByTimeOnCourse(competitors, results, 2027, 10).map((row) => row.competitor.memberNumber),
    ).toEqual([
      // Two races, 6000 seconds in all.
      '000001',
      // Level on time, and 15 km beats 10 km.
      '000005',
      // Level on time, kilometres and races, so the vertical decides.
      '000004',
      '000002',
    ])
  })
})

describe('bestSingleRaces', () => {
  const competitors = [competitor('000001'), competitor('000002'), competitor('000004')]
  const results = [
    result('000001', '2027-01-01', 20),
    result('000002', '2027-01-01', 10, { distanceKm: 15 }),
    result('000004', '2027-01-01', 10),
    result('000001', '2027-02-01', 10),
    result('000001', '2027-03-01', 10),
    result('000002', '2026-01-01', 99),
    // Nobody by this number; a result without a member is not a place.
    result('M9999', '2027-01-01', 50),
  ]

  it('ranks one result at a time, down the ladder, and only for the season asked for', () => {
    const rows = bestSingleRaces(competitors, results, 2027, 10)

    expect(rows.map((row) => row.result.points)).toEqual([20, 10, 10, 10, 10])
    expect(rows.map((row) => row.competitor.memberNumber)).toEqual([
      '000001',
      // Level on points, and the longer race comes first.
      '000002',
      // Level on points and length; 000001 has the bigger season behind it.
      '000001',
      '000001',
      '000004',
    ])
    // The 99 points 000002 scored in 2026 belong to the 2026 board.
    expect(rows.every((row) => row.result.date.startsWith('2027'))).toBe(true)
  })

  it('stops at the limit it is given', () => {
    expect(bestSingleRaces(competitors, results, 2027, 2)).toHaveLength(2)
  })
})
