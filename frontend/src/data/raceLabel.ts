import type { Race } from './types'
import { formatDistance, formatShortDate } from '../i18n/format'

/**
 * What a race is called on a screen, among the other races of its own event.
 *
 * A race has no name of its own (owner, 11.08.2026, types.ts), so it is known by
 * its measurements: „21,1 km". The event is not repeated, because every screen
 * that draws this list has already said which event it is.
 *
 * **The day is added where the length alone would say the same thing twice.**
 * One event may run over several mornings (PDL P10), and thirteen events in the
 * league's own history hold two or more races of exactly the same length on
 * different days: Danube maraton 2022 has four of 42,2 km, on the fourteenth,
 * fifteenth, sixteenth and seventeenth of March. A list offering „42,2 km" four
 * times is a list somebody picks from blindly, and what is picked decides which
 * race the result is filed against.
 *
 * Added only where it is needed, so the ordinary event of three different
 * lengths on one morning reads as three lengths and not as three dates.
 */
export function raceLabel(race: Race, among: Race[], locale: string): string {
  const length = formatDistance(race.distanceKm, locale)
  const sameLength = among.filter((one) => one.distanceKm === race.distanceKm)

  return sameLength.length < 2 ? length : `${length}, ${formatShortDate(race.date, locale)}`
}
