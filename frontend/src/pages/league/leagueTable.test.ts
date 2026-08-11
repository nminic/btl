import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'
import { at, first } from '../../test/at'
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
  kind: 'race', copiedFrom: '', featured: 'no',
})

const race = (id: string, eventId: string, distanceKm = 10): Race => ({
  id,
  eventId,
  date: '2027-04-03',
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
  race('r1', 'e1'),
  race('r2', 'e2', 21),
  race('r3', 'e3', 5),
  race('r4', 'e1', 5.5),
]

describe('the grid of a competition', () => {
  it('takes its columns from the races of its own events, oldest first', () => {
    const table = leagueTable(league, events, races, [], [])

    /* e3 is not in the competition, so r3 is not a column. Within one day the
       shorter race comes first, and it is the distance that says which is
       shorter: by name "10 km" would stand in front of "5 km". */
    expect(table.columns.map((one) => one.raceId)).toEqual(['r2', 'r4', 'r1'])
    expect(first(table.columns).event).toBe('Događaj e2')
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
    expect(first(table.rows).competitor.memberNumber).toBe('000002')
    expect(at(table.rows, 1).points.get('r3')).toBeUndefined()
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
    expect(first(table.rows).points.get('r1')).toBe(10)
    expect(first(table.rows).points.has('r2')).toBe(false)
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

    expect(first(table.rows).points.get('r1')).toBe(17)
    expect(first(table.rows).total).toBe(17)
  })
})

describe('a heading that has to be cut somewhere', () => {
  it('puts the event first when the race and the date do not tell two columns apart', () => {
    /* Twice in the main competition of 2027 two different events hold the same
       length on the same day: "10.00 km, 4. 9. 2027." is both 10K Belgrade and
       Beljanica trail. The turned heading is cut at its end, so what repeats has
       to go last, and which part repeats is not the same every time. */
    const table = leagueTable(
      { ...league, eventIds: ['e1', 'e2'] },
      [event('e1', '2019-05-01'), event('e2', '2019-05-01')],
      [race('r1', 'e1'), race('r2', 'e2')],
      [],
      [],
    )

    expect(table.columns.map((one) => one.ambiguous)).toEqual([true, true])
  })

  it('leaves the event last when the race and the date already tell them apart', () => {
    const table = leagueTable(league, events, races, [], [])

    expect(table.columns.every((one) => one.ambiguous)).toBe(false)
  })

  it('tells two nameless races of one event apart by their lengths', () => {
    /* Which is the whole of what a nameless race has (PDL P6, 11.08.2026). Told
       apart by name alone the two shared one empty key, both were marked as not
       telling themselves apart, and the reader was given two columns headed
       „Događaj e1, , 1. 5. 2019." over two different races. */
    const table = leagueTable(
      { ...league, eventIds: ['e1'] },
      [event('e1', '2019-05-01')],
      [race('r1', 'e1', 10), race('r2', 'e1', 21.1)],
      [],
      [],
    )

    expect(table.columns.map((one) => one.ambiguous)).toEqual([false, false])
  })

  it('still says so when two nameless races are the same length on the same day', () => {
    /* Then there is nothing left to tell them apart with, and the heading says
       as much by carrying the event too. Better a heading that repeats than one
       that claims a difference it cannot show. */
    const table = leagueTable(
      { ...league, eventIds: ['e1'] },
      [event('e1', '2019-05-01')],
      [race('r1', 'e1', 10), race('r2', 'e1', 10)],
      [],
      [],
    )

    expect(table.columns.map((one) => one.ambiguous)).toEqual([true, true])
  })
})
