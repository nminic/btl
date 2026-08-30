import { RACE_KINDS, type RaceKind } from './types'

/**
 * A word read as one of the three kinds a race can be, or as a race of a length
 * where it is none of them.
 *
 * The one home for that reading (ADL A31). `Race.kind` is typed as `RaceKind`, but
 * the type is a promise the data does not keep: a race arrives out of a JSON file
 * that nothing between the disk and the screen checks, and a record kept in the
 * store holds every value as text (`session/context.ts`). Tomorrow the same records
 * arrive from a backend or an import.
 *
 * A race of a length, because that is what every race was before the field existed
 * and what every race in the file still is, so an unknown word is read as the thing
 * it would have been read as anyway.
 *
 * **Why this is not left to the type.** Somewhere the word chooses between things
 * that are written down one per kind: a form, a sentence, a rule about what is
 * asked. A lookup into any of those with a word that is not there gives `undefined`,
 * and `undefined` handed to a translator or to a renderer throws where a screen was
 * expected. Measured on 30.08.2026: a race carrying „ludilo" took the form for
 * reporting a result down to the error boundary, on a screen that had drawn it
 * perfectly well the day before.
 */
export function raceKind(said: string): RaceKind {
  return RACE_KINDS.find((known) => known === said) ?? 'length'
}
