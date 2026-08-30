import type { Race } from '../../data/types'
import { shiftDate } from '../../forms/dateField'

/**
 * A race of a copied event, as the store keeps one.
 *
 * Its own function and not an object written where it is used, because this is the
 * third place a race record is written (the other two are `admin/raceRows.ts` and
 * the generated file), every one of them has to name every field, and only this one
 * can be asked with a race the data has not got. Every race in
 * `public/mock/races.json` is a race of a length, so a copy measured through the
 * screen can only ever say what it says about a length.
 */
export function copiedRace(race: Race, event: string, by: number): Record<string, string> {
  return {
    eventId: event,
    /* Its name comes across with it, and so does whether it was given by hand:
       a race renamed „Beogradski polumaraton" is still that next season, and one
       that only ever carried its event's name goes on following it (owner,
       23.08.2026). */
    name: race.name,
    renamed: race.renamed,
    /* Moved with the event, by the same number of days: two races on the
       Saturday and one on the Sunday stay two and one, a year on (owner,
       10.08.2026). */
    date: shiftDate(race.date, by),
    /* Which of the three kinds it is, and its limit where it has one. A copy of a
       twenty four hour race is a twenty four hour race, and a field left out here
       would not come across empty but be lost: nothing downstream can tell a race
       that never had a kind from one that has none. */
    kind: race.kind,
    limitSeconds: String(race.limitSeconds),
    distanceKm: String(race.distanceKm),
    ascentM: String(race.ascentM),
    descentM: String(race.descentM),
  }
}
