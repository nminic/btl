import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'
import { at, first } from '../../test/at'
import { categoryOfMember } from '../../data/derive'
import { leagueGroups, leagueTable } from './leagueTable'

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
  referralCode: 'proba0000',
  referredBy: null,
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
  kind: 'race', description: '', link: '', copiedFrom: '', featured: 'no',
})

const race = (
  id: string,
  eventId: string,
  distanceKm = 10,
  date = '2027-04-03',
  /* What the race is called. It starts out as its event's name, so a case that
     does not care passes the same string every event carries; a case about the
     name passes its own. */
  name = 'Trka',
): Race => ({
  id,
  eventId,
  name,
  renamed: 'no',
  kind: 'length',
  limitSeconds: 0,
  date,
  distanceKm,
  ascentM: 0,
  descentM: 0,
  category: 'short',
})

const result = (memberNumber: string, raceId: string, points: number): Result => ({
  id: `${memberNumber}-${raceId}`,
  memberNumber,
  raceId,
  raceName: 'Događaj',
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
/* Each race on the day of its own event, which is the ordinary case: an event
   that runs over more than one morning is the exception and has a test of its
   own below. The day is on the race and not read off the event (PDL P10). */
const races = [
  race('r1', 'e1', 10, '2019-05-01'),
  race('r2', 'e2', 21, '2019-03-01'),
  race('r3', 'e3', 5, '2019-04-01'),
  race('r4', 'e1', 5.5, '2019-05-01'),
]

describe('the grid of a competition', () => {
  it('takes its columns from the races of its own events, oldest first', () => {
    const table = leagueTable(league, events, races, [], [])

    /* e3 is not in the competition, so r3 is not a column. Within one day the
       shorter race comes first, and it is the distance that says which is
       shorter: by name "10 km" would stand in front of "5 km". */
    expect(table.columns.map((one) => one.raceId)).toEqual(['r2', 'r4', 'r1'])
    expect(first(table.columns).name).toBe('Trka')
  })

  it('calls a race what the race is called, not what its event is called', async () => {
    /* Owner, 23.08.2026, in the same breath as giving a race a name: „u listi
       rezultata treba da se prikazuju nazivi trka na kojima je čovek učestvovao, a
       ne događaja." This grid carried the event's name until 29.08.2026, so a race
       somebody had renamed stood here under the name it no longer had.

       Nothing moved for the races in the file, and that is the point of the case:
       a race's name starts out as its event's, so measuring on one of those proves
       nothing. This one is renamed. */
    const named = [race('r5', 'e1', 12, '2019-05-02', 'Polumaraton kroz grad')]
    const table = leagueTable(league, events, named, [], [])

    expect(first(table.columns).name).toBe('Polumaraton kroz grad')
  })

  it('carries the kind of that race, since the heading is written from it', () => {
    /* A column is named by what its race is measured by (`data/raceLabel.ts`), and
       this is the only path by which the kind reaches the heading. Measured by its
       own values rather than by the label, because the label has its own guards and
       a column that carried the wrong race's kind would satisfy them both.

       A length of nought on purpose: a column that lost the kind would fall back to
       naming the race „(0,0 km)", which is what the grid drew before the field was
       carried at all. */
    const timed = [race('r6', 'e1', 0, '2019-05-02')]
    const table = leagueTable(league, events, [{ ...first(timed), kind: 'time', limitSeconds: 86_400 }], [], [])

    expect(first(table.columns).kind).toBe('time')
    expect(first(table.columns).limitSeconds).toBe(86_400)
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

describe('the way a competition splits its ranking', () => {
  /* Owner, in P15: „Podela na kategorije se podešava na nivou svake Lige.
     RunTrace liga ima podelu samo po polu, bez uzrasnih kategorija." The flag
     was on the record, on the admin form and printed on the list of
     competitions, and the table read none of it: measured on 27.08.2026, the
     word „category" appeared nowhere in `leagueTable.ts` or in the screen, so
     both settings drew one undivided table. */

  /** Four people the two settings have to tell apart: two women and two men,
   *  and within each pair two different age bands for the season 2019. */
  const field = [
    { ...person('000001'), gender: 'M' as const, birthYear: 1985 },
    { ...person('000002'), gender: 'M' as const, birthYear: 1955 },
    { ...person('000003'), gender: 'F' as const, birthYear: 1985 },
    { ...person('000004'), gender: 'F' as const, birthYear: 1955 },
  ]

  const rowsOf = (people: Competitor[]) =>
    people.map((competitor) => ({ competitor, points: new Map<string, number>(), total: 0 }))

  it('splits into two where the competition ranks by gender alone', () => {
    /* „Samo po polu" is not „no grouping"; it is grouping into two, and that is
       the half that is easy to lose. A competition ranking by gender that draws
       one list places a woman behind men she was never competing against. */
    const groups = leagueGroups({ ...league, groupsByCategory: false }, rowsOf(field))

    expect(groups.map((one) => one.code)).toEqual(['M', 'Ž'])
    expect(groups.map((one) => one.rows.length)).toEqual([2, 2])
  })

  it('splits by age as well where the competition ranks by category', () => {
    /* The same four people, four blocks: the age band is part of the code, so
       two women of different bands are two blocks and not one. */
    const groups = leagueGroups({ ...league, groupsByCategory: true }, rowsOf(field))

    expect(groups.map((one) => one.code)).toEqual(['M25-39', 'M55+', 'Ž25-39', 'Ž55+'])
    expect(groups.every((one) => one.rows.length === 1)).toBe(true)
  })

  it('names its blocks the way the rest of the portal names them', () => {
    /* Read off `categoryOfMember` rather than written here, so a block on this
       screen is never called something the standing calls otherwise. The season
       is the competition's own, which is what makes the band right: the same
       person is in a different band in a different season. */
    const older = { ...person('000009'), gender: 'M' as const, birthYear: 1955 }

    expect(first(leagueGroups({ ...league, groupsByCategory: true }, rowsOf([older]))).code).toBe(
      categoryOfMember(older, league.season),
    )
  })

  it('draws no block for a category nobody in the competition is in', () => {
    /* A competition of one would otherwise show eight empty tables, one per
       category the league has, seven of them saying nothing except that the
       portal knows the categories exist. */
    const groups = leagueGroups({ ...league, groupsByCategory: true }, rowsOf([at(field, 0)]))

    expect(groups.length).toBe(1)
  })

  it('keeps the order the table already settled inside each block', () => {
    /* `leagueTable` ranks by the total and breaks a tie on the smaller member
       number. Splitting must not reorder anything: a block is a slice of that
       order, and a sort here would be a second ranking nobody asked for. */
    const two = rowsOf([at(field, 0), { ...person('000000'), gender: 'M' as const, birthYear: 1985 }])
    const groups = leagueGroups({ ...league, groupsByCategory: false }, two)

    expect(first(groups).rows.map((one) => one.competitor.memberNumber)).toEqual([
      '000001',
      '000000',
    ])
  })
})
