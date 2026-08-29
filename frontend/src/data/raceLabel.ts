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
 * as its event's, and 886 of the 1163 events that hold any race at all hold exactly
 * one, so on three quarters of them the name says nothing the screen has not
 * already said: „Prijavljuješ rezultat sa trke Mala Sveta gora na događaju
 * „Mala Sveta gora"", with the length, which is the one thing that told the race
 * apart, gone. Measured in Chrome on 28.08.2026, against „21,1 km" the day before.
 *
 * **And the day where the two of them still say the same thing twice.** One event
 * may run over several mornings (PDL P10), and twelve events hold two or more races
 * of the same written length on different days: Danube maraton 2022 has four of
 * 42,2 km on four consecutive mornings. Added only there, so the ordinary event of
 * three lengths reads as three lengths and not as three dates.
 *
 * **The lengths are compared as they are written, not as they are stored**, and
 * that is a fault this function had until 28.08.2026. `formatDistance` rounds to
 * one decimal, so 8,68 km and 8,74 km are two numbers and one label: compared raw
 * they counted as different, no day was added, and the reader met „BTL
 * dezorijentiring, 8,7 km" twice in one list. Eleven events hold such a pair by the
 * stored number and twelve by the written one, and the difference between those two
 * counts is the whole of this bug.
 *
 * **What this does not tell apart**, said out loud rather than left to be found:
 * two races of one event with the same name, the same written length and the same
 * morning read the same. The administration allows them since 23.08.2026, on the
 * reasoning that „what tells them apart is the race's own name" — which is true
 * only of a race somebody has renamed. One event in the file is such a pair, BTL
 * dezorijentiring 2018, which runs twelve races of one name on one morning and
 * holds 8,68 and 8,74 among them. The way to close it is to rename one of them, and
 * no label can do that for anybody.
 *
 * The list a member searches when they enter a result themselves says name, day and
 * length, unconditionally (`pages/member/NewResult.tsx`). That is not this and is
 * not a second home for it: that list runs across every race of the league, where
 * the day is what tells one season from another, and this one runs inside a single
 * event, where the event has already said which year it is.
 */
export function raceLabel(race: Race, among: Race[], locale: string): string {
  const length = formatDistance(race.distanceKm, locale)
  const same = among.filter(
    (one) => one.name === race.name && formatDistance(one.distanceKm, locale) === length,
  )

  return same.length < 2
    ? `${race.name}, ${length}`
    : `${race.name}, ${length}, ${formatShortDate(race.date, locale)}`
}
