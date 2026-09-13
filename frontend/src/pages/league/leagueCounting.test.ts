import type { BtlEvent, League, Race } from '../../data/types'
import { at, first } from '../../test/at'
import { leagueRaces, racesByEvent } from './leagueCounting'

const event = (id: string, date: string, name = `Događaj ${id}`): BtlEvent => ({
  id,
  slug: id,
  name,
  date,
  city: 'Beograd',
  country: 'RS',
  kind: 'race',
  description: '',
  link: '',
  copiedFrom: '',
  featured: 'no',
})

const race = (id: string, eventId: string, distanceKm = 10, date = '2019-05-01'): Race => ({
  id,
  eventId,
  name: `Trka ${id}`,
  renamed: 'no',
  kind: 'length',
  limitSeconds: 0,
  date,
  distanceKm,
  ascentM: 0,
  descentM: 0,
  category: 'short',
})

/**
 * Two events in the competition and one outside it, and one of the two runs three races.
 *
 * **Every axis this file makes a claim about is at least two deep, on purpose.** A competition of
 * one event cannot tell „the races of this competition" from „every race there is"; an event of
 * one race cannot tell „the races handed in" from „the races of the event"; and an event that has
 * a race cannot tell „built out of the races" from „built out of the events".
 */
const league: League = {
  id: 'l1',
  slug: 'l1',
  name: 'Proba',
  season: 2019,
  /* Three, and the third has no race anywhere: that is an event a competition holds and a reader
     never meets, which is the whole of the second claim below. */
  eventIds: ['e1', 'e2', 'e-prazan'],
  rules: '',
  prizes: '',
}

const events = [
  event('e1', '2019-05-01'),
  event('e2', '2019-03-01'),
  event('e-prazan', '2019-04-01'),
  /* Outside the competition, and it has a race: without it „the races of this competition" and
     „every race handed in" are the same list. */
  event('e-tudji', '2019-02-01'),
]

const races = [
  race('r1', 'e1', 10, '2019-05-01'),
  race('r2', 'e2', 21, '2019-03-01'),
  race('r3', 'e1', 5.5, '2019-05-01'),
  race('r4', 'e1', 42, '2019-05-02'),
  race('r5', 'e-tudji', 10, '2019-02-01'),
]

describe('the races a competition counts', () => {
  it('takes them from the events the competition holds, and leaves every other race out', () => {
    const held = leagueRaces(league, races).map((one) => one.id)

    /* Named as a whole list rather than by „does it hold r1": a reading that takes every race
       there is contains every id this could ask about. */
    expect(held).toEqual(['r1', 'r2', 'r3', 'r4'])
  })

  it('is empty for a competition that holds no event at all', () => {
    expect(leagueRaces({ ...league, eventIds: [] }, races)).toEqual([])
  })
})

describe('the events of a competition, with the races of each that count', () => {
  it('is built out of the races handed in and not out of the events', () => {
    /* **The axis the record cannot carry yet, measured here where it can be.** Two of the three
       races of `e1` are handed in and the third is not, which is what `raceIds` will mean the day
       the backend that carries it lands. Built from the event instead, `r4` would be on this list
       though nobody handed it in. */
    const held = racesByEvent([race('r1', 'e1', 10), race('r3', 'e1', 5.5)], events)

    expect(held).toHaveLength(1)
    expect(first(held).races.map((one) => one.id)).toEqual(['r3', 'r1'])
  })

  it('leaves out an event the competition holds that has no race of its own', () => {
    /* `e-prazan` is in `eventIds` and in the events handed in, and no race names it. A heading
       with nothing under it says a competition counts something it does not. */
    const held = racesByEvent(leagueRaces(league, races), events)

    expect(held.map((one) => one.event.id)).toEqual(['e2', 'e1'])
  })

  it('says nothing at all where no race counts', () => {
    expect(racesByEvent([], events)).toEqual([])
  })

  it('puts the events in the order the season is run in, and parts a shared day by the name', () => {
    /* Two on one day are two entries reading the same date, so what orders them is the name; the
       real data holds such a pair (two half marathons in Mandarine, 3.11.2019). Ordered by the
       day alone, the pair keeps whatever order the file was written in. */
    const sameDay = [event('e-b', '2019-03-01', 'Beta'), event('e-a', '2019-03-01', 'Alfa')]
    const held = racesByEvent(
      [race('r-b', 'e-b', 10, '2019-03-01'), race('r-a', 'e-a', 10, '2019-03-01')],
      [...sameDay, event('e-kasniji', '2019-06-01')],
    )

    expect(held.map((one) => one.event.name)).toEqual(['Alfa', 'Beta'])
  })

  it('puts the races of one event in the order they are run, and parts one morning by the length', () => {
    /* The order the event's own page lists them in (`pages/EventDetail.tsx`). One event may run
       over several mornings (PDL P10), so the day comes first and the length parts the races of
       one morning: `r3` and `r1` share 1 May, `r4` is the next morning. */
    const held = racesByEvent(leagueRaces(league, races), events)
    const later = at(held, 1)

    expect(later.event.id).toBe('e1')
    expect(later.races.map((one) => one.id)).toEqual(['r3', 'r1', 'r4'])
  })

  it('hands back the event it was given, so what draws it needs nothing else', () => {
    /* The name and the address are what the list draws and what the link out of it is built
       from, and they come off the record rather than off anything worked out here. */
    const held = racesByEvent(leagueRaces(league, races), events)

    expect(first(held).event).toEqual(event('e2', '2019-03-01'))
  })
})
