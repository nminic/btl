/**
 * WHAT A SCREEN DOES WITH AN ANSWER OF `PlaceField`: the town and the country as they now stand, and,
 * where the field says so, the country it wrote because the name was recognised.
 *
 * <p>Two screens draw the field only while no event of the calendar is chosen and keep the town and the
 * country in their own state while it is away (`pages/event/eventAndRace.ts`,
 * `pages/admin/placingTheRace.ts`). What the field remembers of its own writing is gone with the field,
 * so it is kept beside the town and the country, in the same update: a note kept in the field would be
 * lost when the field is, and the country would then stay under a name that has stopped being a place
 * (review of PR 610, owner, 20.10.2026: „Čim ukucano ime mesta prestane da odgovara šifarniku, država
 * koju je prepoznavanje upisalo se prazni i čeka izbor").
 *
 * <p>`wrote` is `undefined` when the answer does not touch the note (somebody typed, or chose a
 * country), a country when the field has just written it, and `null` when the note is spent. One home
 * for the question so that the two screens cannot answer it differently.
 */
export type TheKeptPlace = { city: string; country: string; countryWrote: string | null }

export function withThePlace<T extends TheKeptPlace>(
  now: T,
  city: string,
  country: string,
  wrote?: string | null,
): T {
  return { ...now, city, country, ...(wrote === undefined ? {} : { countryWrote: wrote }) }
}
