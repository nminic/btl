import { MAX_ACCURACY_M, STATIONARY_SPEED_MPS } from './distance';
import type { LocationSample, PressureSample } from './recording';

/*
 * Ascent and descent come from the barometer and never from GPS altitude. On a
 * phone without a pressure sensor they are not measured at all and the app says
 * so (PDL, „Na telefonu bez senzora pritiska aplikacija prikaže da senzora
 * nema"). GPS altitude errs by tens of metres, and a metre of ascent is worth 9 m
 * of length (PDL P4, `Le = L + (9 × AP + 1 × AN) / 1000`).
 *
 * The thresholds are my reasoning and wait for calibration on a climb of known
 * height (plan-mobilna-aplikacija.md, „Kako se meri preciznost").
 */

/**
 * A climb or a drop counts only once it is this tall, and then counts whole.
 * Above what the sensor and pocket transients do in a few seconds (tenths of a
 * metre after averaging, a metre for a gust or a door), and small enough that
 * little real terrain is lost.
 */
export const ELEVATION_HYSTERESIS_M = 2;

/** Pressure is averaged into buckets of this length, by sample time. */
export const BUCKET_MS = 1000;

/** The vertical rate is the change of altitude over this window. */
export const CLIMB_RATE_WINDOW_MS = 30_000;

/**
 * Slower than this, a change of altitude while standing is the weather. Weather
 * moves pressure by about 1 hPa an hour at its fastest, which is about 8 m an hour
 * or 0.0023 m/s; this is nine times that, and far below any climb on foot (a
 * steep climb at 0.3 m/s horizontally rises at about 0.1 m/s).
 */
export const MIN_CLIMB_RATE_MPS = 0.02;

/** A fix older than this says nothing about whether the runner is standing now. */
export const FIX_FRESH_MS = 5000;

/** The standard atmosphere, as Android's `SensorManager.getAltitude` uses it. */
export const SEA_LEVEL_HPA = 1013.25;

export function pressureToAltitudeM(hPa: number): number {
  return 44330 * (1 - Math.pow(hPa / SEA_LEVEL_HPA, 1 / 5.255));
}

export type ElevationResult =
  | { status: 'noPressureSensor' }
  | { status: 'measured'; ascentM: number; descentM: number };

type Point = { t: number; altitudeM: number };

function buckets(pressures: readonly PressureSample[]): Point[] {
  const groups = new Map<number, { t: number; hPa: number; n: number }>();
  for (const sample of pressures) {
    const key = Math.floor(sample.t / BUCKET_MS);
    const group = groups.get(key) ?? { t: 0, hPa: 0, n: 0 };
    group.t += sample.t;
    group.hPa += sample.hPa;
    group.n += 1;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, g]) => ({ t: g.t / g.n, altitudeM: pressureToAltitudeM(g.hPa / g.n) }));
}

/** Whether the latest good fix at or before `t` is fresh and says, by Doppler, that the runner stands. */
function standingAt(goodFixes: readonly LocationSample[], t: number): boolean {
  let lo = 0;
  let hi = goodFixes.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (goodFixes[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return false;
  const fix = goodFixes[found];
  return t - fix.t <= FIX_FRESH_MS && fix.speed !== undefined && fix.speed < STATIONARY_SPEED_MPS;
}

/**
 * Ascent and descent by hysteresis over the averaged barometric altitude.
 *
 * Standing is the case where the weather would be counted as climbing: the
 * pressure drifts while the runner does not move. A change is put down to the
 * weather only when BOTH hold: Doppler says the runner stands, and the altitude
 * changes slower than a climb on foot. Doppler alone would swallow a steep climb,
 * which is slower than walking horizontally; the rate alone would swallow a gentle
 * gradient run fast. With no fresh fix (a tunnel, before the first fix) the runner
 * counts as moving: the barometer is the primary sensor and a lost GPS signal is
 * where a real climb would otherwise be lost.
 */
export function measureElevation(
  pressureSensor: boolean,
  pressures: readonly PressureSample[],
  fixes: readonly LocationSample[],
): ElevationResult {
  if (!pressureSensor) return { status: 'noPressureSensor' };

  const goodFixes = fixes
    .filter((f) => f.accuracy !== undefined && f.accuracy <= MAX_ACCURACY_M)
    .sort((a, b) => a.t - b.t);
  const points = buckets(pressures);

  let ascentM = 0;
  let descentM = 0;
  let direction: 'up' | 'down' | null = null;
  let base = 0;
  let extreme = 0;
  let windowStart = 0;

  const bank = () => {
    if (direction === 'up') ascentM += extreme - base;
    if (direction === 'down') descentM += base - extreme;
  };

  points.forEach((point, i) => {
    const a = point.altitudeM;
    if (i === 0) {
      base = a;
      return;
    }
    while (windowStart + 1 < i && points[windowStart + 1].t <= point.t - CLIMB_RATE_WINDOW_MS) windowStart += 1;
    const from = points[windowStart];
    const rate = Math.abs(a - from.altitudeM) / ((point.t - from.t) / 1000);

    if (standingAt(goodFixes, point.t) && rate < MIN_CLIMB_RATE_MPS) {
      bank();
      direction = null;
      base = a;
      return;
    }

    if (direction === null) {
      if (a - base >= ELEVATION_HYSTERESIS_M) direction = 'up';
      else if (base - a >= ELEVATION_HYSTERESIS_M) direction = 'down';
      extreme = a;
    } else if (direction === 'up') {
      if (a > extreme) {
        extreme = a;
      } else if (extreme - a >= ELEVATION_HYSTERESIS_M) {
        ascentM += extreme - base;
        base = extreme;
        direction = 'down';
        extreme = a;
      }
    } else if (a < extreme) {
      extreme = a;
    } else if (a - extreme >= ELEVATION_HYSTERESIS_M) {
      descentM += base - extreme;
      base = extreme;
      direction = 'up';
      extreme = a;
    }
  });
  bank();

  return { status: 'measured', ascentM, descentM };
}
