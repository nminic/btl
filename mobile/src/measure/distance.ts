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

/**
 * Faster than this is no vehicle on a road either (250 km/h): a step like that is a
 * jump of the position, and a drive is never made of it unless nothing else is left.
 */
export const MAX_VEHICLE_SPEED_MPS = 70;

/** The hardest a runner or a car speeds up or slows down, in m/s per second (a sprint start, or 0 to 100 km/h in 7 s). */
export const MAX_ACCELERATION_MPS2 = 4;

/** How far a Doppler speed can be off. */
export const DOPPLER_ERROR_MPS = 1;

/** This many fixes in a row reached at vehicle speed are a drive; fewer, with the track believable without them, are spikes. */
export const VEHICLE_CONFIRM_FIXES = 3;

/**
 * A fix is judged against the fixes up to this many places before it, so a burst of
 * up to one fewer spikes in a row can be stepped over, and a trip away (below) can be
 * that long. A longer burst is a stated limit.
 */
export const LOOK_BACK_FIXES = 20;

/**
 * No good fix for this long is a gap. A drive may begin across it at little cost (see
 * GAP_DRIVE_START_COST), and two fixes of standing on either side of it may be two
 * places, since he could have walked away in between without a fix saying so.
 */
export const GAP_MS = 10_000;

/**
 * A gap this long on both sides of a few fixes hides a way there and a way back long
 * enough to walk, so those fixes are a place he went to and not a trip of spikes,
 * however far off they are. A spike burst comes and goes within seconds of real fixes.
 */
export const LONG_GAP_MS = 30_000;

export type DistanceResult = {
  distanceM: number;
  /** Fixes rejected for their accuracy, or for carrying none. */
  poorFixes: number;
  /** Fixes dropped because the track is believable without them (multipath, a jump). */
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

/*
 * THE SHAPE.
 *
 * The app reads the whole file every time, so a fix is judged by the fixes on BOTH
 * sides of it, not only by those before it. There are two passes.
 *
 * 1. WHICH FIXES ARE REAL (`chooseFixes`). First out go the trips away that come
 *    back (`excursions`), which no track can hold. Then, of all the ways to walk through the rest in order, skipping some, the
 *    cheapest is taken (`cheapestWalk`). Skipping a fix costs 1. A step a runner can
 *    make costs nothing. A step at vehicle speed is allowed only in a drive, which
 *    costs VEHICLE_CONFIRM_FIXES - 0.5 to begin and 0.4 more to end, so three such
 *    fixes in a row are a drive, whether the track comes back after them or not, and
 *    fewer are spikes when the track is believable without them. A step that the two fixes' own Doppler speeds cannot
 *    explain is a jump of the position, never a drive. So a fix is a spike wherever
 *    it is: in the middle of a run, as the first fix of the session, right after a
 *    gap, in a burst, or with a Doppler speed of standing. A real drive is never
 *    skipped, because skipping its fixes leaves the track as fast as it was. A gap is
 *    not a state of its own: it is a longer step between two fixes.
 *
 * 2. HOW FAR (`measure`). Distance is the straight line from fix to chosen fix in
 *    order. A step shorter than both fixes' error together does not count, so jitter
 *    does not add up. A stand (fixes whose Doppler says he stands) is one point of the
 *    track, the middle of its fixes, however many fixes and gaps it holds, and the
 *    track goes through it: „Preciznost mi je izuzetno bitna." So a runner who stands
 *    adds nothing, and a runner who stood somewhere between two gaps is measured
 *    through that place. In a drive every fix reached at vehicle speed counts as it
 *    comes; a fix of standing (a car at a light) neither adds nor ends the drive.
 *
 * The price of looking ahead: the last fixes of a session that is still running may
 * be judged again when the next ones come, so the distance shown may move back by a
 * spike's worth a second later. At the end of the session the last fixes are taken as
 * they are, since nothing is left to say otherwise.
 */

const RUN = 0;
const DRIVE = 1;
type Mode = typeof RUN | typeof DRIVE;

const SKIP_COST = 1;
const DRIVE_START_COST = VEHICLE_CONFIRM_FIXES - 0.5;
const DRIVE_END_COST = 0.4;
/**
 * A drive that begins across a gap costs little. What it is weighed against is skipping
 * every fix on one side of the gap, and at the start or the end of a session that side
 * may hold only one or two real fixes. A spike after a gap gains nothing from this: the
 * step that leaves it is no gap.
 */
const GAP_DRIVE_START_COST = 0.5;
/** A step faster than any vehicle, taken only when skipping is dearer: more than every fix the look-back can skip. */
const JUMP_COST = LOOK_BACK_FIXES;
/** Of two ways equal in everything else, the shorter: spikes only ever lengthen a track. */
const LENGTH_COST_PER_M = 1e-7;

type Step = 'run' | 'fast' | 'jump';

const standing = (fix: LocationSample) => fix.speed !== undefined && fix.speed < STATIONARY_SPEED_MPS;

/** The shortest step between two fixes that is not jitter: both fixes' error together. */
const stepThresholdM = (a: LocationSample, b: LocationSample) =>
  Math.max(MIN_STEP_M, Math.hypot(a.accuracy as number, b.accuracy as number));

/**
 * The good fixes of one session, with their places in metres east and north of the
 * first one, so that the many comparisons below are a square root each. Over the few
 * kilometres of a session the flat map errs by far less than GPS does; the distance
 * itself is still measured on the sphere.
 */
class Track {
  readonly fixes: readonly LocationSample[];
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Where each of the fixes stood among the good fixes of the session, before any was taken out. */
  readonly source: readonly number[];
  /** The good fixes of the session, as they came. */
  readonly original: readonly LocationSample[];

  constructor(fixes: readonly LocationSample[], source: readonly number[] = fixes.map((_, i) => i), original: readonly LocationSample[] = fixes) {
    this.fixes = fixes;
    this.source = source;
    this.original = original;
    const n = fixes.length;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    const lat0 = fixes[0].lat;
    const lon0 = fixes[0].lon;
    const metresPerDegree = haversineM({ lat: lat0, lon: lon0 }, { lat: lat0 + 1, lon: lon0 });
    const cos0 = Math.cos((lat0 * Math.PI) / 180);
    for (let i = 0; i < n; i += 1) {
      this.y[i] = (fixes[i].lat - lat0) * metresPerDegree;
      this.x[i] = (fixes[i].lon - lon0) * metresPerDegree * cos0;
    }
  }

  apartM(i: number, j: number): number {
    const dx = this.x[j] - this.x[i];
    const dy = this.y[j] - this.y[i];
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * What kind of step leads from fix `i` to fix `j`, or none for two fixes at the same
   * instant. Between two fixes of standing the position may wander by both errors
   * together without him moving, so only what is beyond that is speed.
   */
  step(i: number, j: number): Step | null {
    const a = this.fixes[i];
    const b = this.fixes[j];
    const seconds = (b.t - a.t) / 1000;
    if (seconds <= 0) return null;
    const wander = standing(a) && standing(b) ? Math.hypot(a.accuracy as number, b.accuracy as number) : 0;
    const apart = this.apartM(i, j);
    const speed = Math.max(0, apart - wander) / seconds;
    if (speed <= MAX_SPEED_MPS) return 'run';
    if (speed > MAX_VEHICLE_SPEED_MPS) return 'jump';
    // Doppler speed comes from the carrier, not from the positions. Between two fixes whose Doppler speeds are known,
    // the fastest way is to speed up from the faster of them and slow back down to it: an average of at most a
    // quarter of the time times the acceleration above it. A step beyond that, even with both errors taken off, is a
    // position that is wrong and not a drive.
    const doppler = Math.max(a.speed ?? Infinity, b.speed ?? Infinity);
    const least = (apart - (a.accuracy as number) - (b.accuracy as number)) / seconds;
    return least > doppler + (MAX_ACCELERATION_MPS2 * seconds) / 4 + DOPPLER_ERROR_MPS ? 'jump' : 'fast';
  }

  /**
   * How long the session had no fix after fix `i`, as the session came: a gap that only opened because the fixes in it
   * were taken out as spikes is no silence. Asked only of a fix that has another after it (a trip's `a` and a `c` that
   * has the fixes `d` after it).
   */
  silenceAfter(i: number): number {
    return this.original[this.source[i] + 1].t - this.fixes[i].t;
  }

  without(drop: ReadonlySet<number>): Track {
    const kept = this.fixes.flatMap((_, i) => (drop.has(i) ? [] : [i]));
    return new Track(
      kept.map((i) => this.fixes[i]),
      kept.map((i) => this.source[i]),
      this.original,
    );
  }
}

type Chosen = { index: number; mode: Mode };
type Taken = { fix: LocationSample; mode: Mode };

/**
 * The cheapest walk through the fixes, as described above, or through the fixes `first` to `last` only. With
 * `pinned`, it keeps `last`.
 */
function cheapestWalk(track: Track, first = 0, last = track.fixes.length - 1, pinned = false): Chosen[] {
  const n = last - first + 1;
  // cost[2k + mode] for the fix first + k, and the state it was reached from.
  const cost = new Float64Array(2 * n).fill(Infinity);
  const back = new Int32Array(2 * n).fill(-1);
  const relax = (state: number, value: number, from: number) => {
    if (value < cost[state]) {
      cost[state] = value;
      back[state] = from;
    }
  };
  for (let k = 0; k < n; k += 1) {
    const j = first + k;
    // `j` as the first fix kept: every fix before it is skipped.
    relax(2 * k + RUN, k * SKIP_COST, -1);
    for (let h = Math.max(0, k - LOOK_BACK_FIXES); h < k; h += 1) {
      const i = first + h;
      const kind = track.step(i, j);
      if (kind === null) continue;
      const base = (k - h - 1) * SKIP_COST + LENGTH_COST_PER_M * track.apartM(i, j);
      for (let from = RUN; from <= DRIVE; from += 1) {
        const before = cost[2 * h + from] + base;
        if (kind === 'run') relax(2 * k + RUN, before + (from === DRIVE ? DRIVE_END_COST : 0), 2 * h + from);
        else {
          const start = track.fixes[j].t - track.fixes[i].t > GAP_MS ? GAP_DRIVE_START_COST : DRIVE_START_COST;
          relax(2 * k + DRIVE, before + (from === RUN ? start : 0) + (kind === 'jump' ? JUMP_COST : 0), 2 * h + from);
        }
      }
    }
  }

  let best = Infinity;
  let state = -1;
  for (let s = pinned ? 2 * (n - 1) : 0; s < 2 * n; s += 1) {
    const total = cost[s] + (n - 1 - (s >> 1)) * SKIP_COST;
    if (total < best) {
      best = total;
      state = s;
    }
  }
  const chosen: Chosen[] = [];
  for (; state >= 0; state = back[state]) chosen.push({ index: first + (state >> 1), mode: (state & 1) as Mode });
  return chosen.reverse();
}

/**
 * The fixes of short trips away that come back: up to LOOK_BACK_FIXES - 1 fixes in a
 * row, each far from both the fix `a` before them and the fix `c` after them, where a
 * runner could have gone from `a` to `c` and `c` is nearer to `a` than any of them.
 * Counting fixes cannot see these when the trip has more fixes than the return (three
 * spikes, then the session ends on the fix that came back), and no runner or vehicle
 * goes out and back like that within a few fixes, unless a long gap on both sides hid
 * the way there and back (then it is a place he went to). The place the trip leaves and
 * comes back to must hold more fixes around it than any place of the trip does:
 * otherwise two spikes at one place would make the real fixes between them look like
 * the trip.
 */
function excursions(track: Track): Set<number> {
  const out = new Set<number>();
  const n = track.fixes.length;
  /** How many fixes around the trip, from LOOK_BACK_FIXES before `a` to as many after `c`, lie within `r` of any of `at`. */
  const held = (a: number, c: number, r: number, ...at: number[]) => {
    let count = 0;
    for (let i = Math.max(0, a - LOOK_BACK_FIXES); i <= Math.min(n - 1, c + LOOK_BACK_FIXES); i += 1) {
      if (at.some((p) => track.apartM(p, i) <= r)) count += 1;
    }
    return count;
  };
  /** The place the trip leaves and comes back to holds more fixes than any place of the trip holds. */
  const heldBetter = (a: number, c: number, r: number) => {
    const ends = held(a, c, r, a, c);
    for (let w = a + 1; w < c; w += 1) if (held(a, c, r, w) >= ends) return false;
    return true;
  };
  /*
   * What makes it a trip of spikes and not a way he went. Either it is left by a jump no one makes, or it is a
   * stand or a few fixes only, not hidden by a long gap on both sides. (A trip entered by a jump needs no rule: the
   * walk drops it, since skipping it is cheaper than the jump. Left by a jump, the walk may instead drop the fix it
   * comes back to, when that fix is the last of the session or of its own place.) A longer stretch that moves, which a
   * runner could have entered and left, is his own way out and back through gaps (measured: such a loop of 170 m),
   * and a place reached across a long gap and left across another is a place he went to, however few its fixes: K2
   * of round 4.
   */
  const leftByJump = (c: number) => track.step(c - 1, c) === 'jump';
  /**
   * Whether a long gap on both sides hid the way there and the way back. Both are asked of real fixes only, and the
   * cheapest walk says which those are: the walk that comes back to `c` (a fix the trip comes back to is real, below),
   * through the trip and as many fixes before it. The place is what the walk keeps of the trip; the way there runs from
   * the last fix it keeps before the place, and the way back from the last fix of the place to `c`. A spike, a burst of
   * them, a stale position or a second position at the same instant next to a gap is a fix of the signal and not of the
   * way, and the walk skips it as it skips one anywhere, so it neither ends a silence nor begins one, whether it is a
   * fix of the trip or `a` itself. A trip the walk keeps nothing of is no place at all. (Round 6: the silences used to
   * be read off the fixes as they came, so that one spike or more next to a gap made a place walked to and back from
   * across two long gaps a trip of spikes, around a block 594 m of 1054 m.)
   */
  const hidden = (a: number, c: number) => {
    // The way back ends at `c` and begins at a fix of the trip at the earliest: too short a trip has no time for it.
    if (track.fixes[c].t - track.fixes[a + 1].t < LONG_GAP_MS) return false;
    const kept = cheapestWalk(track, Math.max(0, a - LOOK_BACK_FIXES), c, true).map(({ index }) => index);
    const first = kept.findIndex((k) => k > a);
    const last = kept.length - 2;
    if (last < first) return false;
    const fixes = track.fixes;
    const there = fixes[kept[first]].t - fixes[first > 0 ? kept[first - 1] : a].t;
    return there >= LONG_GAP_MS && fixes[c].t - fixes[kept[last]].t >= LONG_GAP_MS;
  };
  /**
   * The fix the trip comes back to must not be a spike itself. It is one when it is not back at the place the trip
   * left and the fixes after it disown it: the next one cannot follow it, and neither can the one after that (two, so
   * that a single spike right after it does not disown it). A spike that happens to lie where a runner could be (on the
   * way he runs a little later) would otherwise make the real fixes before it the trip. The last fix of a session has
   * nothing after it to disown it.
   *
   * Across a long silence a runner reaches a spike as easily as a real fix, so a fix that comes only after one follows
   * nothing, and the fix before the silence may be the spike that ends a place (round 6: a spike as the last fix before
   * a gap, a minute from the fix after it, took the place of the fix the trip came back to). That holds only where the
   * trip could be such a place (`mayEndAPlace`), and each of the three exceptions was measured (round 7: the clause had
   * been written for every gap of more than GAP_MS and for every trip, and a trip of spikes right after a gap of 15 s, a
   * real fix and a gap of 15 s came out as 495 m for 276). All three are asked of the silences as the session had them
   * (`silenceAfter`), since taking spikes out opens gaps that were never silence, and a clause that read those would
   * decide on what the walk itself did one pass before:
   * - the silence after `c` is a short one, GAP_MS to LONG_GAP_MS: it holds no way back long enough to walk, so no place
   *   is hidden behind it, and a hole of 12 s between the fixes of a man who stands is one (WITH_DRIVE 590: 267 m too
   *   long);
   * - the trip comes right after such a short silence: a place he went to is reached across a long one, so a burst of
   *   spikes first after a short one is a burst of spikes, and the real fix after it is the one the run goes on from
   *   (WITH_DRIVE 757 and 969);
   * - the trip is one fix that comes without a long silence before it, and not at the instant of `c`: one fix is not a
   *   place that outweighs the fix next to it, unless a long silence says he was somewhere (WITH_DRIVE 49).
   */
  const shortSilence = (i: number) => track.silenceAfter(i) > GAP_MS && track.silenceAfter(i) < LONG_GAP_MS;
  const mayEndAPlace = (a: number, c: number) => {
    const lone = c - a === 2 && track.fixes[c].t !== track.fixes[c - 1].t;
    return !shortSilence(c) && !shortSilence(a) && (!lone || track.silenceAfter(a) >= LONG_GAP_MS);
  };
  const jumpsTo = (a: number, c: number, d: number) => d >= n || (track.fixes[d].t - track.fixes[c].t > GAP_MS && mayEndAPlace(a, c)) || track.step(c, d) === 'jump';
  const confirmed = (a: number, c: number, near: number) =>
    track.apartM(a, c) <= near || c + 1 >= n || !(jumpsTo(a, c, c + 1) && jumpsTo(a, c, c + 2));
  /**
   * A fix with a second position at the same instant (one of the two is wrong) is the fix a trip leaves from or comes back
   * to only when the other position is not at the trip as well: if it is, the trip is where he was at that instant, and
   * the fix is the wrong one of the two (round 6: such a position by the point he left from made the place he went to a
   * trip of spikes, left 0 s after the fix it began with).
   */
  const alone = (e: number, a: number, c: number, near: number) => {
    for (let q = e - 1; q >= 0 && track.fixes[q].t === track.fixes[e].t; q -= 1) if (!farFrom(q, a, c, near)) return false;
    for (let q = e + 1; q < n && track.fixes[q].t === track.fixes[e].t; q += 1) if (!farFrom(q, a, c, near)) return false;
    return true;
  };
  /** Whether every fix of the trip but `q` itself is further than `near` from `q`. */
  const farFrom = (q: number, a: number, c: number, near: number) => {
    for (let w = a + 1; w < c; w += 1) if (w !== q && track.apartM(q, w) <= near) return false;
    return true;
  };
  const brief = (a: number, c: number) => {
    let still = true;
    for (let w = a + 1; w < c && still; w += 1) still = standing(track.fixes[w]);
    const few = still || c - a - 1 <= VEHICLE_CONFIRM_FIXES;
    return few;
  };
  for (let a = 0; a < n; a += 1) {
    for (let c = a + 2; c <= Math.min(a + LOOK_BACK_FIXES, n - 1); c += 1) {
      if (track.step(a, c) !== 'run') continue;
      const near = Math.max(2 * stepThresholdM(track.fixes[a], track.fixes[c]), track.apartM(a, c));
      let far = true;
      for (let w = a + 1; w < c && far; w += 1) far = track.apartM(a, w) > near && track.apartM(w, c) > near;
      const place = 2 * stepThresholdM(track.fixes[a], track.fixes[c]);
      if (!far || !alone(a, a, c, near) || !alone(c, a, c, near) || !confirmed(a, c, place) || !(leftByJump(c) || brief(a, c)) || !heldBetter(a, c, place) || hidden(a, c)) continue;
      for (let w = a + 1; w < c; w += 1) out.add(w);
      break;
    }
  }
  return out;
}

/** Pass 1: the trips away out first, until none is left, then the cheapest walk. */
function chooseFixes(good: readonly LocationSample[]): Taken[] {
  let track = new Track(good);
  for (let away = excursions(track); away.size > 0; away = excursions(track)) track = track.without(away);
  return cheapestWalk(track).map(({ index, mode }) => ({ fix: track.fixes[index], mode }));
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** The place of a stand: the middle of its fixes, coordinate by coordinate. */
const middleOf = (stand: readonly LocationSample[]): LocationSample => ({
  ...stand[stand.length - 1],
  lat: median(stand.map((f) => f.lat)),
  lon: median(stand.map((f) => f.lon)),
  accuracy: median(stand.map((f) => f.accuracy as number)),
});

/** Pass 2: distance and drives through the chosen fixes. */
function measure(chosen: readonly Taken[], result: DistanceResult) {
  let anchor = chosen[0].fix;
  let previous = anchor;
  let stand: LocationSample[] = standing(anchor) ? [anchor] : [];
  let drive: { from: number; to: number } | null = null;

  const add = (to: LocationSample) => {
    result.distanceM += haversineM(anchor, to);
    anchor = to;
  };
  const stepTo = (to: LocationSample) => {
    if (haversineM(anchor, to) >= stepThresholdM(anchor, to)) add(to);
  };
  const endStand = () => {
    if (stand.length > 0) stepTo(middleOf(stand));
    stand = [];
  };
  const endDrive = () => {
    if (drive !== null) result.vehicleDurationMs += drive.to - drive.from;
    drive = null;
  };

  for (const { fix, mode } of chosen.slice(1)) {
    if (mode === DRIVE) {
      endStand();
      if (drive === null) {
        result.vehicleSegments += 1;
        // From the last time he was known to be where the drive began: the fix before it, a stand's last fix included.
        drive = { from: previous.t, to: fix.t };
      }
      drive.to = fix.t;
      add(fix);
    } else {
      if (!standing(fix)) {
        // A fix of standing never ends a drive (a car at a light); the first fix that moves at a runner's speed does.
        endDrive();
        endStand();
        stepTo(fix);
      } else {
        if (stand.length > 0 && fix.t - stand[stand.length - 1].t > GAP_MS) {
          // A gap inside a stand: the same place unless he is now further off than both errors twice over.
          const place = middleOf(stand);
          if (haversineM(place, fix) > 2 * ((place.accuracy as number) + (fix.accuracy as number))) endStand();
        }
        stand.push(fix);
      }
    }
    previous = fix;
  }
  endStand();
  endDrive();
}

/** Horizontal distance from the raw fixes. */
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

  const good: LocationSample[] = [];
  for (const fix of [...fixes].sort((a, b) => a.t - b.t)) {
    if (fix.mock) result.mockFixes += 1;
    result.lastFixT = fix.t;
    result.lastFixPoor = !(fix.accuracy !== undefined && fix.accuracy <= MAX_ACCURACY_M);
    if (result.lastFixPoor) {
      result.poorFixes += 1;
      continue;
    }
    // The same fix delivered twice is one fix.
    const last = good[good.length - 1];
    if (last !== undefined && last.t === fix.t && last.lat === fix.lat && last.lon === fix.lon) continue;
    good.push(fix);
  }
  if (good.length === 0) return result;

  const chosen = chooseFixes(good);
  result.spikeFixes = good.length - chosen.length;
  measure(chosen, result);
  return result;
}
