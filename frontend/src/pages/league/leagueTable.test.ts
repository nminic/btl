import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'
import { leagueTable } from './leagueTable'

const person = (memberNumber: string): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: memberNumber,
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  birthYear: 1985,
  firstSeason2027: false,
  firstSeason: 2019,
  active: true,
  membershipBasis: 'payment',
  teamId: null,
  teamSince: null,
  bio: '',
})

const event = (id: string, date: string): BtlEvent => ({
  id,
  slug: id,
  name: `Događaj ${id}`,
  date,
  city: 'Beograd',
  country: 'RS',
  organizer: 'Road',
  status: 'confirmed',
  raceIds: [],
})

const race = (id: string, eventId: string, name: string, distanceKm = 10): Race => ({
  id,
  eventId,
  name,
  distanceKm,
  ascentM: 0,
  descentM: 0,
  category: 'short',
})

const result = (memberNumber: string, raceId: string, points: number): Result => ({
  id: `${memberNumber}-${raceId}`,
  memberNumber,
  raceId,
  eventName: 'Događaj',
  eventSlug: 'dogadjaj',
  date: '2019-05-01',
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  seconds: 3000,
  points,
  category: 'short',
})

const league: League = {
  id: 'l1',
  slug: 'l1',
  name: 'Proba',
  season: 2019,
  groupsByCategory: false,
  eventIds: ['e1', 'e2'],
  rules: '',
  prizes: '',
}

const events = [event('e1', '2019-05-01'), event('e2', '2019-03-01'), event('e3', '2019-04-01')]
const races = [
  race('r1', 'e1', '10 km'),
  race('r2', 'e2', '21 km'),
  race('r3', 'e3', '5 km'),
  race('r4', 'e1', '5 km', 5),
]

describe('the grid of a competition', () => {
  it('takes its columns from the races of its own events, oldest first', () => {
    const table = leagueTable(league, events, races, [], [])

    /* e3 is not in the competition, so r3 is not a column. Within one day the
       shorter race comes first, and it is the distance that says which is
       shorter: by name "10 km" would stand in front of "5 km". */
    expect(table.columns.map((one) => one.raceId)).toEqual(['r2', 'r4', 'r1'])
    expect(table.columns[0].event).toBe('Događaj e2')
  })

  it('has a row for everyone who ran at least one of them, and for nobody else', () => {
    const table = leagueTable(
      league,
      events,
      races,
      [result('000001', 'r1', 10), result('000003', 'r3', 99)],
      [person('000001'), person('000002'), person('000003')],
    )

    // 000002 ran nothing; 000003 ran only a race outside the competition.
    expect(table.rows.map((one) => one.competitor.memberNumber)).toEqual(['000001'])
  })

  it('totals only what it shows, and orders by that total', () => {
    const table = leagueTable(
      league,
      events,
      races,
      [
        result('000001', 'r1', 10),
        result('000001', 'r2', 5),
        result('000001', 'r3', 1000),
        result('000002', 'r2', 40),
      ],
      [person('000001'), person('000002')],
    )

    /* The thousand points are from a race outside the competition, so they are
       in neither the row nor the total; a reader has to be able to add the row
       up and land on the second column. */
    expect(table.rows.map((one) => one.total)).toEqual([40, 15])
    expect(table.rows[0].competitor.memberNumber).toBe('000002')
    expect(table.rows[1].points.get('r3')).toBeUndefined()
  })

  it('leaves a race somebody did not run out of the row rather than at nought', () => {
    const table = leagueTable(
      league,
      events,
      races,
      [result('000001', 'r1', 10)],
      [person('000001')],
    )

    // Nought would be a claim: it says they ran it and scored nothing.
    expect(table.rows[0].points.get('r1')).toBe(10)
    expect(table.rows[0].points.has('r2')).toBe(false)
  })

  it('settles a tie by member number rather than by chance', () => {
    const table = leagueTable(
      league,
      events,
      races,
      [result('000005', 'r1', 20), result('000002', 'r2', 20)],
      [person('000005'), person('000002')],
    )

    expect(table.rows.map((one) => one.competitor.memberNumber)).toEqual(['000002', '000005'])
  })

  it('adds two results on one race rather than keeping the last of them', () => {
    /* Nothing on the portal should produce this, and a grid that quietly kept
       one of the two would hide it instead of showing it. */
    const table = leagueTable(
      league,
      events,
      races,
      [result('000001', 'r1', 10), { ...result('000001', 'r1', 7), id: 'drugi' }],
      [person('000001')],
    )

    expect(table.rows[0].points.get('r1')).toBe(17)
    expect(table.rows[0].total).toBe(17)
  })
})
