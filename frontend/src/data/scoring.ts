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

/**
 * The points a result is worth, with nought where the numbers are not a race.
 *
 * The same answer three places wrote out for themselves as `btlPoints(...) ?? 0`:
 * a record keeps a number, and „no points" and „not a race" are the same thing to
 * everything that reads one. `btlPoints` keeps its `null`, because the calculator
 * on the front page has to tell the two apart to know whether to print anything.
 *
 * Written here rather than at each caller since 31.08.2026, when the forms began
 * refusing a race run in no time (`forms/clock.ts`): with that refused and the
 * distance field floored at 0,1 km, the fallback at each caller became a branch
 * nothing can reach, while the question it answers is still a real one for
 * whatever reaches the store by another road.
 */
export function pointsOf(
  lengthKm: number,
  ascentM: number,
  descentM: number,
  seconds: number,
): number {
  return btlPoints(lengthKm, ascentM, descentM, seconds) ?? 0
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
