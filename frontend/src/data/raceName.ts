import type { Race } from './types'
import { formatDistance } from '../i18n/format'

/**
 * What a race is called on a screen.
 *
 * Its name, and its length where it has no name (owner, 11.08.2026: the name
 * became optional, „tada je trka poznata po svojoj dužini"). Written once,
 * because three screens draw it and an empty cell on any of them is a race
 * nobody can tell from the one beside it: PDL P10 says the name is the only
 * thing by which a person recognises a race, so where there is none the length
 * has to do that work.
 */
export function raceName(race: Pick<Race, 'name' | 'distanceKm'>, locale: string): string {
  /* Written the way a length is spoken rather than tabulated, through the one
     function that decides that (i18n/format.ts, `formatDistance`): „16,2 km",
     the way anybody says which race they ran. The column of lengths beside it
     carries two decimals because a column of numbers is read down and has to
     line up; a name is read across, and „16,20 km" in a name is a table cell
     that wandered into a sentence. Both are the reader's own decimal mark,
     which is the part that must never differ. */
  return race.name.trim() === '' ? formatDistance(race.distanceKm, locale) : race.name
}
