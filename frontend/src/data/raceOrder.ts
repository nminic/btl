import { raceKind } from './raceKind'
import type { Race, RaceKind } from './types'

/** What the order needs of a race: what it is, how long it is or lasts, what it is called, and
 *  the key that settles the rest. The kind is a word and not one of the three, for the reason
 *  `raceLabel.ts` gives about its own `Named`: the record arrives unchecked. */
export type Ordered = Pick<Race, 'id' | 'name' | 'distanceKm' | 'limitSeconds'> & { kind: string }

/** Races of a length first, then the timed ones, then the free ones (owner, 18.10.2026). */
const KIND_FIRST: Record<RaceKind, number> = { length: 0, time: 1, free: 2 }

/**
 * THE RACES OF ONE EVENT IN THE ORDER THE OWNER GAVE, AND THE ONE PLACE THAT ORDER IS DECIDED.
 *
 * PDL P6, „Redosled trka jednog događaja" (18.10.2026). The owner, over a picture of an event
 * with three timed races of 12 h, 24 h and 6 h: „Ovde treba da se trke sortiraju po dužini od
 * najduže do najkraće, ili po vremenu od najduže do najkraće." With it, chosen among the outcomes
 * offered on the recommendation that was put to him, three parts, each of them a key below:
 *
 * - **an event of more than one kind:** the races of a length first, the longest of them first,
 *   then the timed ones, the longest of them first, then the free ones;
 * - **a tie:** two races of one length, or of one duration, go by their names in alphabetical
 *   order, and the free races, which have neither, go by their names among themselves;
 * - **where:** everywhere the races of one event are listed - the page of the event, the form of
 *   the event in administration, the choice of a race when a result is entered, and the
 *   calendar.
 *
 * **The day is not a key, and that is a reading of his sentence and not a sentence of his.** It
 * names a length and a duration and nothing else, so an event over two mornings lists its
 * marathon of the Sunday over its half marathon of the Saturday. Until 18.10.2026 every list here
 * put the day first and the shortest race first inside it. If the owner wants the day back, it is
 * one more key at the top of `inEventOrder` and no screen changes.
 *
 * **The last key is the race's own number**, so two races of one kind, one measure and one name
 * still come out in one order on every screen and on every render, rather than in whatever order
 * the list arrived in.
 *
 * **The calendar draws no list of races**, only the dots of the lengths an event holds, and those
 * follow the legend (`DOTS`, `data/types.ts`) rather than this; the decision is read as being
 * about the lists in which races are named one by one.
 */
export function inEventOrder<T extends Ordered>(races: readonly T[]): T[] {
  return [...races].sort(
    (left, right) =>
      KIND_FIRST[raceKind(left.kind)] - KIND_FIRST[raceKind(right.kind)] ||
      measureOf(right) - measureOf(left) ||
      left.name.localeCompare(right.name, 'sr-Latn') ||
      left.id - right.id,
  )
}

/** How long a race is or lasts, in whatever unit its kind measures it by, and nothing for a free
 *  race: the kind has already parted the three, so the two units are never compared. */
function measureOf(race: Ordered): number {
  const kind = raceKind(race.kind)

  if (kind === 'free') {
    return 0
  }

  return kind === 'time' ? race.limitSeconds : race.distanceKm
}
