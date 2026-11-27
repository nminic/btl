import { MAX_SPEED_MPS, STATIONARY_SPEED_MPS } from '../distance';
import type { LocationSample } from '../recording';
import { offset } from './synth';

/*
 * Sessions generated from a TRUE path, so that a property can be stated against
 * where the runner really was and not against an older version of the algorithm.
 *
 * The path turns (a heading that drifts within a stretch and may change sharply
 * between two stretches), and holds running, walking, slow walking, standing and
 * driving. The fixes are the true positions plus GPS error, and on top of them:
 * spikes one second apart and in bursts, up to 30 percent of the first fixes after
 * a gap, spikes that carry a standing Doppler speed, fixes repeated at the same
 * instant (as copies and as a second position), poor fixes, stands whose fixes come
 * further apart than a gap, and gaps while he stands, runs or drives.
 *
 * What it leaves out, and why:
 * - Walking below STATIONARY_SPEED_MPS: Doppler cannot tell it from standing, and
 *   that is a limit of the measure itself, written down on its own (PENDING,
 *   „Spor hod ispod 0,5 m/s”), not of what happens after a gap.
 * - A burst of more than five spikes in a row: the measure looks five fixes back for
 *   one that is believable, and a longer burst is a limit it states.
 * - GPS error larger than the reported accuracy on a moving fix: Android's accuracy
 *   is a radius of about 68 percent, so a moving fix outside it is a spike and is
 *   generated as one. A STANDING fix may wander up to the accuracy independently of
 *   the one before it, which is harsher than real GPS error, whose drift is slow.
 * - A drive is entered and left at once, with no braking: that is the hardest case for
 *   where it begins, not an easier one.
 */

/** A deterministic sequence in [0, 1): mulberry32, independent of `jitter` in synth.ts. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Mode = 'run' | 'walk' | 'slow' | 'stand' | 'drive';

export type Profile = {
  /** Which stretches the path is made of. */
  modes: readonly Mode[];
  /** How many gaps in the signal, at most. */
  gaps: number;
  /** The chance that a fix is a spike, anywhere. */
  spikeRate: number;
  /** The chance that each of the first fixes after a gap is a spike. */
  afterGapSpikeRate: number;
  /**
   * No spike among this many last fixes. A trip away that the session ends on has
   * nothing after it to say it was one, and the measure takes the last fixes as they
   * are; a property about a man who stands is stated without that case, which has its
   * own cases in distance.test.ts.
   */
  quietEndFixes?: number;
};

export type Truth = {
  /**
   * The best length that can be known from the fixes: the true positions at the times
   * of the good fixes (real ones and spikes, since a spike too says that the signal was
   * there and when), joined in order. A gap is bridged by its chord, since nothing is
   * known about the path inside it, and a stand adds nothing.
   */
  idealM: number;
  /** The runner was never in a vehicle. */
  noVehicle: boolean;
  /** The fixes show a drive that can be seen: three steps in a row, or one across a gap, faster than a runner. */
  vehicleVisible: boolean;
  /** He stood the whole session. */
  standsOnly: boolean;
  gaps: number;
  stands: number;
  accuracy: number;
};

export type Session = { fixes: LocationSample[]; truth: Truth };

const between = (next: () => number, lo: number, hi: number) => lo + next() * (hi - lo);

const SPEED: Record<Mode, readonly [number, number]> = {
  run: [2.5, 5.5],
  walk: [1.2, 2],
  slow: [0.6, 1],
  stand: [0, 0],
  drive: [15, 30],
};

type Sample = { t: number; e: number; n: number; speed: number; mode: Mode };

export function session(seed: number, profile: Profile): Session {
  const next = random(seed);
  const accuracy = Math.round(between(next, 3, 8));

  // The true path, one sample a second.
  const truePath: Sample[] = [];
  let e = 0;
  let n = 0;
  let heading = between(next, 0, 2 * Math.PI);
  let t = 0;
  let stands = 0;
  const count = 6 + Math.floor(next() * 8);
  for (let s = 0; s < count; s += 1) {
    const mode = profile.modes[Math.floor(next() * profile.modes.length)];
    if (mode === 'stand') stands += 1;
    const [lo, hi] = SPEED[mode];
    const speed = between(next, lo, hi);
    const seconds = Math.round(mode === 'drive' ? between(next, 20, 120) : between(next, 15, 120));
    // A sharp turn between two stretches, and a gentle one within a stretch.
    heading += next() < 0.4 ? between(next, -2, 2) : 0;
    const turn = between(next, -0.12, 0.12) * (mode === 'drive' ? 0.3 : 1);
    for (let i = 0; i < seconds; i += 1) {
      truePath.push({ t, e, n, speed, mode });
      heading += turn;
      e += speed * Math.cos(heading);
      n += speed * Math.sin(heading);
      t += 1000;
    }
  }

  // Which samples become fixes: all of them, except that a stand may be sampled sparsely.
  const sparse = next() < 0.5;
  const sampled = truePath.filter((p, i) => {
    if (p.mode !== 'stand' || !sparse || i === 0) return true;
    return next() < 0.25;
  });

  // Gaps in the signal.
  const end = truePath[truePath.length - 1].t;
  const windows = Array.from({ length: Math.floor(next() * (profile.gaps + 1)) }, () => {
    const from = Math.round(between(next, 5000, end - 5000));
    return [from, from + Math.round(between(next, 11_000, 90_000))] as const;
  });
  const kept = sampled.filter((p) => windows.every(([from, to]) => p.t < from || p.t >= to));

  // GPS error that drifts slowly, inside the accuracy.
  let errE = 0;
  let errN = 0;
  const fixes: LocationSample[] = [];
  const real: Sample[] = [];
  const seen: Sample[] = [];
  let afterGap = 0;
  let burst = 0;
  let burstE = 0;
  let burstN = 0;
  kept.forEach((p, i) => {
    const previous = kept[i - 1];
    if (previous !== undefined && p.t - previous.t > 10_000) afterGap = 6;
    const fixAccuracy = accuracy + Math.round(between(next, -1, 1));
    errE = Math.max(-0.6, Math.min(0.6, errE / fixAccuracy + between(next, -0.05, 0.05))) * fixAccuracy;
    errN = Math.max(-0.6, Math.min(0.6, errN / fixAccuracy + between(next, -0.05, 0.05))) * fixAccuracy;
    let fe = p.e + errE;
    let fn = p.n + errN;
    if (p.mode === 'stand' && next() < 0.5) {
      // A standing fix that wanders anywhere inside its accuracy.
      const r = fixAccuracy * Math.sqrt(next());
      const a = between(next, 0, 2 * Math.PI);
      fe = p.e + r * Math.cos(a);
      fn = p.n + r * Math.sin(a);
    }
    const doppler = p.mode === 'stand' ? between(next, 0, STATIONARY_SPEED_MPS * 0.9) : Math.max(STATIONARY_SPEED_MPS + 0.05, p.speed + between(next, -0.15, 0.15));
    const quiet = i >= kept.length - (profile.quietEndFixes ?? 0);
    const chance = quiet ? 0 : afterGap > 0 ? profile.afterGapSpikeRate : profile.spikeRate;
    afterGap -= 1;
    if (burst === 0 && next() < chance) {
      burst = 1 + (next() < 0.3 ? Math.floor(next() * 5) : 0);
      const r = between(next, 30, 200);
      const a = between(next, 0, 2 * Math.PI);
      burstE = r * Math.cos(a);
      burstN = r * Math.sin(a);
    }
    if (burst > 0 && !quiet) {
      burst -= 1;
      seen.push(p);
      // A spike: as accurate and with the same Doppler speed as a real fix, so nothing but its position gives it away.
      fixes.push({ t: p.t, ...offset(p.e + burstE + between(next, -5, 5), p.n + burstN + between(next, -5, 5)), accuracy: fixAccuracy, speed: doppler, mock: false, receivedAt: p.t });
      return;
    }
    if (next() < 0.03) {
      fixes.push({ t: p.t, ...offset(p.e + between(next, -100, 100), p.n), accuracy: between(next, 25, 60), speed: doppler, mock: false, receivedAt: p.t });
      return;
    }
    const fix: LocationSample = { t: p.t, ...offset(fe, fn), accuracy: fixAccuracy, speed: doppler, mock: false, receivedAt: p.t };
    fixes.push(fix);
    real.push(p);
    seen.push(p);
    const odd = next();
    // The same fix delivered twice, or a second position at the same instant (which is one of the two wrong).
    if (odd < 0.01) fixes.push({ ...fix });
    else if (odd < 0.015) fixes.push({ ...fix, ...offset(p.e + 60, p.n + 40) });
  });

  let idealM = 0;
  for (let i = 1; i < seen.length; i += 1) idealM += Math.hypot(seen[i].e - seen[i - 1].e, seen[i].n - seen[i - 1].n);
  let fast = 0;
  let vehicleVisible = false;
  for (let i = 1; i < real.length; i += 1) {
    const a = real[i - 1];
    const b = real[i];
    const speed = Math.hypot(b.e - a.e, b.n - a.n) / ((b.t - a.t) / 1000);
    fast = speed > MAX_SPEED_MPS ? fast + 1 : 0;
    if (fast >= 3 || (speed > MAX_SPEED_MPS * 1.1 && b.t - a.t > 10_000)) vehicleVisible = true;
  }

  // Android hands fixes over in batches, sometimes in the wrong order.
  const delivered: LocationSample[] = [];
  for (let i = 0; i < fixes.length; i += 7) {
    const batch = fixes.slice(i, i + 7);
    delivered.push(...(next() < 0.2 ? batch.reverse() : batch));
  }

  return {
    fixes: delivered,
    truth: {
      idealM,
      noVehicle: truePath.every((p) => p.mode !== 'drive'),
      vehicleVisible,
      standsOnly: truePath.every((p) => p.mode === 'stand'),
      gaps: windows.length,
      stands,
      accuracy,
    },
  };
}

export const ON_FOOT: Profile = { modes: ['run', 'walk', 'slow', 'stand'], gaps: 3, spikeRate: 0.02, afterGapSpikeRate: 0.3 };
export const WITH_DRIVE: Profile = { modes: ['run', 'walk', 'stand', 'drive'], gaps: 3, spikeRate: 0.02, afterGapSpikeRate: 0.3 };
export const STANDING: Profile = { modes: ['stand'], gaps: 3, spikeRate: 0.03, afterGapSpikeRate: 0.3 };
export const NO_GAP: Profile = { modes: ['run', 'walk', 'slow', 'stand', 'drive'], gaps: 0, spikeRate: 0.02, afterGapSpikeRate: 0 };
