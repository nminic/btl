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
  /* Written the way every other length on the portal is written, through the
     one function that decides that (i18n/format.ts): a race named by its length
     must read the same as the length beside it. */
  return race.name.trim() === '' ? formatDistance(race.distanceKm, locale) : race.name
}
