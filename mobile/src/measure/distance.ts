import { haversineM } from './geo';
import type { LocationSample } from './recording';

/*
 * Every threshold below is my reasoning, not a decision, and every one waits to
 * be calibrated on a 400 m track and against a Garmin recording of the same run
 * (plan-mobilna-aplikacija.md, „Kako se meri preciznost").
 */

/** A fix whose reported horizontal accuracy is worse than this is not used at all. */
export const MAX_ACCURACY_M = 20;

/**
 * Below this Doppler speed the runner is standing. Doppler speed comes from the
 * carrier frequency, not from positions, so it stays near zero while the position
 * wanders by metres around a standing runner.
 */
export const STATIONARY_SPEED_MPS = 0.5;

/** The shortest step that counts, so that jitter between two good fixes does not add up. */
export const MIN_STEP_M = 5;

/**
 * Faster than this is not running: just above the fastest human sprint (about
 * 12.4 m/s). Known limit: a bicycle at 7 m/s passes below it.
 */
export const MAX_SPEED_MPS = 12.5;

/** This many implausible fixes in a row are a vehicle, not a spike. */
export const VEHICLE_CONFIRM_FIXES = 3;

export type DistanceResult = {
  distanceM: number;
  /** Fixes rejected for their accuracy, or for carrying none. */
  poorFixes: number;
  /** Single implausible fixes (multipath, a jump) that were dropped. */
  spikeFixes: number;
  /**
   * Stretches covered at vehicle speed. They add no distance, and they are
   * exposed rather than silently dropped: a suspicious result gets a mark that a
   * moderator reviews (PDL, „Sumnjiv rezultat (brzina vozila, lažna lokacija)
   * dobija oznaku").
   */
  vehicleSegments: number;
  vehicleDurationMs: number;
  /** Fixes Android marked as coming from a mock location provider. Counted, not dropped, for the same reason. */
  mockFixes: number;
  /** Sample time of the latest fix of any quality, and whether it was poor. */
  lastFixT: number | null;
  lastFixPoor: boolean;
};

function bySampleTime(fixes: readonly LocationSample[]): LocationSample[] {
  return [...fixes].sort((a, b) => a.t - b.t);
}

/**
 * Horizontal distance from the raw fixes.
 *
 * An anchor is the last fix that distance was counted to. A new fix adds the
 * straight line from the anchor only when it is good, the runner is not standing,
 * the implied speed is plausible, and the step is longer than both fixes' error
 * together. A gap in the signal (tunnel, forest) is bridged by the straight line
 * from the last anchor, because nothing better is known about it.
 */
export function measureDistance(fixes: readonly LocationSample[]): DistanceResult {
  const result: DistanceResult = {
    distanceM: 0,
    poorFixes: 0,
    spikeFixes: 0,
    vehicleSegments: 0,
    vehicleDurationMs: 0,
    mockFixes: 0,
    lastFixT: null,
    lastFixPoor: false,
  };

  let anchor: LocationSample | null = null;
  let implausible: LocationSample[] = [];
  let vehicleFrom: number | null = null;
  let vehicleTo = 0;

  /**
   * Implausible fixes not yet confirmed as a vehicle end either way: as the tail
   * of a vehicle stretch that is under way, or as spikes.
   */
  const settle = () => {
    if (vehicleFrom === null) {
      result.spikeFixes += implausible.length;
    } else {
      if (implausible.length > 0) vehicleTo = implausible[implausible.length - 1].t;
      result.vehicleDurationMs += vehicleTo - vehicleFrom;
      vehicleFrom = null;
    }
    implausible = [];
  };

  for (const fix of bySampleTime(fixes)) {
    if (fix.mock) result.mockFixes += 1;
    result.lastFixT = fix.t;
    result.lastFixPoor = !(fix.accuracy !== undefined && fix.accuracy <= MAX_ACCURACY_M);
    if (result.lastFixPoor) {
      result.poorFixes += 1;
      continue;
    }
    const accuracy = fix.accuracy as number;

    if (anchor === null) {
      anchor = fix;
      continue;
    }
    if (fix.speed !== undefined && fix.speed < STATIONARY_SPEED_MPS) continue;

    const stepM = haversineM(anchor, fix);
    const seconds = (fix.t - anchor.t) / 1000;
    if (seconds <= 0 || stepM / seconds > MAX_SPEED_MPS) {
      implausible.push(fix);
      if (implausible.length >= VEHICLE_CONFIRM_FIXES) {
        if (vehicleFrom === null) {
          result.vehicleSegments += 1;
          vehicleFrom = anchor.t;
        }
        vehicleTo = fix.t;
        anchor = fix;
        implausible = [];
      }
      continue;
    }

    settle();

    if (stepM < Math.max(MIN_STEP_M, Math.hypot(anchor.accuracy as number, accuracy))) continue;
    result.distanceM += stepM;
    anchor = fix;
  }

  settle();
  return result;
}
