import { raceKind } from '../../data/raceKind'
import type { Race } from '../../data/types'

/**
 * What a race is measured by, as the dictionary key of the word for it: how long it
 * lasts where it is timed, how far it is otherwise.
 *
 * Asked through `raceKind` and not of the record's own word, for the reason that
 * function gives: a word this portal has never heard of is a race of a length. A free
 * race is read with the length, which is the owner's choice of 16.10.2026 ("Dužina"
 * where every race is of a length or free): it has no figure of its own to name, and
 * its cell stays empty.
 */
export function measureKey(kind: string): 'event.distance' | 'event.duration' {
  return raceKind(kind) === 'time' ? 'event.duration' : 'event.distance'
}

/**
 * The head over the column that holds the measure of every race of an event, among
 * three (owner, 16.10.2026, chosen among the ways he was offered and with the
 * assistant's recommendation; PDL, „Ispravke sa ekrana 16.10.2026"):
 *
 * - „Dužina" where every race is of a length or free (an event with no race at all
 *   too, since a heading over nothing says the word that is true of most);
 * - „Trajanje" where every race is timed;
 * - „Dužina / trajanje" where the two are mixed.
 *
 * The word „Mera" is gone from the portal on the owner's word: „Nisam rekao da se
 * bilo gde više pominje MERA."
 */
export function measureHeadingKey(
  races: readonly Pick<Race, 'kind'>[],
): 'event.distance' | 'event.duration' | 'event.distanceOrDuration' {
  const timed = races.filter((one) => measureKey(one.kind) === 'event.duration').length

  if (timed === 0) {
    return 'event.distance'
  }

  return timed === races.length ? 'event.duration' : 'event.distanceOrDuration'
}
