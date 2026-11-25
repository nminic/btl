/* The BTL formula, for the calculator on the front page.
 *
 *   Le  = L + (9 * AP + 1 * AN) / 1000   (THIS BRANCH ONLY, 25.11.2026: ascent 9, descent 1)
 *   BTL = 94.80 * (Tref / Tsec)^4 * (Le / 10)^0.35   (THIS BRANCH ONLY, see pointsOf)
 *
 * The same formula lives in the
 * backend (BtlScoreCalculator) and both are held to the same golden set taken
 * from an official race; neither may be changed without the owner saying so.
 *
 * This copy exists because the calculator is a toy that has to answer while you
 * type. Nothing is scored here: a result gets its points from the backend.
 */

/** Length with climb folded in. Ascent counts for more than descent. */
export function effectiveLengthKm(lengthKm: number, ascentM: number, descentM: number): number {
  return lengthKm + (9 * ascentM + 1 * descentM) / 1000
}

/**
 * The points a run is worth, for figures that are a race by construction.
 *
 * <p><b>Every caller hands it figures nothing can make into anything else.</b> What the
 * server answers about a run is a race by the schema: `result_submission_distance_positive`
 * and `result_submission_seconds_positive` (V10) for what the member gave, and
 * `race_only_a_length_race_fixes_a_distance` and `race_only_a_timed_race_has_a_limit` (V7)
 * for what a race of the calendar fixes in their place (`WhatARaceCarries.figuresOf`). „Moji
 * rezultati" draws those, and the form that reports a run from the calendar refuses a time
 * of nought before it works anything out (`forms/clock.ts`).
 *
 * <p><b>It fell back to nought where the numbers were not a race until R2 of the results
 * flows</b>, written here on 31.08.2026 for „whatever reaches the store by another road".
 * That road was the session's own store of runs, where one case approved a run in no
 * time. The store left with R2, so the fallback became a branch no road reached, and the
 * floor of 100 per cent on branches said so. The branch went rather than gaining a case
 * that reaches it by a road production never takes (`btl/CLAUDE.md`, section 23).
 *
 * <p>`btlPoints` keeps the question for the one screen that has to ask it: the calculator
 * on the front page, whose boxes are read as they are typed.
 */
export function pointsOf(
  lengthKm: number,
  ascentM: number,
  descentM: number,
  seconds: number,
): number {
  /* ON THIS BRANCH ONLY (b-formula-b-qa, never merged): the proposal put on QA on 25.11.2026,
     BTL = 94.80 * (Tref / Tsec)^4 * (Le / 10)^0.35, no cap on the length bonus. The same as
     BtlScoreCalculator on this branch. */
  const le = effectiveLengthKm(lengthKm, ascentM, descentM)

  return 94.8 * (referenceSeconds(le) / seconds) ** 4 * (le / 10) ** 0.35
}

const REFERENCE: readonly (readonly [number, number])[] = [
  [5, 755],
  [10, 1571],
  [21.0975, 3450],
  [42.195, 7235],
  [50, 9613],
  [100, 21935],
]

/** The reference time for an effective length: log-log between points of the table, a power of 1.06
 *  below its first point, and the slope of its last two points above its last. */
export function referenceSeconds(le: number): number {
  if (le <= 5) {
    return 755 * (le / 5) ** 1.06
  }
  /* Above 5 km the first point at or beyond the length is never the first of the table; past the
     last point the last two points carry on. */
  const found = REFERENCE.findIndex(([km]) => le <= km)
  const at = found === -1 ? REFERENCE.length - 1 : found
  const lower = REFERENCE[at - 1]
  const higher = REFERENCE[at]
  if (lower === undefined || higher === undefined) {
    return Number.NaN
  }
  const [a, ta] = lower
  const [b, tb] = higher

  return Math.exp(Math.log(ta) + (Math.log(le / a) / Math.log(b / a)) * Math.log(tb / ta))
}

/**
 * Points, or null when the input is not a race: no length, or no time.
 *
 * Every number is asked as „at or above" and none as „below", so that `NaN` is refused by
 * the same sentence as a negative: a comparison against `NaN` is false whichever way it is
 * written, and `ascentM < 0` let a climb that was not a number through to the formula,
 * which answered `NaN` (`forms/clock.ts`, `noTime`, says the same of the time). The
 * calculator on the front page reaches it: its boxes are text and are read as they are
 * typed (`pages/home/Calculator.tsx`).
 */
export function btlPoints(
  lengthKm: number,
  ascentM: number,
  descentM: number,
  seconds: number,
): number | null {
  if (!(lengthKm > 0) || !(seconds > 0) || !(ascentM >= 0) || !(descentM >= 0)) {
    return null
  }

  /* The formula itself is written once, in `pointsOf`, so the golden set this function is
     held to (`scoring.test.ts`) holds the one every screen draws. */
  return pointsOf(lengthKm, ascentM, descentM, seconds)
}
