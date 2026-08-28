import type { Race } from './types'
import { formatDistance, formatShortDate } from '../i18n/format'

/**
 * What a race is called on a screen, among the other races of its own event.
 *
 * **Its name and its length, always both.** A race had no name until 23.08.2026
 * and was known by its measurements alone, „21,1 km"; that day the owner gave it
 * one: „ja mogu da u okviru Beogradskog maratona imam dve trke, od 42.2 i 21.1, i
 * obe će dobiti default naziv Beogradski maraton. Ali onda mogu izmeniti ovu drugu
 * da se zove Beogradski polumaraton." He said in the same breath how a race is
 * looked for: „naziv trke sa datumom i dužinom".
 *
 * **The name alone was tried first and measured wrong.** A race's name starts out
 * as its event's, and 886 of the 1163 events in the league's own history hold
 * exactly one race, so on three quarters of them the name says nothing the screen
 * has not already said: „Prijavljuješ rezultat sa trke Mala Sveta gora na događaju
 * „Mala Sveta gora"", with the length, which is the one thing that told the race
 * apart, gone. Measured in Chrome on 28.08.2026, against „21,1 km" the day before.
 *
 * **And the day where the two of them still say the same thing twice.** One event
 * may run over several mornings (PDL P10), and thirteen events hold two or more
 * races of exactly the same length on different days: Danube maraton 2022 has four
 * of 42,2 km on four consecutive mornings. Added only there, so the ordinary event
 * of three lengths reads as three lengths and not as three dates.
 *
 * **What this does not tell apart**, said out loud rather than left to be found:
 * two races of one event with the same name, the same length and the same morning
 * read the same. The administration allows them since 23.08.2026, on the reasoning
 * that „what tells them apart is the race's own name" — which is true only of a
 * race somebody has renamed. No such pair exists in the file today; the way to
 * close it is to rename one of them, and this cannot do it for anybody.
 *
 * The list a member searches when they enter a result themselves says name, day and
 * length, unconditionally (`pages/member/NewResult.tsx`). That is not this and is
 * not a second home for it: that list runs across every race of the league, where
 * the day is what tells one season from another, and this one runs inside a single
 * event, where the event has already said which year it is.
 */
export function raceLabel(race: Race, among: Race[], locale: string): string {
  const length = formatDistance(race.distanceKm, locale)
  const same = among.filter((one) => one.name === race.name && one.distanceKm === race.distanceKm)

  return same.length < 2
    ? `${race.name}, ${length}`
    : `${race.name}, ${length}, ${formatShortDate(race.date, locale)}`
}
