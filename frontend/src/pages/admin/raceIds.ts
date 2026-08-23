/**
 * The identity a race entered under an event is handed.
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
 * (`entityForms.ts`, `idFor`); it is written again here because a race is
 * numbered under its event rather than across the portal.
 *
 * Read off **everything that exists**, not only what this visit created: a race
 * that came out of the file is `evt-…-race-3` from the generator and a copy is
 * `…-kopija-1`, and neither is counted by looking at creations alone.
 */
export function nextRaceNumber(taken: string[], event: string): number {
  const under = `${event}-trka-`
  const numbers = taken
    .filter((id) => id.startsWith(under))
    .map((id) => Number(id.slice(under.length)))
    .filter((number) => Number.isInteger(number) && number > 0)

  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1
}
