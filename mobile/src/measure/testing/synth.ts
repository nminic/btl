import { EARTH_RADIUS_M } from '../geo';
import { SEA_LEVEL_HPA } from '../elevation';
import type { LocationSample, PressureSample } from '../recording';

/** Where the synthetic runs take place. Any point would do; this one is in Belgrade. */
export const ORIGIN = { lat: 44.8, lon: 20.46 };

/** A point `eastM` and `northM` metres from the origin. */
export function offset(eastM: number, northM: number): { lat: number; lon: number } {
  const lat = ORIGIN.lat + (northM / EARTH_RADIUS_M) * (180 / Math.PI);
  const lon = ORIGIN.lon + (eastM / (EARTH_RADIUS_M * Math.cos((ORIGIN.lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat, lon };
}

export function fix(
  t: number,
  eastM: number,
  northM: number,
  extra: Partial<Omit<LocationSample, 'lat' | 'lon' | 't'>> = {},
): LocationSample {
  return { t, ...offset(eastM, northM), accuracy: 4, speed: 3, mock: false, receivedAt: t, ...extra };
}

/** The pressure at which `pressureToAltitudeM` gives `altitudeM`. */
export function hPaAt(altitudeM: number): number {
  return SEA_LEVEL_HPA * Math.pow(1 - altitudeM / 44330, 5.255);
}

export function pressure(t: number, altitudeM: number, receivedAt = t): PressureSample {
  return { t, hPa: hPaAt(altitudeM), receivedAt };
}

/** A deterministic sequence in [-1, 1), so that a jitter case fails the same way every run. */
export function jitter(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 2 ** 32) * 2 - 1;
  };
}

/** Samples at `hz` per second over `[fromMs, toMs)`. */
export function every(fromMs: number, toMs: number, hz: number): number[] {
  const out: number[] = [];
  for (let t = fromMs; t < toMs; t += 1000 / hz) out.push(t);
  return out;
}
