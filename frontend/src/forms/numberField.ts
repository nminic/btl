/* A number is typed the way the person typing it writes one, and sent the way the server
 * reads one. Owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza"): „Polje za
 * broj prima i zarez i tacku, a portal salje tacku." „21,1" is how a length is written here.
 *
 * The two shapes meet in this file and nowhere else, the way the two shapes of a date meet in
 * `dateField.ts`: every reader of a number box asks `parseNumber`, and the one door a form
 * leaves by asks `storedNumber` (`records.ts`, `storedNumbers`).
 */

/**
 * WHAT A NUMBER BOX TAKES: the shape a browser's own number box takes, with the comma beside
 * the dot as the separator of the decimals.
 *
 * <p><b>The browser's shape and not a narrower one, and that is measured rather than
 * preferred.</b> Until 02.10.2026 every number box was `type="number"`, so the browser decided
 * what reached the portal at all. Measured in Chrome that day: „1.5", „.5" and „1e1" stand,
 * while „+5", „5." and „0x10" are emptied. A text box lets everything through, and
 * `Number()` reads „+5", „5." and „0x10" as numbers (sixteen, for the last of them), so without
 * a shape of its own the portal would have started taking what it never took. The comma is the
 * one thing added.
 */
const SHAPE = /^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][-+]?\d+)?$/

/** Digits and nothing else, with a sign where there is one: a whole number as it is written. */
const WHOLE = /^-?\d+$/

/** The number written, or null when what is written is not a number in that shape. */
export function parseNumber(text: string): number | null {
  const written = text.trim()

  if (!SHAPE.test(written)) {
    return null
  }

  /* One comma at most reaches here, because the shape allows one separator. A number too
     large to be one („1e999") is not a number anybody can be told about either. */
  const read = Number(written.replace(',', '.'))

  return Number.isFinite(read) ? read : null
}

/**
 * Whether what is written is a whole number AS WRITTEN: digits, and a sign where there is one.
 *
 * <p>Asked of the writing and not of the value, on purpose. „1.200" metres of climb is the
 * value one point two, and „1,200" is the same value spelt the other way round; both are
 * somebody writing twelve hundred with a separator for the thousands, and read as a value
 * either one is quietly a different climb. Refused as written, the member is stopped on the
 * form and types it again. „10,0" is refused too, which costs nothing: a whole number does not
 * need a fraction to be written.
 */
export function isWhole(text: string): boolean {
  return WHOLE.test(text.trim())
}

/**
 * The same number with the dot the server reads.
 *
 * <p>Called only at the one door a form leaves by, and only for a field the definition calls a
 * number (`records.ts`, `storedNumbers`): what reaches it has been read by `parseNumber` on the
 * way there, so the one comma it may hold is the separator of the decimals.
 */
export function storedNumber(text: string): string {
  return text.replace(',', '.')
}
