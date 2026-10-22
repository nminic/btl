import type { Suggestion } from './types'

/**
 * THE ONE ENTRY OF A LIST A NAME TYPED EXACTLY NAMES, or nothing.
 *
 * <p>PDL P9, owner, 19.10.2026 (he chose the coordinator's recommendation): „Tačno otkucan naziv
 * postojećeg događaja vezuje taj događaj i bez klika, bez obzira na velika i mala slova, kao da je
 * izabran predlog”. Exactly is the whole name, letter for letter in any case, and nothing more: a
 * name that only begins an entry names none. <b>Two entries of one name are neither</b> (the
 * coordinator's derivation, not the owner's decision: PDL „[IZVEDENO 19.10.2026, moje, PR za 7b]”):
 * between midnight and ten on 1 January two seasons are open and a name may stand in both, and
 * on the moderator's screen, which offers an event of every year (owner, 21.10.2026), a name may stand
 * in any two; choosing one of them is the reader's, not a guess's.
 *
 * <p>One home for the rule, read by the form (`FormRenderer`, `linksWhenTyped`) and by the
 * moderator's panel over a run (`admin/placingTheRace.ts`), which share the block of an event and
 * its race (the coordinator's answer Q5 C of 7a).
 */
export function theOneNamedExactly(list: readonly Suggestion[], typed: string): Suggestion | undefined {
  const named = everyOneNamedExactly(list, typed)

  return named.length === 1 ? named[0] : undefined
}

/**
 * EVERY ENTRY OF A LIST A NAME TYPED EXACTLY NAMES, in the list's own order: the same comparison as
 * {@link theOneNamedExactly}, kept here so the two cannot compare differently.
 *
 * <p>Read where one name stands for several entries: the list under a box offers every one of them
 * however many there are (`forms/Suggesting.tsx`), and the moderator's screen holds its save until one of
 * them is chosen where the day typed is in the year of one of them (`pages/event/eventAndRace.ts`). Both
 * are the owner's decision of 22.10.2026 (PDL „Predlozi događaja pri upisu rezultata: ime pa godina” and
 * its answers of the same day).
 */
export function everyOneNamedExactly(list: readonly Suggestion[], typed: string): Suggestion[] {
  return list.filter((one) => one.value.toLocaleLowerCase() === typed.toLocaleLowerCase())
}
