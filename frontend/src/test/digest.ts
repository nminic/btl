/**
 * A short, stable name for a long string.
 *
 * For the tests that compare two figures a QR code drew: the same figure gives
 * the same digest and any change at all gives another, and a failure reads as
 * six characters rather than as two walls of `M..h1v1h-1z`.
 */
export function digestOf(text: string): string {
  let sum = 0

  for (let at = 0; at < text.length; at += 1) {
    sum = (sum * 31 + text.charCodeAt(at)) % 2176782336
  }

  return sum.toString(36)
}
