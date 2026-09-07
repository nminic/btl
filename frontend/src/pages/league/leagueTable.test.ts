import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'
import { at, first } from '../../test/at'
import { genderMark } from '../../data/categories'
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
  profileHidden: false,
  birthdayShown: 'none',
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
  it('takes its columns from the events of the competition, oldest first', () => {
    const table = leagueTable(league, events, races, [], [])

    /* e3 is not in the competition, so it is not a column, though it has a race of
       its own. e1 has two races and is one column, which is what changed on
       07.09.2026 (owner: „Datum i kaze se dogadjaj samo"). */
    expect(table.columns.map((one) => one.eventId)).toEqual(['e2', 'e1'])
    expect(table.columns.map((one) => one.date)).toEqual(['2019-03-01', '2019-05-01'])
  })

  it('carries what the pointer is told and where the press lands', () => {
    /* The heading itself is only a day, so everything that says which event this is
       reaches the screen through these two: the name on the pointer and on the link
       out loud, and the address the link opens (`LeagueResults.tsx`). Measured by
       their own values, because the day is the same for a column that lost both. */
    const table = leagueTable(league, events, races, [], [])

    expect(first(table.columns).name).toBe('Događaj e2')
    expect(first(table.columns).slug).toBe('e2')
  })

  it('gives no column to an event that has no race yet', () => {
    /* An event may be entered a fortnight before anybody knows its distances
       (owner, 23.08.2026), and until a race is added to it there is nothing that
       could ever stand under such a column. The width of this table is its whole
       difficulty, so a column that can never carry a number is width spent on
       nothing. */
    const table = leagueTable(league, events, [race('r2', 'e2', 21, '2019-03-01')], [], [])

    expect(table.columns.map((one) => one.eventId)).toEqual(['e2'])
  })

  it('draws two events of one day as two columns, in the order of their names', () => {
    /* Owner, 07.09.2026: „ako dva dogadjaja imaju isti datum i neko stigne da ih
       istrci obe, svakako neka bude opcija 2", and option two was the day alone. So
       the two read the same date and are told apart by the name on the pointer and
       the page the press opens.

       The order is by the name and not by the order the file happens to be written
       in, or the table would shuffle between two columns nothing else parts. Read
       with the later name given first, so that a sort that does nothing is caught. */
    const sameDay = [event('z-drugi', '2019-03-01'), event('a-prvi', '2019-03-01')]
    const table = leagueTable(
      { ...league, eventIds: ['z-drugi', 'a-prvi'] },
      sameDay,
      [race('r7', 'z-drugi', 10, '2019-03-01'), race('r8', 'a-prvi', 10, '2019-03-01')],
      [],
      [],
    )

    expect(table.columns.map((one) => one.eventId)).toEqual(['a-prvi', 'z-drugi'])
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
    expect(at(table.rows, 1).points.get('e3')).toBeUndefined()
  })

  it('leaves an event somebody did not race out of the row rather than at nought', () => {
    const table = leagueTable(
      league,
      events,
      races,
      [result('000001', 'r1', 10)],
      [person('000001')],
    )

    // Nought would be a claim: it says they were there and scored nothing.
    expect(first(table.rows).points.get('e1')).toBe(10)
    expect(first(table.rows).points.has('e2')).toBe(false)
  })

  it('adds up two races of one event into the one cell that event has', () => {
    /* Owner, 07.09.2026, asked what two columns of one event should be now that the
       heading is only a day: „U teoriji neko moze imati rezultate na dve trke u
       istom dogadjaju i onda ce dole u njegovu celiju biti upisan zbir bodova sa obe
       trke."

       r1 and r4 are two races of e1, which is the ordinary shape of a marathon
       morning: the long one and the short one. The two numbers are different and
       neither is the sum, so a cell holding either of them alone is caught, and so
       is a cell holding the last one written. */
    const table = leagueTable(
      league,
      events,
      races,
      [result('000001', 'r1', 10), result('000001', 'r4', 7)],
      [person('000001')],
    )

    expect(first(table.rows).points.get('e1')).toBe(17)
    expect(first(table.rows).total).toBe(17)
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
       one of the two would hide it instead of showing it. Since 07.09.2026 the same
       line adds two races of one event as well, which is a thing the portal does
       produce; that case is above, and this one is still worth its own because the
       fault it describes is a different one. */
    const table = leagueTable(
      league,
      events,
      races,
      [result('000001', 'r1', 10), { ...result('000001', 'r1', 7), id: 'drugi' }],
      [person('000001')],
    )

    expect(first(table.rows).points.get('e1')).toBe(17)
    expect(first(table.rows).total).toBe(17)
  })
})

describe('the way a competition splits its ranking', () => {
  /* Owner, 31.08.2026: „Lige treba da imaju poredak samo po polu. Ne želim
     dodatna pravila", said of every competition and not of one („nego
     globalno!"). It overturned P15, under which each competition set its own
     split, and the setting went out of the model rather than being left switched
     off; the case that measured the other way went with it. */

  /** Four people: two women and two men, and within each pair two different age
   *  bands for the season 2019. The bands are still here on purpose, because they
   *  are what says the split is by gender and by nothing else. */
  const field = [
    { ...person('000001'), gender: 'M' as const, birthYear: 1985 },
    { ...person('000002'), gender: 'M' as const, birthYear: 1955 },
    { ...person('000003'), gender: 'F' as const, birthYear: 1985 },
    { ...person('000004'), gender: 'F' as const, birthYear: 1955 },
  ]

  const rowsOf = (people: Competitor[]) =>
    people.map((competitor) => ({ competitor, points: new Map<string, number>(), total: 0 }))

  it('splits into two, in every competition there is', () => {
    /* „Samo po polu" is not „no grouping"; it is grouping into two, and that is
       the half that is easy to lose. A competition ranking by gender that draws
       one list places a woman behind men she was never competing against.

       „In every competition" is the part that changed on 31.08.2026: this used to
       be one of two ways a competition could rank, chosen on the record, and the
       owner said there is one („Lige treba da imaju poredak samo po polu. Ne želim
       dodatna pravila", and „nego globalno!"). The case that measured the other way
       went with the setting rather than being kept as a description of something
       nothing can ask for. */
    const groups = leagueGroups(rowsOf(field))

    expect(groups.map((one) => one.code)).toEqual(['M', 'Ž'])
    expect(groups.map((one) => one.rows.length)).toEqual([2, 2])
  })

  it('draws no block for a gender nobody in the competition is', () => {
    /* A competition of one man would otherwise show an empty table for women,
       saying nothing except that the portal knows women exist. */
    const groups = leagueGroups(rowsOf([at(field, 0)]))

    expect(groups.length).toBe(1)
    expect(first(groups).code).toBe(genderMark(at(field, 0).gender))
  })

  it('keeps the order the table already settled inside each block', () => {
    /* `leagueTable` ranks by the total and breaks a tie on the smaller member
       number. Splitting must not reorder anything: a block is a slice of that
       order, and a sort here would be a second ranking nobody asked for. */
    const two = rowsOf([at(field, 0), { ...person('000000'), gender: 'M' as const, birthYear: 1985 }])
    const groups = leagueGroups(two)

    expect(first(groups).rows.map((one) => one.competitor.memberNumber)).toEqual([
      '000001',
      '000000',
    ])
  })
})
