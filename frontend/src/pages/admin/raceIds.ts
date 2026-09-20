/**
 * The identity a record numbered under another one is handed.
 *
 * Counted up from the **highest** number already used, never from how many there
 * are. The count goes back down and the numbers do not: enter two races, delete
 * the first, enter a third, and a count hands the third the number the second
 * holds. Two records then answer to one id, the table draws them under one key,
 * a lookup finds only the first, and an edit to either reaches both.
 *
 * Measured on 23.08.2026, on the real screen: `E-trka-1` and `E-trka-2` saved,
 * `E-trka-1` deleted, a third race entered, and it came out as `E-trka-2` again.
 * React said so out loud („two children with the same key") and the third race
 * was not on the screen at all.
 *
 * The same rule the whole numbering module keeps for every other entity
 * (`entityForms.ts`, `idFor`); it is written again here because these are numbered
 * **under another record** rather than across the portal: a race under its event,
 * and a copy of an event under the event it came out of. Both counted rather than
 * measured until 23.08.2026, and the copy went on doing it after the race was put
 * right, which is why the rule now has one home and two callers.
 *
 * Read off **everything that exists**, not only what this visit created: a race
 * that came out of the file is `evt-…-race-3` from the generator and a copy is
 * `…-kopija-1`, and neither is counted by looking at creations alone.
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

export function nextNumber(taken: string[], under: string): number {
  const numbers = taken
    .filter((id) => id.startsWith(under))
    .map((id) => Number(id.slice(under.length)))
    .filter((number) => Number.isInteger(number) && number > 0)

  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1
}
