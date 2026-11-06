import type { BtlEvent, Race } from '../../data/types'
import { racesToOffer } from './racesToOffer'

/**
 * The races offered while the name of a race is typed, which is the choice of a race when a result
 * is entered (PDL P6, „Redosled trka jednog događaja", 18.10.2026): the events newest first, as the owner
 * asked on 23.08.2026, and the races of one event together in his order of 18.10.2026, in which „Dan trke ne
 * ulazi u redosled" - also for an event over two mornings.
 */

const event = (id: number, date: string): BtlEvent => ({
  id,
  slug: `dogadjaj-${String(id)}`,
  name: `Događaj ${String(id)}`,
  date,
  city: 'Beograd',
  country: 'RS',
  kind: 'race',
  description: '',
  link: '',
  copiedFrom: null,
  featured: false,
})

const race = (id: number, eventId: number, date: string, over: Partial<Race> = {}): Race => ({
  id,
  eventId,
  name: `Trka ${String(id)}`,
  renamed: false,
  kind: 'length',
  limitSeconds: 0,
  date,
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  category: 'short',
  dots: ['short'],
  ...over,
})

describe('the races offered when a result is entered', () => {
  it("put the newest event first and the races of one event, of both its mornings, in the owner's order", () => {
    /* One event over two mornings and another before it. The races of the second morning are handed
       in as the server answers them, by the key, which is neither the owner's order nor its
       reverse: a timed race of 6 h, a free one, a race of 5 km, a timed race of 24 h. The first morning
       holds the longest race of the event, so a list that put the later morning first (the order by the day
       of each race, which this was until 06.11.2026) cannot be told from the owner's order. */
    const offered = racesToOffer(
      [event(1, '2027-05-01'), event(2, '2027-04-01')],
      [
        race(10, 1, '2027-05-01'),
        race(11, 1, '2027-05-02', { kind: 'time', limitSeconds: 6 * 3600, distanceKm: 0 }),
        race(12, 1, '2027-05-02', { kind: 'free', distanceKm: 0 }),
        race(13, 1, '2027-05-02', { distanceKm: 5 }),
        race(14, 1, '2027-05-02', { kind: 'time', limitSeconds: 24 * 3600, distanceKm: 0 }),
        race(20, 2, '2027-04-01'),
      ],
      '2027-06-01',
      'sr-Latn',
    )

    /* Length races from the longest (10 km of the first morning, 5 km of the second), then the timed ones
       from the longest time, then the free one; and only then the event before it. */
    expect(offered.map((one) => one.id)).toEqual(['10', '13', '14', '11', '12', '20'])
  })

  it('order the events by the day of the event and not by the order they are handed in', () => {
    const offered = racesToOffer(
      [event(2, '2027-04-01'), event(3, '2027-03-01'), event(1, '2027-05-01')],
      [race(20, 2, '2027-04-01'), race(30, 3, '2027-03-01'), race(10, 1, '2027-05-01')],
      '2027-06-01',
      'sr-Latn',
    )

    expect(offered.map((one) => one.id)).toEqual(['10', '20', '30'])
  })

  it('offer only the races of the mornings that have come, and keep the order of the ones that have', () => {
    const offered = racesToOffer(
      [event(1, '2027-05-01')],
      [
        race(10, 1, '2027-05-01', { distanceKm: 5 }),
        race(11, 1, '2027-05-02', { distanceKm: 10 }),
        race(12, 1, '2027-05-02', { distanceKm: 21 }),
      ],
      '2027-05-01',
      'sr-Latn',
    )

    expect(offered.map((one) => one.id)).toEqual(['10'])
  })
})
