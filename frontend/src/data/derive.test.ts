import {
  boardOfTen,
  categoriesOf,
  topByCategory,
  defaultMonth,
  defaultSeason,
  monthGrid,
  eventsInMonth,
  monthsWithEvents,
  bestSingleRaces,
  rankingFor,
  rankMembers,
  topByKilometers,
  topByProgress,
  topByTimeOnCourse,
  rankTeams,
  resultsOf,
  seasonsWithResults,
  totalsOf,
  withPlaces,
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
  teamSince: null,
  bio: '',
  ...extra,
})

const result = (memberNumber: string, date: string, points: number, extra: Partial<Result> = {}): Result => ({
  id: `${memberNumber}-${date}-${points}`,
  memberNumber,
  raceId: 'race',
  eventName: 'Trka',
  eventSlug: 'trka',
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

  it('shares a place when the ladder leaves two rows level, and skips the next number', () => {
    // Identical in points, kilometres, races and vertical, so nothing in PDL P12
    // separates them and the place is shared: 1, 1, 3.
    const level = [competitor('000005'), competitor('000002'), competitor('000004')]
    const ran = [
      result('000005', '2027-01-01', 10),
      result('000002', '2027-01-01', 10),
      result('000004', '2027-02-01', 5),
    ]

    expect(
      rankingFor(level, ran, { season: 2027, gender: 'M' }).map((row) => [
        row.competitor.memberNumber,
        row.position,
      ]),
    ).toEqual([
      // Inside the shared place the smaller member number comes first, although
      // 000005 was listed first.
      ['000002', 1],
      ['000005', 1],
      ['000004', 3],
    ])
  })
})

describe('withPlaces', () => {
  type Row = { competitor: Competitor; points: number }

  const row = (memberNumber: string, points: number): Row => ({
    competitor: competitor(memberNumber),
    points,
  })
  const byPoints = (left: Row, right: Row) => right.points - left.points
  const numberOf = (one: Row) => one.competitor.memberNumber

  it('gives three level rows one number and carries on at the fourth', () => {
    const rows = [row('000004', 9), row('000002', 9), row('000005', 9), row('000001', 4)]

    expect(withPlaces(rows, byPoints, numberOf).map((one) => [numberOf(one), one.position])).toEqual(
      [
        ['000002', 1],
        ['000004', 1],
        ['000005', 1],
        ['000001', 4],
      ],
    )
  })

  it('numbers a list nothing ties in one by one', () => {
    const rows = [row('000004', 9), row('000002', 5)]

    expect(withPlaces(rows, byPoints, numberOf).map((one) => one.position)).toEqual([1, 2])
  })

  it('leaves an empty list empty', () => {
    expect(withPlaces<Row>([], byPoints, numberOf)).toEqual([])
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

  it('leaves a cancelled event out of the grid, and keeps its record', () => {
    /* Owner, 31.07.2026: a cancelled event keeps its record, because somebody
       has it in their calendar and a subscription has to be able to say it is
       off; what it loses is its square in the grid, where it would read as
       something still to come. */
    const called: BtlEvent[] = [...events, { ...events[0], id: 'd', slug: 'd', status: 'cancelled' }]

    expect(eventsInMonth(called, 2027, 3).map((event) => event.id)).toEqual(['b', 'a'])
    expect(called.some((event) => event.id === 'd')).toBe(true)
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

  /* The rest of the ladder from PDL P12, below the member count: the kilometres
     of every member, then the races of every member. The order stopped at the
     member count before, so two teams level on points and on size were left in
     whatever order the team list happened to be in. */
  it('goes on to the kilometres of every member when the size is level too', () => {
    const teams = [team('fewer'), team('more')]
    const competitors = [
      competitor('000001', { teamId: 'fewer' }),
      competitor('000002', { teamId: 'more' }),
    ]
    const results = [
      result('000001', '2027-01-01', 10, { distanceKm: 10 }),
      result('000002', '2027-01-01', 10, { distanceKm: 30 }),
    ]

    expect(rankTeams(teams, competitors, results).map((row) => row.team.id)).toEqual([
      'more',
      'fewer',
    ])
  })

  it('goes on to the races of every member when the kilometres are level too', () => {
    const teams = [team('one-race'), team('two-races')]
    const competitors = [
      competitor('000001', { teamId: 'one-race' }),
      competitor('000002', { teamId: 'two-races' }),
    ]
    const results = [
      result('000001', '2027-01-01', 20, { distanceKm: 20 }),
      result('000002', '2027-01-01', 10, { distanceKm: 10 }),
      result('000002', '2027-02-02', 10, { distanceKm: 10 }),
    ]

    // Same points and same kilometres, and the bigger volume of races wins.
    expect(rankTeams(teams, competitors, results).map((row) => row.team.id)).toEqual([
      'two-races',
      'one-race',
    ])
  })

  it('shows a tie the whole ladder leaves standing as a shared place', () => {
    const teams = [team('b'), team('a'), team('c')]
    const competitors = [
      competitor('000001', { teamId: 'a' }),
      competitor('000002', { teamId: 'b' }),
      competitor('000004', { teamId: 'c' }),
    ]
    const results = [
      result('000001', '2027-01-01', 10),
      result('000002', '2027-01-01', 10),
      result('000004', '2027-01-01', 5),
    ]

    const ranked = rankTeams(teams, competitors, results)

    // 1, 1, 3, and inside the shared place the smaller id first, so the board
    // does not shuffle between two recounts of the same data (PDL P12).
    expect(ranked.map((row) => row.position)).toEqual([1, 1, 3])
    expect(ranked.map((row) => row.team.id)).toEqual(['a', 'b', 'c'])
  })
})

/* The board of best progress. The measure is the points gained on the season
 * before (PDL P12, 30.07.2026); the rungs under it are derived, and are marked as
 * derived where they are written (BY_PROGRESS in derive.ts). */
describe('topByProgress', () => {
  it('measures the gain against the season before, and orders by it', () => {
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      result('000001', '2026-01-01', 100),
      result('000001', '2027-01-01', 150),
      result('000002', '2026-01-01', 10),
      // Twice the points of the first, and a smaller gain. The board is about
      // the gain, so the smaller total is ahead.
      result('000002', '2027-01-01', 40),
    ]

    const ranked = topByProgress(competitors, results, 2027, 10)

    expect(ranked.map((row) => row.competitor.memberNumber)).toEqual(['000001', '000002'])
    expect(ranked.map((row) => row.gain)).toEqual([50, 30])
    expect(ranked.map((row) => row.previousPoints)).toEqual([100, 10])
  })

  it('leaves out whoever did not race the season before', () => {
    const competitors = [competitor('000001'), competitor('000002'), competitor('000003')]
    const results = [
      result('000001', '2026-01-01', 10),
      result('000001', '2027-01-01', 20),
      // A first season of 500 points is not a gain of 500, it is no gain at all:
      // there is nothing to have gained on.
      result('000002', '2027-01-01', 500),
      // And a member who raced the season before and not this one has no season
      // to be measured.
      result('000003', '2026-01-01', 300),
    ]

    expect(topByProgress(competitors, results, 2027, 10).map((row) => row.competitor.memberNumber))
      .toEqual(['000001'])
  })

  it('leaves out whoever went backwards, and empties the board when nobody gained', () => {
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      // Fell from 100 to 40. Not progress by any reading of the word, and a
      // board of best progress that ends in minus figures says the opposite of
      // its own name (owner, 30.07.2026).
      result('000001', '2026-01-01', 100),
      result('000001', '2027-01-01', 40),
      // Exactly level: no gain either.
      result('000002', '2026-01-01', 50),
      result('000002', '2027-01-01', 50),
    ]

    expect(topByProgress(competitors, results, 2027, 10)).toEqual([])
  })

  it('goes on to the points of the season when two gains are level', () => {
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      result('000001', '2026-01-01', 10),
      result('000001', '2027-01-01', 30),
      result('000002', '2026-01-01', 100),
      // The same gain of 20, from a season three times the size.
      result('000002', '2027-01-01', 120),
    ]

    expect(topByProgress(competitors, results, 2027, 10).map((row) => row.competitor.memberNumber))
      .toEqual(['000002', '000001'])
  })

  it('goes on to the races when the gain and the season are level too', () => {
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      result('000001', '2026-01-01', 10),
      result('000001', '2027-01-01', 30),
      result('000002', '2026-01-01', 10),
      // The same gain and the same points of the season, over two races rather
      // than one. Volume decides, never efficiency (PDL P12).
      result('000002', '2027-01-01', 15),
      result('000002', '2027-02-02', 15),
    ]

    expect(topByProgress(competitors, results, 2027, 10).map((row) => row.competitor.memberNumber))
      .toEqual(['000002', '000001'])
  })

  it('shows a tie the whole ladder leaves standing as a shared place', () => {
    const competitors = [competitor('000002'), competitor('000001'), competitor('000003')]
    const results = [
      result('000001', '2026-01-01', 10),
      result('000001', '2027-01-01', 30),
      result('000002', '2026-01-01', 10),
      result('000002', '2027-01-01', 30),
      result('000003', '2026-01-01', 10),
      result('000003', '2027-01-01', 20),
    ]

    const ranked = topByProgress(competitors, results, 2027, 10)

    expect(ranked.map((row) => row.position)).toEqual([1, 1, 3])
    expect(ranked.map((row) => row.competitor.memberNumber)).toEqual([
      '000001',
      '000002',
      '000003',
    ])
  })

  it('stops at the places the board has', () => {
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      result('000001', '2026-01-01', 10),
      result('000001', '2027-01-01', 40),
      result('000002', '2026-01-01', 10),
      result('000002', '2027-01-01', 20),
    ]

    expect(topByProgress(competitors, results, 2027, 1)).toHaveLength(1)
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
    expect(columns[0].races).toBe(2)
    expect(columns[0].position).toBe(1)
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

describe('topByCategory, when the count ties', () => {
  /* Every rung of the ladder from PDL P12, in order: the number of races, then
   * the points, the kilometres and the vertical of exactly those races, then the
   * earlier day, and finally a shared place.
   *
   * Everybody here ran two halves, so the count settles nothing on its own. The
   * list is deliberately written in the reverse of the answer: ordering by the
   * count alone leaves the input order standing, which is the fault this covers.
   */
  const competitors = [
    competitor('000011'),
    competitor('000009'),
    competitor('000008'),
    competitor('000007'),
    competitor('000005'),
    competitor('000004'),
    competitor('000002'),
  ]

  const half = (memberNumber: string, date: string, points: number, extra: Partial<Result> = {}) =>
    result(memberNumber, date, points, { category: 'half', distanceKm: 21.1, ...extra })

  const results = [
    // Most points from the two halves.
    half('000002', '2027-01-01', 12),
    half('000002', '2027-04-01', 12),
    // Level on points, and 51.1 km beats 42.2.
    half('000004', '2027-01-01', 5),
    half('000004', '2027-04-01', 5, { distanceKm: 30 }),
    // Level on points and kilometres, so the vertical of those races decides.
    half('000005', '2027-01-01', 5, { ascentM: 300 }),
    half('000005', '2027-04-01', 5),
    // Level down to the vertical; 000007 reached two halves in March, 000008 in
    // May, and the earlier day wins.
    half('000007', '2027-01-01', 5),
    half('000007', '2027-03-01', 5),
    // Written newest first on purpose: the day the count was reached is the last
    // such race of the season, whatever order the results arrive in.
    half('000008', '2027-05-01', 5),
    half('000008', '2027-01-01', 5),
    // A marathon of 500 points in the same season. It must not lift 000008 on
    // the half marathon board: the rungs read those two halves and nothing else.
    result('000008', '2027-06-01', 500, { category: 'marathon', distanceKm: 42.2 }),
    // Level with each other on every rung there is.
    half('000009', '2027-01-01', 1),
    half('000009', '2027-02-01', 1),
    half('000011', '2027-01-01', 1),
    half('000011', '2027-02-01', 1),
  ]

  it('takes the whole ladder in order, and reads it from those races only', () => {
    expect(
      topByCategory(competitors, results, 2027, 'half', 10).map((one) => [
        one.competitor.memberNumber,
        one.position,
      ]),
    ).toEqual([
      ['000002', 1],
      ['000004', 2],
      ['000005', 3],
      ['000007', 4],
      ['000008', 5],
      // Nothing separates these two, so they share the place, smaller member
      // number first.
      ['000009', 6],
      ['000011', 6],
    ])
  })

  it('keeps the whole ladder when the board is cut off at the limit', () => {
    // The rung below the count is what decides who the fifth place belongs to,
    // so cutting the board must not hand it to whoever was listed first.
    expect(
      topByCategory(competitors, results, 2027, 'half', 5).map(
        (one) => one.competitor.memberNumber,
      ),
    ).toEqual(['000002', '000004', '000005', '000007', '000008'])
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
      // Level down to the last rung, so the place is shared and the smaller
      // member number goes first.
      '000002',
      '000008',
    ])
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 5])
    expect(rows[0].kilometers).toBe(30)
  })

  it('counts one season and stops at the limit it is given', () => {
    // 000002 ran 500 km in 2026, which the 2027 board knows nothing about.
    expect(topByKilometers(competitors, results, 2027, 2).map((row) => row.kilometers)).toEqual([
      30, 20,
    ])
    expect(topByKilometers(competitors, results, 2025, 10)).toEqual([])
  })

  it('gives the place to whoever got there first, before sharing it', () => {
    /* The fifth rung, from PDL P12 and Article 57 of the rulebook: two rows level
       on kilometres, races, vertical and points are settled by who reached the
       count earlier. The board of races by length already had it and this one did
       not, so the two were left in whatever order they came in and shared a place
       they were not level on. */
    const level = [
      result('000002', '2027-06-01', 1, { distanceKm: 20 }),
      result('000008', '2027-03-01', 1, { distanceKm: 20 }),
    ]

    expect(
      topByKilometers([competitor('000002'), competitor('000008')], level, 2027, 10).map((row) => [
        row.competitor.memberNumber,
        row.position,
      ]),
    ).toEqual([
      ['000008', 1],
      ['000002', 2],
    ])
  })
})

describe('rankMembers', () => {
  /* The members of a team, ordered by what each brought to it. The page used to
     number the rows and sort on points alone, so two members level on points were
     given 1 and 2 by the order they happened to be in (PDL P12). */
  const members = [competitor('000002'), competitor('000008'), competitor('000004')]

  it('shares a place nothing separates, and keeps everybody who is in the team', () => {
    const results = [
      result('000002', '2027-01-01', 10),
      result('000008', '2027-01-01', 10),
      result('000004', '2027-01-01', 20),
    ]

    expect(
      rankMembers(members, results).map((row) => [row.competitor.memberNumber, row.position]),
    ).toEqual([
      ['000004', 1],
      ['000002', 2],
      ['000008', 2],
    ])
  })

  it('leaves the member who has not raced yet in the team, at the bottom', () => {
    const rows = rankMembers(members, [result('000002', '2027-01-01', 10)])

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.position)).toEqual([1, 2, 2])
    expect(rows[0].competitor.memberNumber).toBe('000002')
  })
})

describe('topByTimeOnCourse', () => {
  const competitors = [
    competitor('000001'),
    competitor('000002'),
    competitor('000004'),
    competitor('000005'),
    competitor('000007'),
  ]
  const results = [
    result('000001', '2027-01-01', 1),
    result('000001', '2027-02-01', 1),
    result('000002', '2027-01-01', 1, { seconds: 5000 }),
    result('000004', '2027-01-01', 1, { seconds: 5000, ascentM: 300 }),
    result('000005', '2027-01-01', 1, { seconds: 5000, distanceKm: 15 }),
    // Level with 000002 on every rung this board has.
    result('000007', '2027-01-01', 1, { seconds: 5000 }),
  ]

  it('ranks by time, settles a level time by volume, and shares what is left', () => {
    const rows = topByTimeOnCourse(competitors, results, 2027, 10)

    expect(rows.map((row) => [row.competitor.memberNumber, row.position])).toEqual([
      // Two races, 6000 seconds in all.
      ['000001', 1],
      // Level on time, and 15 km beats 10 km.
      ['000005', 2],
      // Level on time, kilometres and races, so the vertical decides.
      ['000004', 3],
      // Nothing left to separate these two, so they hold the place together.
      ['000002', 4],
      ['000007', 4],
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

/* The board of the front page (PDL P14). The places that are won come first, and
 * the rest are held by members who have joined and not yet raced, so the widget
 * is never a row of empty rings in the first weeks of a season. */
describe('boardOfTen', () => {
  const twelve = Array.from({ length: 12 }, (_, index) =>
    competitor(String(index + 1).padStart(6, '0')),
  )

  it('puts everybody who has scored first, in order, and marks them as ranked', () => {
    const board = boardOfTen(
      twelve,
      [result('000005', '2027-03-01', 20), result('000009', '2027-03-01', 40)],
      2027,
      'M',
    )

    expect(board.slice(0, 2)).toEqual([
      { competitor: twelve[8], points: 40, ranked: true },
      { competitor: twelve[4], points: 20, ranked: true },
    ])
  })

  it('fills the rest with those who joined earliest, and marks them as waiting', () => {
    const board = boardOfTen(twelve, [result('000009', '2027-03-01', 40)], 2027, 'M')

    expect(board).toHaveLength(10)
    expect(board[0].competitor.memberNumber).toBe('000009')
    // The order they joined in, and 000009 is not taken twice.
    expect(board.slice(1).map((slot) => slot.competitor.memberNumber)).toEqual([
      '000001',
      '000002',
      '000003',
      '000004',
      '000005',
      '000006',
      '000007',
      '000008',
      '000010',
    ])
    expect(board.slice(1).every((slot) => !slot.ranked && slot.points === 0)).toBe(true)
  })

  it('never goes past ten, however many have scored', () => {
    const results = twelve.map((one) => result(one.memberNumber, '2027-03-01', 5))

    expect(boardOfTen(twelve, results, 2027, 'M')).toHaveLength(10)
    expect(boardOfTen(twelve, results, 2027, 'M').every((slot) => slot.ranked)).toBe(true)
  })

  it('holds only the places of its own gender', () => {
    const mixed = [competitor('000001'), competitor('000002', { gender: 'F' })]

    expect(boardOfTen(mixed, [], 2027, 'F').map((slot) => slot.competitor.memberNumber)).toEqual([
      '000002',
    ])
  })
})
