/**
 * WHAT NUMBERS A RECORD MADE DURING A VISIT, in the two shapes the prototype has.
 *
 * **One rule holds both, and it is never the count.** The count goes back down and
 * the numbers do not: make two records, delete the first, make a third, and a
 * count hands the third the number the second holds. Two records then answer to
 * one id, the table draws them under one key, a lookup finds only the first, and
 * an edit to either reaches both. Measured on the real screen on 23.08.2026:
 * `E-trka-1` and `E-trka-2` saved, `E-trka-1` deleted, a third race entered, and
 * it came out as `E-trka-2` again. React said so out loud („two children with the
 * same key") and the third race was not on the screen at all.
 *
 * The two shapes are what they are numbered AGAINST. `nextIdentity` is for a
 * record the portal serves, whose identity is a `bigserial`; `nextNumber` is for
 * the things that live only in a visit and carry a word with a number after it -
 * a submission, an application, an invitation.
 */

/**
 * The identity a record the portal serves is handed when a visit makes one.
 *
 * See the note on `nextNumber` below for the other shape.
 */
export function nextIdentity(taken: number[]): number {
  /* **One BELOW the lowest in use, counting down from nought**, and that is the
     prototype saying out loud that it has no sequence.

     Every record this portal serves under the name `id` is identified by a
     `bigserial` (`CalendarApi`, `TeamApi`, `LeagueApi`, `ModeratorApi`), which
     starts at one and never goes below it. So nothing numbered here can be the
     number of anything in the served file or of anything a server will ever hand
     out, whatever either grows to, and the screen that hands one out does not
     have to have READ the file first to be sure of that. Counted upwards it
     would: a screen holding only what this visit made would start again at one
     and give a second record the number the file's first already answers to, and
     two records under one identity is the whole fault this module exists to
     prevent. `admin/ReviewQueue.tsx` is exactly such a screen.

     Nought as the ceiling rather than `Math.min()` of nothing, which is
     `Infinity`, and reduce rather than a spread, because the lists handed in run
     to the whole of the races. */
  return taken.reduce((least, one) => Math.min(least, one), 0) - 1
}

/**
 * The number a thing that lives only in this visit is handed, under a word of
 * its own: `sub-3`, `app-2`, `inv-1`, `par-4`.
 *
 * **Counted UP here, and that is not an inconsistency with `nextIdentity`.**
 * Nothing the portal serves carries one of these, so there is no `bigserial`
 * to stay clear of; what has to be avoided is only the numbers this same visit
 * has already handed out, and those are all on the list. One past the highest,
 * never the length, for the reason at the top of this file.
 *
 * Read off **everything of that shape that exists**, not only the last one
 * made: deleting one takes it out of the list while the number it held is gone
 * from the count, and taking the highest still says three where counting said
 * two.
 */
export function nextNumber(taken: string[], under: string): number {
  const numbers = taken
    .filter((id) => id.startsWith(under))
    .map((id) => Number(id.slice(under.length)))
    .filter((number) => Number.isInteger(number) && number > 0)

  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1
}
