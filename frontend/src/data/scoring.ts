/* The BTL formula, for the calculator on the front page.
 *
 *   Le  = L + (9 * AP + 1 * AN) / 1000
 *   BTL = 103.34 * (Tref / Tsec)^4.25 * (Le / 10)^0.39
 *
 * Decided by the owner on 26.11.2026 (PDL P4, „Nova formula bodova, na produkciju”):
 * „Uradi 0.39 i 4.25 i podigni sve i na produkciju”. `Tref` is the reference time for
 * the length `Le` (`referenceSeconds`). The same formula lives in the backend
 * (BtlScoreCalculator) and both are held to the same golden set, worked out
 * independently in Python; neither may be changed without the owner saying so.
 *
 * This copy exists because the calculator is a toy that has to answer while you
 * type. Nothing is scored here: a result gets its points from the backend.
 */

/** Length with climb folded in. Ascent counts for more than descent, and descent still adds. */
export function effectiveLengthKm(lengthKm: number, ascentM: number, descentM: number): number {
  return lengthKm + (9 * ascentM + 1 * descentM) / 1000
}

/** A stretch of the reference table: from a length and its reference time to the next. */
type Stretch = readonly [fromKm: number, fromSeconds: number, toKm: number, toSeconds: number]

/** The last stretch of the table, which also carries on beyond it, past 100 km. */
const BEYOND: Stretch = [50, 9613, 100, 21935]

/** The reference table (5 km 755 s, 10 km 1571 s, 21.0975 km 3450 s, 42.195 km 7235 s,
 *  50 km 9613 s, 100 km 21935 s), as the stretches between its points. */
const STRETCHES: readonly Stretch[] = [
  [5, 755, 10, 1571],
  [10, 1571, 21.0975, 3450],
  [21.0975, 3450, 42.195, 7235],
  [42.195, 7235, 50, 9613],
  BEYOND,
]

/**
 * The reference time for an effective length, in seconds: `755 * (Le/5)^1.06` at or below
 * the first point of the table, log-log between the two points around it, and the line
 * through the last two points beyond the last one. The same as
 * `BtlScoreCalculator.referenceSeconds`.
 */
function referenceSeconds(le: number): number {
  if (le <= 5) {
    return 755 * (le / 5) ** 1.06
  }
  const [a, ta, b, tb] = STRETCHES.find(([, , toKm]) => le <= toKm) ?? BEYOND

  return Math.exp(Math.log(ta) + (Math.log(le / a) / Math.log(b / a)) * Math.log(tb / ta))
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
  const le = effectiveLengthKm(lengthKm, ascentM, descentM)

  return 103.34 * (referenceSeconds(le) / seconds) ** 4.25 * (le / 10) ** 0.39
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
