/* The BTL formula, for the calculator on the front page and for what a member is told
 * before the server has counted a run.
 *
 *   a race of a length:  BTL = 55.75 * (Tref(Le) / Tsec)^2.75 * (Le / 10)^0.39
 *   a race to a limit:   BTL = 58.71 * (Le / Lref(Tsec))^2.86 * (Le / 10)^0.39
 *   Le  = L + (5 * AP + 2 * AN) / 1000
 *
 * Chosen by the owner on 27.11.2026 (PDL P4, „Izabrana varijanta V3c”, and then „Napisi i
 * podigni”). `Tref` is one smooth curve of the reference time for the length `Le`
 * (`referenceSeconds`), `Lref` the same curve read the other way (`referenceKm`). The same
 * formula lives in the backend (BtlScoreCalculator) and both are held to the same golden
 * set, worked out independently in Python; neither may be changed without the owner saying so.
 *
 * This copy exists because the calculator is a toy that has to answer while you
 * type. Nothing is scored here: a result gets its points from the backend.
 */

import type { RaceKind } from './types'

/** Length with climb folded in. Ascent counts for more than descent, and descent still adds. */
export function effectiveLengthKm(lengthKm: number, ascentM: number, descentM: number): number {
  return lengthKm + (5 * ascentM + 2 * descentM) / 1000
}

/** The curve above 5 km: `ln Tref = A x^2 + B x + C`, `x = ln(Le in km)`, a least-squares curve
 *  through the six records of the league, and it holds above 100 km too. */
const A = 0.04766
const B = 0.82303
const C = 5.18994

/** Where the curve is cut over, and its value and its slope there. Below 5 km it keeps the slope
 *  of the curve AT 5 km, worked out and not the 0.976 the decision prints rounded, so the two
 *  pieces meet without a corner, and bends away from it by `BELOW_FIVE_BEND`. */
const X_AT_FIVE = Math.log(5)
const LN_TREF_AT_FIVE = A * X_AT_FIVE * X_AT_FIVE + B * X_AT_FIVE + C
const SLOPE_AT_FIVE = 2 * A * X_AT_FIVE + B
const BELOW_FIVE_BEND = -0.14

/**
 * The reference time for an effective length, in seconds: the quadratic curve in the logarithm
 * at or above 5 km, and below it the curve that leaves 5 km along the same tangent and bends
 * away. The same as `BtlScoreCalculator.referenceSeconds`.
 */
function referenceSeconds(le: number): number {
  const x = Math.log(le)

  if (x >= X_AT_FIVE) {
    return Math.exp(A * x * x + B * x + C)
  }

  const below = x - X_AT_FIVE

  return Math.exp(LN_TREF_AT_FIVE + SLOPE_AT_FIVE * below + BELOW_FIVE_BEND * below * below)
}

/**
 * The reference length for a time, in kilometres: the length whose `referenceSeconds` is the
 * time, by bisection on the logarithm of the length, as `BtlScoreCalculator.referenceKm`.
 */
function referenceKm(seconds: number): number {
  let low = 1e-4
  let high = 1e5

  for (let round = 0; round < 200; round++) {
    const middle = Math.sqrt(low * high)

    if (referenceSeconds(middle) < seconds) {
      low = middle
    } else {
      high = middle
    }
  }

  return Math.sqrt(low * high)
}

/**
 * The points a run is worth, for figures that are a race by construction, by the formula of the
 * kind of race it was run at (`kind`: a timed race is counted against its limit, which the
 * caller hands as the seconds).
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
  kind: RaceKind,
): number {
  const le = effectiveLengthKm(lengthKm, ascentM, descentM)

  /* A race to a limit has its own formula, and the kind is asked of the caller that holds the
     race, so none can leave it out and be counted as a race of a length by accident. Any kind
     but a timed one is counted by the length's, a free race included, as the backend does
     (`PointsOfARun.of`). */
  if (kind === 'time') {
    return 58.71 * (le / referenceKm(seconds)) ** 2.86 * (le / 10) ** 0.39
  }

  return 55.75 * (referenceSeconds(le) / seconds) ** 2.75 * (le / 10) ** 0.39
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
     held to (`scoring.test.ts`) holds the one every screen draws. The calculator asks about a
     race of a length: it has no box for a limit. */
  return pointsOf(lengthKm, ascentM, descentM, seconds, 'length')
}
