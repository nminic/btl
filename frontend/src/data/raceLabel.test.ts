import { describe, expect, it } from 'vitest'
import { raceLabel } from './raceLabel'
import type { Named } from './raceLabel'

/* What a race is called, asked of the function rather than of a screen.

   Three screens read it (`pages/EventDetail.tsx`, `pages/event/ReportResult.tsx`,
   `pages/league/LeagueResults.tsx`) and each one of them has guards of its own,
   but every race in `public/mock/races.json` is a race of a length, so between
   them they can only ever ask the one question. The other two kinds have nowhere
   else to be asked from.

   The owner said on 29.08.2026 what the brackets hold: „Ipak neka bude Ime trke
   godina (dužina)", and „kad je trka vremenska, prikazuje se trajanje u zagradi.
   Npr. Šri Činmoj ultramaraton 2026. (24 h)". On 30.08.2026 he was offered three
   answers for a free race and chose the third: no brackets at all, name and year
   alone. */

const SR = 'sr-Latn'

/** A race, said only in what a name is made of. */
function race(over: Partial<Named> = {}): Named {
  return {
    name: 'Trka',
    date: '2027-04-11',
    kind: 'length',
    limitSeconds: 0,
    distanceKm: 21.1,
    ...over,
  }
}

describe('what a race is called', () => {
  it('names a race of a length by its length', () => {
    /* The owner's own example, written the way this portal writes a year and a
       length: „2027." with the full stop Serbian puts there, and „21,1 km" with the
       comma. His was „Beogradski polumaraton 2027 (21.1 km)". */
    const one = race({ name: 'Beogradski polumaraton' })

    expect(raceLabel(one, [one], SR)).toBe('Beogradski polumaraton 2027. (21,1 km)')
  })

  it('names a timed race by how long it lasts, and never by a length', () => {
    /* His second example, the twenty four hour ultra. The length is set to
       something that would be read out if the brackets were still holding one, so
       this case fails on the wrong measure as well as on a missing one: a bracket
       that went on writing the length would say „(60,0 km)" here. */
    const one = race({
      name: 'Šri Činmoj ultramaraton',
      date: '2026-09-19',
      kind: 'time',
      limitSeconds: 86_400,
      distanceKm: 60,
    })

    expect(raceLabel(one, [one], SR)).toBe('Šri Činmoj ultramaraton 2026. (24 h)')
  })

  it('names a free race by nothing at all, with no brackets left behind', () => {
    /* Owner, 30.08.2026, on three offered answers. The empty brackets are the
       thing to watch for: a measure that comes back empty and a bracket written
       anyway gives „BTL Round 'n' Around 2027. ()", which is what this asks about
       by comparing the whole string rather than looking for the year in it. */
    const one = race({ name: "BTL Round 'n' Around", kind: 'free', distanceKm: 0 })

    expect(raceLabel(one, [one], SR)).toBe("BTL Round 'n' Around 2027.")
  })

  it('parts two timed races of one name and one year by the day they were run', () => {
    /* The cost of naming a race by its limit: two twelve hour races of one name in
       one year read alike, since they share the limit the way two races of 10 km
       share a length. The ladder answers it the way it answers that one, by
       climbing to the day (PDL P10: one event may run over several mornings).

       Both halves asked. „Not equal" alone would pass on a rung that wrote
       something else entirely. */
    const spring = race({ kind: 'time', limitSeconds: 43_200, date: '2027-04-11' })
    const autumn = race({ kind: 'time', limitSeconds: 43_200, date: '2027-10-03' })
    const both = [spring, autumn]

    expect(raceLabel(spring, both, SR)).toBe('Trka 11. 4. 2027. (12 h)')
    expect(raceLabel(autumn, both, SR)).toBe('Trka 3. 10. 2027. (12 h)')
  })

  it('cannot part two free races of one name run on one morning, and that is the cost', () => {
    /* Written down because it is a cost the owner was told of before he chose, and
       because a guard is the only place a cost like this stays true. A race of a
       length has four rungs to climb and the last two write the length out exactly;
       a free race has no length to write, so the third and fourth rungs say what
       the first and second said, and two of them on one morning end on one label.

       The way to close such a pair is to rename one of the races, which is what the
       same family says of two races of one name, one morning and one length. */
    const first = race({ kind: 'free', distanceKm: 0 })
    const second = race({ kind: 'free', distanceKm: 0 })
    const both = [first, second]

    expect(raceLabel(first, both, SR)).toBe(raceLabel(second, both, SR))
    expect(raceLabel(first, both, SR)).toBe('Trka 11. 4. 2027.')
  })

  it('names a race of a kind it does not know by its length, and parts two of them', () => {
    /* The type says one of three and the file says whatever it says. Read as a race
       of a length, which is what every race was before the field existed, so the
       ladder goes on working: read as anything else, the third and fourth rungs are
       switched off and two races of one name on one morning at 8,68 and 8,74 km come
       out under one and the same name, which is two links reading alike and leading
       elsewhere (WCAG 2.2 SC 2.4.4). Measured by a review on 30.08.2026. */
    const shorter = { ...race({ distanceKm: 8.68 }), kind: 'ludilo' }
    const longer = { ...race({ distanceKm: 8.74 }), kind: 'ludilo' }
    const both = [shorter, longer]

    expect(raceLabel(shorter, both, SR)).toBe('Trka 2027. (8,68 km)')
    expect(raceLabel(longer, both, SR)).toBe('Trka 2027. (8,74 km)')
  })

  it('goes on parting two races of a length by the length written out exactly', () => {
    /* The rung that was there before any of this, asked again because the kind now
       decides what a rung writes and a mistake there would take this away without
       taking a case with it. Two races of one name on one morning, 8,68 and 8,74
       km: the rough length writes „8,7 km" for both, the day cannot part them
       either since they share it, and the third rung, the year with the length
       written out exactly, is the first that stands alone. */
    const shorter = race({ distanceKm: 8.68 })
    const longer = race({ distanceKm: 8.74 })
    const both = [shorter, longer]

    expect(raceLabel(shorter, both, SR)).toBe('Trka 2027. (8,68 km)')
    expect(raceLabel(longer, both, SR)).toBe('Trka 2027. (8,74 km)')
  })
})
