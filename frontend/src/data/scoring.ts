/* The BTL formula, for the calculator on the front page.
 *
 *   Le  = L + (1.25 * AP + 0.75 * AN) / 200
 *   BTL = (40 * Le)^3.257 / (2 * Tsec^2.137)
 *
 * The exponent 2.137 applies to the time alone. The same formula lives in the
 * backend (BtlScoreCalculator) and both are held to the same golden set taken
 * from an official race; neither may be changed without the owner saying so.
 *
 * This copy exists because the calculator is a toy that has to answer while you
 * type. Nothing is scored here: a result gets its points from the backend.
 */

/** Length with climb folded in. Ascent counts for more than descent. */
export function effectiveLengthKm(lengthKm: number, ascentM: number, descentM: number): number {
  return lengthKm + (1.25 * ascentM + 0.75 * descentM) / 200
}

/** Points, or null when the input is not a race: no length, or no time. */
export function btlPoints(
  lengthKm: number,
  ascentM: number,
  descentM: number,
  seconds: number,
): number | null {
  if (!(lengthKm > 0) || !(seconds > 0) || ascentM < 0 || descentM < 0) {
    return null
  }

  const effective = effectiveLengthKm(lengthKm, ascentM, descentM)

  return (40 * effective) ** 3.257 / (2 * seconds ** 2.137)
}
