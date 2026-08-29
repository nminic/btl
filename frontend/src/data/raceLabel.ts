import type { Race } from './types'
import { formatDistance, formatNumber, formatShortDate, formatYear } from '../i18n/format'

/** What this function needs of a race: no more than three things, so a column of a
 *  competition grid can be named by it as well as a row of an event. */
export type Named = Pick<Race, 'name' | 'date' | 'distanceKm'>

/**
 * What a race is called on a screen, among the races it is shown beside.
 *
 * **Its name, when it was run, and its measure in brackets.** Owner, 29.08.2026:
 * „Ipak neka bude Ime trke godina (dužina). Npr. Beogradski polumaraton 2027
 * (21.1 km)". So „Beogradski polumaraton 2027. (21,1 km)", with the year written
 * the way Serbian writes one and the length the way this portal writes one.
 *
 * **The brackets hold the measure of the race, which is not always a length.** PDL
 * has held three kinds since the specification was written — timed, by length, and
 * free — and says the kind is shown in brackets: „(6 h)", „(21,1 km)", „(S)". The
 * portal cannot yet record which kind a race is, so today the brackets always hold
 * the length, which is true of every race in the data; `measure` below is the one
 * place that will have to answer differently when it can.
 *
 * **Four rungs, and the first that stands alone is the one used.** The year and the
 * rough length; then the day in place of the year; then the year and the length
 * written out exactly; then the day and the exact length. Each rung is at least as
 * telling as the one before it, so the ladder cannot end on a rung that parts fewer
 * races than one it has already passed — a fault a review measured on 29.08.2026,
 * when the third rung dropped what the second had added.
 *
 * What decides each rung is the whole label rather than any one part of it, because
 * a label is what a reader hears and two labels either differ or they do not.
 *
 * **Why the day appears at all.** One event may run over several mornings (PDL
 * P10), and the year cannot part two of its races: Danube maraton 2022 runs four
 * races of 42,2 km on four consecutive mornings, all under the event's name, so
 * without the day they would be four links reading alike and leading elsewhere
 * (WCAG 2.2 SC 2.4.4).
 *
 * **Why the exact length.** `formatDistance` writes one decimal, so 8,68 km and
 * 8,74 km are two races and one label, and BTL dezorijentiring 2018 runs twelve
 * races of one name on one morning and holds both of those. The day cannot part
 * them, because they share it. Two decimals and not three: the table of races on
 * the same page writes two (`pages/EventDetail.tsx`), and a label finer than its own
 * row would part two links over rows that read alike.
 *
 * **What no rung parts:** two races of one name, one morning, and two lengths that
 * agree to the hundredth. 8,681 km and 8,684 km both write „8,68 km". The way to
 * close such a pair is to rename one of the races, and no label can do that for
 * anybody. Rounding to the hundredth is not a refinement of rounding to the tenth,
 * so the family is real rather than theoretical: 8,649 km and 8,651 km are parted
 * by the rough length and joined by the exact one.
 */
export function raceLabel(race: Named, among: Named[], locale: string): string {
  const said = raceLabelParts(race, among, locale)

  return `${said.name} ${said.rest}`
}

/**
 * The same label in two halves: what the race is called, and everything the label
 * adds to tell it from its neighbours.
 *
 * One builder and two ways of reading it, rather than two builders. The grid of a
 * competition needs the halves because it may cut the name and must never cut the
 * rest (`pages/league/LeagueResults.tsx`), and a grid that split the finished
 * string would be reading a shape this file is free to change.
 */
export function raceLabelParts(
  race: Named,
  among: Named[],
  locale: string,
): { name: string; rest: string } {
  /* What goes in the brackets. One home, because this is the answer that will stop
     being „the length" the day a race can say it is timed or free. */
  const measure = (one: Named, decimals: number) =>
    decimals === 1
      ? formatDistance(one.distanceKm, locale)
      : `${formatNumber(one.distanceKm, locale, decimals)} km`

  const rest = (when: (one: Named) => string, decimals: number) => (one: Named) =>
    `${when(one)} (${measure(one, decimals)})`

  const year = (one: Named) => formatYear(one.date, locale)
  const day = (one: Named) => formatShortDate(one.date, locale)
  /* Decided by the whole label and not by the half that changes, because two
     labels either differ or they do not, and two races may share a name. */
  const alone = (say: (one: Named) => string) =>
    among.filter((one) => `${one.name} ${say(one)}` === `${race.name} ${say(race)}`).length < 2

  const steps = [rest(year, 1), rest(day, 1), rest(year, 2), rest(day, 2)]

  return { name: race.name, rest: (steps.find(alone) ?? rest(day, 2))(race) }
}
