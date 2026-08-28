import type { Race } from './types'
import { formatDistance, formatShortDate } from '../i18n/format'

/**
 * What a race is called on a screen, among the other races of its own event.
 *
 * **Its name.** A race had none until 23.08.2026 and was known by its
 * measurements instead, „21,1 km"; that day the owner gave it one: „ja mogu da u
 * okviru Beogradskog maratona imam dve trke, od 42.2 i 21.1, i obe će dobiti
 * default naziv Beogradski maraton. Ali onda mogu izmeniti ovu drugu da se zove
 * Beogradski polumaraton." The name went into the record and into the
 * administration, and this function went on writing the length, so a race the
 * administrator had renamed still read „21,10 km" on the event's own page and in
 * the form it opens. It is the name now.
 *
 * **And what tells two of them apart, where the name does not.** Both races of an
 * event start out carrying the event's name, so „Beogradski maraton" twice is a
 * list somebody picks from blindly, and what is picked decides which race the
 * result is filed against. The length is added there, and where two races share
 * the name and the length as well, the day: one event may run over several
 * mornings (PDL P10), and thirteen events in the league's own history hold two or
 * more races of exactly the same length on different days, Danube maraton 2022
 * holding four of 42,2 km on four consecutive mornings.
 *
 * Each of the two added only where it is needed, so an event whose races were
 * given their own names reads as those names and nothing else, and the ordinary
 * event of three lengths under one name reads as three lengths and not as three
 * dates.
 */
export function raceLabel(race: Race, among: Race[], locale: string): string {
  const sameName = among.filter((one) => one.name === race.name)

  if (sameName.length < 2) {
    return race.name
  }

  const length = formatDistance(race.distanceKm, locale)
  const sameLength = sameName.filter((one) => one.distanceKm === race.distanceKm)

  return sameLength.length < 2
    ? `${race.name}, ${length}`
    : `${race.name}, ${length}, ${formatShortDate(race.date, locale)}`
}
