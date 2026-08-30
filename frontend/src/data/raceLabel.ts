import type { Race } from './types'
import { raceKind } from './raceKind'
import {
  formatDistance,
  formatLimit,
  formatNumber,
  formatShortDate,
  formatYear,
} from '../i18n/format'

/** What this function needs of a race: its name, its day, and what it measures out
 *  in advance, so a column of a competition grid can be named by it as well as a
 *  row of an event. */
export type Named = Pick<Race, 'name' | 'date' | 'limitSeconds' | 'distanceKm'> & {
  /* Whatever the record says, and not one of the three words: the type on `Race` is
     a promise the file does not keep, and this is one of the places that reads it
     (`data/raceKind.ts`). Said here rather than trusted, so a caller holding a
     record straight off the disk is not made to lie about it first. */
  kind: string
}

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
 * free. A race of a length is named by its length, „(21,1 km)"; a timed race by how
 * long it lasts, „Šri Činmoj ultramaraton 2026. (24 h)", which is the owner's own
 * example of 29.08.2026; and a free race by **nothing at all**, „BTL Round 'n'
 * Around 2027.", which is his answer of 30.08.2026.
 *
 * **A free race is named without brackets, and that costs something he was told
 * about.** PDL wrote „(S)" for it, but that mark was written for the calendar,
 * where a tile is a seventh of the page wide; here the same mark would be read out
 * as the letter S by anybody using a screen reader, and this function hands back a
 * string, so there is nowhere to put the word the letter stands for. Empty brackets
 * are worse than none, so a free race is named by its name and its day alone — and
 * two free races of one name run on one morning cannot be told apart at all, which
 * is the family described under „what no rung parts" below, entered by a second
 * door.
 *
 * **Four rungs, and the first that stands alone is the one used.** The year and the
 * rough length; then the day in place of the year; then the year and the length
 * written out exactly; then the day and the exact length.
 *
 * **A rung is another way of telling races apart, not a sharper one.** This used to
 * claim otherwise: that each rung is at least as telling as the one before it, so the
 * ladder cannot end on a rung parting fewer races than one it has already passed. It
 * can, and the reason is the one written out under „what no rung parts" below: the
 * third rung rounds to the hundredth where the first rounds to the tenth, and that is
 * not a refinement. Four races of one name on one morning, of 8,649, 8,600, 8,651 and
 * 8,700 km, come out as three labels between them: 8,600 and 8,700 stand alone on the
 * third rung, and the other two fall past all four and end on one and the same label,
 * „... 5. 1. 2019. (8,65 km)", though the rough length of the first rung had parted
 * them. Same family as the pair below, and it closes the same way, by renaming one of
 * the races.
 *
 * **Rare, and measured rather than assumed.** Over `public/mock/races.json` on
 * 29.08.2026, each race read among the races of its own event, which is the set both
 * event screens hand in: of 1612 races, 1584 are named by the first rung, 24 by the
 * second, 4 by the third, none by the fourth, and no two labels collide anywhere.
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
/**
 * What a race is measured by, in one word or two: its length, how long it lasts,
 * or nothing at all.
 *
 * The one home for that answer (ADL A31), because it is asked in two places and
 * they must not drift. Here it fills the brackets of a name; on the member's form
 * for a new result it is the last of the three things a race is offered by, „naziv
 * trke sa datumom i dužinom" as the owner put it on 23.08.2026, where the third
 * of them stopped being a length the day a race could say it is timed.
 *
 * Empty for a free race, which is the answer the owner chose on 30.08.2026, so
 * every caller has to say what it does with nothing rather than print it.
 */
export function raceMeasure(race: Named, locale: string): string {
  /* Read through the one function that knows the three words, and not off the
     record. The type says `RaceKind`; the file says whatever it says, and a word
     this portal has never heard of would otherwise fall past both branches below
     and be named by neither its length nor its limit (`data/raceKind.ts`). */
  const kind = raceKind(race.kind)

  if (kind === 'free') {
    return ''
  }

  return kind === 'time'
    ? formatLimit(race.limitSeconds)
    : formatDistance(race.distanceKm, locale)
}

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
  /* What goes in the brackets. `raceMeasure` answers it, and the second rounding
     is asked for here alone: only a race of a length has anything a decimal can
     sharpen, so the other two kinds give the same answer on every rung. */
  const measure = (one: Named, decimals: number) =>
    decimals === 1 || raceKind(one.kind) !== 'length'
      ? raceMeasure(one, locale)
      : `${formatNumber(one.distanceKm, locale, decimals)} km`

  const rest = (when: (one: Named) => string, decimals: number) => (one: Named) => {
    const said = measure(one, decimals)

    /* Brackets only where there is something to put in them. „Round 'n' Around
       2027. ()" would be a pair of empty brackets on every free race there is. */
    return said === '' ? when(one) : `${when(one)} (${said})`
  }

  const year = (one: Named) => formatYear(one.date, locale)
  const day = (one: Named) => formatShortDate(one.date, locale)
  /* Decided by the whole label and not by the half that changes, because two
     labels either differ or they do not, and two races may share a name. */
  const alone = (say: (one: Named) => string) =>
    among.filter((one) => `${one.name} ${say(one)}` === `${race.name} ${say(race)}`).length < 2

  const steps = [rest(year, 1), rest(day, 1), rest(year, 2), rest(day, 2)]

  return { name: race.name, rest: (steps.find(alone) ?? rest(day, 2))(race) }
}
