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
 * **Four steps, and each one is taken only where the step before it left two
 * races reading the same.** The name and the length; then the day; then the length
 * written out exactly; then both at once. What decides each step is the whole label
 * rather than any one part of it, because a label is what a reader hears and two
 * labels either differ or they do not.
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
 * **The third step carries no day, and the fourth puts it back.** The third is the
 * short one, and it is enough wherever the exact length is the only thing missing:
 * on BTL dezorijentiring its four labels would otherwise carry „, 23. 12. 2018." —
 * fifteen characters — while the table of races on the same page deliberately draws
 * no day column at all, because every race of that event runs on one morning
 * (owner, 10.08.2026).
 *
 * **But it is not enough by itself, and that was a fault of this file for one
 * commit.** A step that drops what the step before it added can tell fewer races
 * apart than its predecessor, and the ladder then ends lower than it started. Found
 * by a review on 29.08.2026: an event running the same two courses on two mornings
 * — 8,68 km and 8,74 km on each — collides at every one of the first three steps,
 * because the exact length repeats across the mornings, and came out as two labels
 * for four races. On `pages/EventDetail.tsx` those are four „Unesi rezultat" links,
 * two pairs of which sound the same and lead somewhere different, which is the very
 * WCAG 2.2 SC 2.4.4 fault the exact length was added to close. The fourth step,
 * exact length **and** day, closes it.
 *
 * **Why the steps stand in this order**, which is not by length: the second step is
 * the first plus a comma and a whole date, and the third is the first with one more
 * digit in it, so the third is always the shorter of the two. Measured on „Probna
 * trka, 8,68 km": twenty characters against thirty-two on 1. 1. 2020., and against
 * thirty-four on 23. 12. 2018., which is the day BTL dezorijentiring runs on.
 *
 * The day comes first because the day is what the page beside this label already
 * draws when an event runs over more than one morning (owner, 10.08.2026), and the
 * hundredth comes after it because it is a last resort: it is finer than anything
 * the reader asked for, and it is only ever reached where the day has been tried
 * and shares itself out among the races that collide.
 *
 * **What even four steps do not tell apart**, said out loud rather than left to be
 * found: two races of one event, one name, one morning, and two lengths that agree
 * to the hundredth. Measured on 28.08.2026: 8,681 km and 8,684 km both write „8,68
 * km" and read the same, and the administration takes both, since a length is typed
 * freely between 0,1 and 1000 (`pages/admin/raceRows.ts`) and a race's name comes
 * from its event unless somebody changes it. No such pair is in the file.
 *
 * **And rounding to the hundredth is not a refinement of rounding to the tenth,**
 * which is the part of that limit worth spelling out, because it is surprising.
 * Found by a review on 29.08.2026: 8,649 km and 8,651 km write „8,6 km" and „8,7
 * km" as the second step writes them, and both write „8,65 km" as the third and
 * fourth do. So the last rung is not strictly the most telling: there is one
 * family of pairs, and only one, that an earlier rung parts and the last does not.
 *
 * **That is a decision and not an oversight, and what is decided is the
 * precision.** The boundary, in both directions:
 *
 * - **not finer than the hundredth.** 8,681 km and 8,684 km stay one label,
 *   because the table of races on the same page draws „8,68" for both
 *   (`pages/EventDetail.tsx`), and a label finer than its own row would part two
 *   links on a page whose rows still read alike.
 * - **not coarser.** On BTL dezorijentiring 8,68 km and 8,74 km must be parted,
 *   and the tenth writes „8,7 km" for both of them.
 *
 * The hundredth is the row's own precision, so the two agree; the price of that
 * agreement is the family above, where a coarser rounding happens to part what the
 * row's own rounding joins.
 *
 * **What is not decided here, said plainly because an earlier version of this note
 * claimed it and a review found it false in both directions.** This function does
 * not promise to part exactly what a row parts. It is built from three things —
 * the name, the length and the day — and a row carries more than three: two races
 * of one name, one morning and one written length are two different rows when
 * their climb and their fall differ, and no label made of those three can part
 * them. And it works among the races of the event, so with only two of them the
 * first step is enough and a pair the row joins can come out parted. A label is a
 * name and not a row; what it owes is to be the only one of its kind here.
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
  const exact = (one: Race) => `${one.name}, ${formatNumber(one.distanceKm, locale, 2)} km`
  const onItsDay = (say: (one: Race) => string) => (one: Race) =>
    `${say(one)}, ${formatShortDate(one.date, locale)}`
  const alone = (say: (one: Race) => string) => among.filter((one) => say(one) === say(race)).length < 2

  /* In the order written out above: the name, then the day, then the hundredth,
     then both. Not by length, and not strictly by how much each one tells; the
     note says why each stands where it does. */
  const steps = [named, onItsDay(named), exact, onItsDay(exact)]

  return (steps.find(alone) ?? onItsDay(exact))(race)
}
