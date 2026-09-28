import { at } from './at'

/**
 * How far apart two colours are, by the measure WCAG uses.
 *
 * **Lifted out of `styles/goldBand.test.ts` on 28.09.2026, unchanged**, when a
 * second guard came to need it (`forms/choiceControl.test.ts`, over the two
 * states of a button that answers a question). Written out a second time it
 * would have been a second home for a formula, and the portal has paid for that
 * shape before: `src/test/stylesheet.ts` says so at its head, about a helper
 * rewritten from memory without the part an incident had taught.
 *
 * **Its tests stayed where they were**, in „the ink on the gold band", which
 * holds four known ratios to two decimals. They are not moved here for the
 * reason that file gives about its own helpers: they were written against that
 * guard's colours, and a test that moves house stops being read beside what it
 * measures.
 */

/** WCAG relative luminance of an `#rrggbb` colour. */
export function luminance(hex: string): number {
  const linear = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))

  return 0.2126 * at(linear, 0) + 0.7152 * at(linear, 1) + 0.0722 * at(linear, 2)
}

/** The ratio between two colours, lighter over darker, as WCAG 2.2 counts it. */
export function contrast(one: string, other: string): number {
  const sorted = [luminance(one), luminance(other)].sort((left, right) => right - left)

  return (at(sorted, 0) + 0.05) / (at(sorted, 1) + 0.05)
}
