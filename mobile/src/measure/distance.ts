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
 * 12.4 m/s). A fix that implies more is either a spike or a vehicle. Known limit:
 * a bicycle at 7 m/s passes below it and is not marked.
 */
export const MAX_SPEED_MPS = 12.5;

/** This many implausible fixes in a row are a vehicle, not a spike. */
export const VEHICLE_CONFIRM_FIXES = 3;

/** No good fix for this long is a gap: the fix that ends it is checked against the next one, not against the anchor. */
export const GAP_MS = 10_000;

export type DistanceResult = {
  distanceM: number;
  /** Fixes rejected for their accuracy, or for carrying none. */
  poorFixes: number;
  /** Single implausible fixes (multipath, a jump) that were dropped. */
  spikeFixes: number;
  /**
   * Stretches covered at vehicle speed. Their distance COUNTS, and they are
   * marked for the moderator: „hocu da se svakako racuna, sa napomenom za
   * moderatora da je deonica rizicna ili sta god" (PDL, „Deonica pređena
   * brzinom vozila se RAČUNA, uz napomenu za moderatora").
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
 * straight line from the anchor when it is good, the runner is not standing, and
 * the step is longer than both fixes' error together. A fix that implies a speed
 * no runner reaches is held: alone it is a spike and is dropped, three in a row
 * are a vehicle, whose distance counts from the first of them on, and which is
 * marked. A gap in the signal (tunnel, forest, a service Android killed and
 * started again) is bridged by the straight line from the last anchor, because
 * nothing better is known about it.
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
  /**
   * The time the runner was last known to be where the anchor is: the anchor's own
   * time, or the latest fix at which Doppler said he stood. The speed of a new fix
   * is measured from here, not from the anchor's time. While he stands the anchor
   * does not move, so its time goes stale, and a jump after a long stand would look
   * like a slow, believable walk.
   */
  let anchoredAt = 0;
  /** Sample time of the latest good fix, standing or not. */
  let lastGoodT = 0;
  /** The first fix after a gap, held until the next one says whether it is real. */
  let afterGap: LocationSample | null = null;
  let implausible: LocationSample[] = [];
  let vehicleFrom: number | null = null;
  let vehicleTo = 0;

  /**
   * A plausible fix, or the end of the session: a drive under way ends, and held
   * fixes that never became a drive were spikes.
   */
  const settle = () => {
    if (vehicleFrom === null) {
      result.spikeFixes += implausible.length;
    } else {
      result.vehicleDurationMs += vehicleTo - vehicleFrom;
      vehicleFrom = null;
    }
    implausible = [];
  };

  /**
   * A good fix, with an anchor already set. `released` is a fix that was held after a
   * gap and has now been confirmed by the next one.
   */
  const consider = (fix: LocationSample, released = false) => {
    const current = anchor as LocationSample;
    const accuracy = fix.accuracy as number;
    if (fix.t - lastGoodT > GAP_MS) {
      // After a gap the speed from the anchor says nothing: a minute of running
      // makes any jump look like a slow walk. The next fix decides. This comes
      // before the stand check: a fix of standing after a gap would otherwise move
      // the stand clock to now while the anchor stays before the gap, and the next
      // fix would look like a jump of the whole gap in a second.
      afterGap = fix;
      return;
    }
    const standing = fix.speed !== undefined && fix.speed < STATIONARY_SPEED_MPS;
    if (standing && !released) {
      anchoredAt = fix.t;
      return;
    }

    const stepM = haversineM(current, fix);
    const seconds = (fix.t - anchoredAt) / 1000;
    if (seconds <= 0 || stepM / seconds > MAX_SPEED_MPS) {
      if (vehicleFrom !== null) {
        // A drive under way: every fix counts as it comes.
        if (seconds > 0) {
          result.distanceM += stepM;
          vehicleTo = fix.t;
          anchor = fix;
          anchoredAt = fix.t;
        }
        return;
      }
      implausible.push(fix);
      if (implausible.length >= VEHICLE_CONFIRM_FIXES) {
        result.vehicleSegments += 1;
        vehicleFrom = current.t;
        let from = current;
        for (const held of implausible) {
          result.distanceM += haversineM(from, held);
          from = held;
        }
        anchor = from;
        anchoredAt = from.t;
        vehicleTo = fix.t;
        implausible = [];
      }
      return;
    }

    settle();

    if (stepM < Math.max(MIN_STEP_M, Math.hypot(current.accuracy as number, accuracy))) {
      // A released fix of standing that stayed where the anchor is: he stood here from now on.
      if (standing) anchoredAt = fix.t;
      return;
    }
    result.distanceM += stepM;
    anchor = fix;
    anchoredAt = fix.t;
  };

  for (const fix of bySampleTime(fixes)) {
    if (fix.mock) result.mockFixes += 1;
    result.lastFixT = fix.t;
    result.lastFixPoor = !(fix.accuracy !== undefined && fix.accuracy <= MAX_ACCURACY_M);
    if (result.lastFixPoor) {
      result.poorFixes += 1;
      continue;
    }

    if (anchor === null) {
      anchor = fix;
      anchoredAt = fix.t;
      lastGoodT = fix.t;
      continue;
    }
    if (afterGap !== null) {
      const held: LocationSample = afterGap;
      afterGap = null;
      // Two seconds apart and 80 m between them is no runner; the held fix was a
      // spike. Two fixes at the same instant give a NaN or an infinity, and
      // neither passes, so the held one is dropped then too.
      if (haversineM(held, fix) / ((fix.t - held.t) / 1000) <= MAX_SPEED_MPS) {
        consider(held, true);
      } else {
        result.spikeFixes += 1;
      }
    }
    consider(fix);
    lastGoodT = fix.t;
  }

  if (afterGap !== null) consider(afterGap, true);
  settle();
  return result;
}
