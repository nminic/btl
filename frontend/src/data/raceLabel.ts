import type { Race } from './types'
import { formatDistance, formatNumber, formatShortDate } from '../i18n/format'

/**
 * What a race is called on a screen, among the other races of its own event.
 *
 * **Its name and its length, and whatever more it takes to be the only one.** A
 * race had no name until 23.08.2026 and was known by its measurements alone,
 * „21,1 km"; that day the owner gave it one: „ja mogu da u okviru Beogradskog
 * maratona imam dve trke, od 42.2 i 21.1, i obe će dobiti default naziv Beogradski
 * maraton. Ali onda mogu izmeniti ovu drugu da se zove Beogradski polumaraton." He
 * said in the same breath how a race is looked for: „naziv trke sa datumom i
 * dužinom".
 *
 * **Three steps, and each one is taken only where the step before it left two
 * races reading the same.** The name and the length; then the day; then the length
 * written out exactly. What decides each step is the whole label rather than any
 * one part of it, because a label is what a reader hears and two labels either
 * differ or they do not.
 *
 * **Why the name alone is not enough.** A race's name starts out as its event's,
 * and 886 of the 1163 events that hold any race at all hold exactly one, so on
 * three quarters of them the name says nothing the screen has not already said.
 * Measured in Chrome on 28.08.2026: „Prijavljuješ rezultat sa trke Mala Sveta gora
 * na događaju „Mala Sveta gora"", with the length, which was the one thing that
 * told the race apart, gone.
 *
 * **Why the day.** One event may run over several mornings (PDL P10), and eleven
 * events hold two or more races of one written length across more than one day:
 * Danube maraton 2022 has four of 42,2 km on four consecutive mornings. Counted
 * over the whole file on 28.08.2026: of 1612 races, 24 labels reach the second step and 4 the
 * third, and no two races of one event read the same.
 *
 * **Why the exact length, which is the step this function did not have until
 * 28.08.2026.** `formatDistance` writes one decimal, so 8,68 km and 8,74 km are
 * two races and one label, and BTL dezorijentiring 2018 runs twelve races of one
 * name on one morning and holds both of those and 9,06 and 9,07 besides. The day
 * cannot part them, because they share it. Measured before this step existed: that
 * page drew twelve links under ten different names, which is two pairs of links
 * that sound the same and lead somewhere different (WCAG 2.2 SC 2.4.4). Written out
 * to the hundredth, all twelve differ.
 *
 * The exact length is what the table of races on the same page already writes
 * (`pages/EventDetail.tsx`), so the row and the link that comes out of it now agree
 * where before the row said „8,68" and the link said „8,7 km". Two decimals and not
 * three: the two are one fact with two homes, and a label finer than its own row
 * would be the same disagreement the other way round.
 *
 * **The third step carries no day**, and that is not an oversight. It is reached
 * only where the day was already tried and told two races apart, so adding it there
 * would be fifteen characters that distinguish nothing. Measured by a review on
 * 28.08.2026: on BTL dezorijentiring the four labels that reach this step carried
 * „, 23. 12. 2018." while the table of races on the same page deliberately draws no
 * day column at all, because every race of that event runs on one morning (owner,
 * 10.08.2026).
 *
 * **What even three steps do not tell apart**, said out loud rather than left to be
 * found: two races of one event, one name, one morning, and two lengths that agree
 * to the hundredth. Measured on 28.08.2026: 8,681 km and 8,684 km both write „8,68
 * km" and read the same, and the administration takes both, since a length is typed
 * freely between 0,1 and 1000 (`pages/admin/raceRows.ts`) and a race's name comes
 * from its event unless somebody changes it. No such pair is in the file; the way
 * to close it is to rename one of them, and no label can do that for anybody.
 *
 * Each step only where it is needed, so the ordinary event of three lengths reads
 * as three lengths, not as three dates and not to the hundredth.
 *
 * The list a member searches when they enter a result themselves says name, day and
 * length, unconditionally (`pages/member/NewResult.tsx`). That is not this and is
 * not a second home for it: that list runs across every race of the league, where
 * the day is what tells one season from another, and this one runs inside a single
 * event, where the event has already said which year it is.
 */
export function raceLabel(race: Race, among: Race[], locale: string): string {
  const named = (one: Race) => `${one.name}, ${formatDistance(one.distanceKm, locale)}`
  const dated = (one: Race) => `${named(one)}, ${formatShortDate(one.date, locale)}`
  const exact = (one: Race) => `${one.name}, ${formatNumber(one.distanceKm, locale, 2)} km`
  const alone = (say: (one: Race) => string) => among.filter((one) => say(one) === say(race)).length < 2

  if (alone(named)) {
    return named(race)
  }

  return alone(dated) ? dated(race) : exact(race)
}
