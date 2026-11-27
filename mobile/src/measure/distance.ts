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

const standing = (fix: LocationSample) => fix.speed !== undefined && fix.speed < STATIONARY_SPEED_MPS;

/** The shortest step between two fixes that is not jitter: both fixes' error together. */
const stepThresholdM = (a: LocationSample, b: LocationSample) =>
  Math.max(MIN_STEP_M, Math.hypot(a.accuracy as number, b.accuracy as number));

/** Could one runner have been at both fixes? Two fixes at the same instant give a NaN or an infinity, and neither passes. */
const plausible = (a: LocationSample, b: LocationSample) => haversineM(a, b) / ((b.t - a.t) / 1000) <= MAX_SPEED_MPS;

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
   * Where the runner was last known to be (`ref`), and when (`refT`). The speed of
   * a new fix is measured from here, never from the anchor's own time: while he
   * stands the anchor does not move, so its time goes stale, and a jump after a long
   * stand would look like a slow, believable walk. Everywhere but right after a gap
   * `ref` is the anchor and `refT` is the anchor's time or the latest fix at which
   * Doppler said he stood there.
   */
  let ref: LocationSample | null = null;
  let refT = 0;
  /** Sample time of the latest good fix that was taken into the track: not one still held after a gap, and not one dropped. */
  let lastGoodT = 0;
  /**
   * The state „waiting for confirmation after a gap": the fixes since the gap that no
   * fix has confirmed yet, oldest first. Each one but the last was contradicted by the
   * one after it. Empty is the ordinary state.
   */
  let afterGap: LocationSample[] = [];
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

  /** Distance was counted to `fix`: it is the anchor, and the runner was there then. */
  const moveTo = (fix: LocationSample) => {
    anchor = fix;
    ref = fix;
    refT = fix.t;
  };

  /*
   * THE RULE FOR A GAP AND THE FIXES AFTER IT.
   *
   * A gap is more than GAP_MS between a good fix and the latest good fix taken into
   * the track (`lastGoodT`). Poor fixes do not end a gap; they are not there.
   *
   * After a gap the speed from `ref` says nothing, so the first fix after it is not
   * judged by it. It is held, and the next good fix decides: if one runner could
   * have been at both, the held fix is confirmed and every fix held before it was a
   * spike. If not, the next fix is held in its turn and the gap is still open: a
   * fix that was dropped never moves `lastGoodT`, so the fix after it is again the
   * first after the gap and is never measured over the gap. Two fixes at the same
   * instant cannot confirm each other, so the earlier is dropped. When
   * VEHICLE_CONFIRM_FIXES held fixes in a row are each contradicted by the next, they
   * are not spikes but a drive that began after the gap: the oldest is taken as
   * confirmed and the rest go through the ordinary path, which marks the drive. The
   * last held fix of the session is taken as confirmed, since nothing is left to
   * contradict it.
   *
   * A confirmed fix after a gap (`resume`) is never a spike. If one runner could not
   * have covered the gap from `ref` to it, the gap was a vehicle: it counts and is
   * marked at once. Otherwise, a fix that moves is the ordinary step from the anchor,
   * the straight line across the gap. A fix of standing says where he stands now,
   * not what he did in the gap: it becomes `ref` and adds nothing, and the bridge
   * from the anchor waits for his next step (or the end of the session) and is then
   * one straight line.
   *
   * What a fix of standing may do, in short: it moves the stand clock `refT`, and
   * after a gap also `ref`. It never moves the anchor, never adds distance and never
   * ends a drive, before a gap or after one. So a runner who stands adds nothing
   * however sparse his fixes are and however many gaps they leave, except one bridge
   * when the session ends while he stands away from the anchor.
   */

  /** A good fix in the ordinary state, with an anchor already set. */
  const consider = (fix: LocationSample) => {
    lastGoodT = fix.t;
    if (standing(fix)) {
      refT = fix.t;
      return;
    }
    const from = anchor as LocationSample;
    const stepM = haversineM(from, fix);
    const seconds = (fix.t - refT) / 1000;
    if (seconds <= 0 || haversineM(ref as LocationSample, fix) / seconds > MAX_SPEED_MPS) {
      if (vehicleFrom !== null) {
        // A drive under way: every fix counts as it comes.
        if (seconds > 0) {
          result.distanceM += stepM;
          vehicleTo = fix.t;
          moveTo(fix);
        }
        return;
      }
      implausible.push(fix);
      if (implausible.length >= VEHICLE_CONFIRM_FIXES) {
        result.vehicleSegments += 1;
        vehicleFrom = refT;
        let last = from;
        for (const held of implausible) {
          result.distanceM += haversineM(last, held);
          last = held;
        }
        moveTo(last);
        vehicleTo = fix.t;
        implausible = [];
      }
      return;
    }

    settle();

    if (stepM < stepThresholdM(from, fix)) return;
    result.distanceM += stepM;
    moveTo(fix);
  };

  /** A fix after a gap, now confirmed. */
  const resume = (fix: LocationSample) => {
    lastGoodT = fix.t;
    if (!plausible(ref as LocationSample, fix)) {
      // The gap was covered faster than a runner: a vehicle, counted and marked.
      if (vehicleFrom === null) {
        settle();
        result.vehicleSegments += 1;
        vehicleFrom = refT;
      }
      result.distanceM += haversineM(anchor as LocationSample, fix);
      vehicleTo = fix.t;
      moveTo(fix);
      return;
    }
    if (standing(fix)) {
      ref = fix;
      refT = fix.t;
      return;
    }
    consider(fix);
  };

  const take = (fix: LocationSample) => {
    if (anchor === null) {
      moveTo(fix);
      lastGoodT = fix.t;
      return;
    }
    if (afterGap.length === 0) {
      if (fix.t - lastGoodT > GAP_MS) afterGap = [fix];
      else consider(fix);
      return;
    }
    const held = afterGap[afterGap.length - 1];
    if (plausible(held, fix)) {
      result.spikeFixes += afterGap.length - 1;
      afterGap = [];
      resume(held);
      take(fix);
      return;
    }
    if (afterGap.length < VEHICLE_CONFIRM_FIXES) {
      afterGap.push(fix);
      return;
    }
    const [first, ...rest] = afterGap;
    afterGap = [];
    resume(first);
    for (const next of [...rest, fix]) take(next);
  };

  for (const fix of bySampleTime(fixes)) {
    if (fix.mock) result.mockFixes += 1;
    result.lastFixT = fix.t;
    result.lastFixPoor = !(fix.accuracy !== undefined && fix.accuracy <= MAX_ACCURACY_M);
    if (result.lastFixPoor) {
      result.poorFixes += 1;
      continue;
    }
    take(fix);
  }

  if (afterGap.length > 0) {
    result.spikeFixes += afterGap.length - 1;
    resume(afterGap[afterGap.length - 1]);
  }
  if (ref !== anchor) {
    // The session ends while he stands where a gap left him: the bridge to there.
    const from = anchor as unknown as LocationSample;
    const bridgeM = haversineM(from, ref as LocationSample);
    if (bridgeM >= stepThresholdM(from, ref as LocationSample)) result.distanceM += bridgeM;
  }
  settle();
  return result;
}
