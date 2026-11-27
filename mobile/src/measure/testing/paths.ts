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
 * - In TRIP_BACK, more spikes in the stay than real fixes, a burst of more than two after
 *   a gap, and spikes beyond the first four fixes after one: then the spikes next to a gap
 *   outnumber the real fixes there, and nothing but the true path tells which is which
 *   (the measure keeps whichever holds more fixes). Measured on 1000 sessions with bursts
 *   of up to five among the first six fixes after a gap: 50 outside the tolerance, against
 *   19 as generated (4d5dc0c1b: 223 and 210).
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
  quietEndFixes: number;
  /**
   * The path goes out from a point of the track, stays a few seconds and comes back to that very point, with one long
   * gap over the way there and the way back, or one over each (and the fixes of the stay between them). The place he
   * comes back to is one he was at before: what a spike as the first fix after a gap threatens to turn into a trip away.
   */
  tripBack?: boolean;
  /** The longest burst of spikes in a row; 5 unless said. */
  maxBurst?: number;
  /** How many of the first fixes after a gap `afterGapSpikeRate` applies to; 6 unless said. */
  afterGapFixes?: number;
  /** The chance that the last fix before a gap is a spike. */
  beforeGapSpikeRate?: number;
  /** The chance that the first fix after a gap is a stale position: where the last real fix before the gap was, with the time of now. */
  staleAfterGapRate?: number;
  /**
   * With `tripBack`, the chance that a real fix of the stay comes with a second position at the same instant: half of
   * them by the point he left from, where it can pass for the fix a trip leaves from or comes back to, and half 30 to
   * 150 m off.
   */
  twinInStayRate?: number;
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

/** What each fix is, so that a property of the generator can be checked against the fixes themselves. */
export type Kind = 'real' | 'spike' | 'poor' | 'copy' | 'twin' | 'stale';

export type Session = { fixes: LocationSample[]; truth: Truth; kinds: Kind[] };

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
  /** Where the gaps are, when the path decides it (`tripBack`); otherwise they are drawn below. */
  let scripted: (readonly [number, number])[] | null = null;
  /** With `tripBack`: the stay, and the point he left from and comes back to. */
  let stay = { from: 0, to: 0, e: 0, n: 0 };
  if (profile.tripBack) {
    const theta = between(next, 0, 2 * Math.PI);
    const leg = (mode: Mode, speed: number, seconds: number, toward: number) => {
      for (let i = 0; i < seconds; i += 1) {
        truePath.push({ t, e, n, speed, mode });
        e += speed * Math.cos(toward);
        n += speed * Math.sin(toward);
        t += 1000;
      }
    };
    leg('run', between(next, 2.5, 4.5), Math.round(between(next, 30, 70)), theta);
    const walking = between(next, 1.2, 2);
    const outFrom = { t, e, n };
    leg('walk', walking, Math.round(between(next, 40, 70)), theta + Math.PI / 2);
    const stays = next() < 0.5 ? 'stand' : 'walk';
    const stayFrom = t;
    if (stays === 'stand') stands += 1;
    leg(stays, stays === 'stand' ? 0 : walking, Math.round(between(next, 6, 12)), theta + Math.PI / 2);
    const stayTo = t;
    stay = { from: stayFrom, to: stayTo, e: outFrom.e, n: outFrom.n };
    const home = Math.hypot(outFrom.e - e, outFrom.n - n);
    const homeSeconds = Math.max(35, Math.round(home / walking));
    leg('walk', home / homeSeconds, homeSeconds, Math.atan2(outFrom.n - n, outFrom.e - e));
    scripted = next() < 0.5 ? [[outFrom.t + 1000, stayFrom], [stayTo, t]] : [[outFrom.t + 1000, t]];
    leg('run', between(next, 2.5, 4.5), Math.round(between(next, 30, 70)), theta);
  }
  for (let s = 0; s < (profile.tripBack ? 0 : count); s += 1) {
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

  // Which samples become fixes: all of them, except that a stand may be sampled sparsely (not the stay of `tripBack`,
  // whose few fixes are the place: with fewer real fixes there than spikes, it could not be told from a burst).
  const sparse = next() < 0.5;
  const sampled = truePath.filter((p, i) => {
    if (p.mode !== 'stand' || !sparse || i === 0 || profile.tripBack) return true;
    return next() < 0.25;
  });

  // Gaps in the signal.
  const end = truePath[truePath.length - 1].t;
  const windows =
    scripted ??
    Array.from({ length: Math.floor(next() * (profile.gaps + 1)) }, () => {
      const from = Math.round(between(next, 5000, end - 5000));
      return [from, from + Math.round(between(next, 11_000, 90_000))] as const;
    });
  const kept = sampled.filter((p) => windows.every(([from, to]) => p.t < from || p.t >= to));

  // GPS error that drifts slowly, inside the accuracy.
  let errE = 0;
  let errN = 0;
  const fixes: LocationSample[] = [];
  const kinds: Kind[] = [];
  const push = (fix: LocationSample, kind: Kind) => {
    fixes.push(fix);
    kinds.push(kind);
  };
  const real: Sample[] = [];
  const seen: Sample[] = [];
  let afterGap = 0;
  let burst = 0;
  let burstE = 0;
  let burstN = 0;
  /** Spikes still allowed in the stay: with more spikes than real fixes there, the place could not be told from a burst. */
  let stayBudget = 2;
  let lastE = 0;
  let lastN = 0;
  kept.forEach((p, i) => {
    const previous = kept[i - 1];
    const firstAfterGap = previous !== undefined && p.t - previous.t > 10_000;
    const lastBeforeGap = i + 1 < kept.length && kept[i + 1].t - p.t > 10_000;
    if (firstAfterGap) afterGap = profile.afterGapFixes ?? 6;
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
    const quiet = i >= kept.length - profile.quietEndFixes;
    const inStay = scripted !== null && p.t >= stay.from && p.t < stay.to;
    const stayFull = inStay && stayBudget <= 0;
    if (stayFull) burst = 0;
    const chance = quiet || stayFull ? 0 : afterGap > 0 ? profile.afterGapSpikeRate : profile.spikeRate;
    afterGap -= 1;
    if (!quiet && firstAfterGap && real.length > 0 && profile.staleAfterGapRate !== undefined && next() < profile.staleAfterGapRate) {
      // Android hands over the last position it had, with the time of now.
      seen.push(p);
      push({ t: p.t, ...offset(lastE + between(next, -1, 1), lastN + between(next, -1, 1)), accuracy: fixAccuracy, speed: doppler, mock: false, receivedAt: p.t }, 'stale');
      return;
    }
    const lastSpike = !quiet && !stayFull && lastBeforeGap && burst === 0 && profile.beforeGapSpikeRate !== undefined && next() < profile.beforeGapSpikeRate;
    if (lastSpike || (burst === 0 && next() < chance)) {
      burst = lastSpike ? 1 : 1 + (next() < 0.3 ? Math.floor(next() * (profile.maxBurst ?? 5)) : 0);
      const r = between(next, 30, 200);
      const a = between(next, 0, 2 * Math.PI);
      burstE = r * Math.cos(a);
      burstN = r * Math.sin(a);
    }
    if (burst > 0 && !quiet) {
      burst -= 1;
      if (inStay) stayBudget -= 1;
      seen.push(p);
      // A spike: as accurate and with the same Doppler speed as a real fix, so nothing but its position gives it away.
      push({ t: p.t, ...offset(p.e + burstE + between(next, -5, 5), p.n + burstN + between(next, -5, 5)), accuracy: fixAccuracy, speed: doppler, mock: false, receivedAt: p.t }, 'spike');
      return;
    }
    if (next() < 0.03) {
      push({ t: p.t, ...offset(p.e + between(next, -100, 100), p.n), accuracy: between(next, 25, 60), speed: doppler, mock: false, receivedAt: p.t }, 'poor');
      return;
    }
    const fix: LocationSample = { t: p.t, ...offset(fe, fn), accuracy: fixAccuracy, speed: doppler, mock: false, receivedAt: p.t };
    push(fix, 'real');
    real.push(p);
    seen.push(p);
    lastE = fe;
    lastN = fn;
    const odd = next();
    // The same fix delivered twice, or a second position at the same instant (which is one of the two wrong).
    if (odd < 0.01) push({ ...fix }, 'copy');
    else if (odd < 0.015) push({ ...fix, ...offset(p.e + 60, p.n + 40) }, 'twin');
    else if (inStay && profile.twinInStayRate !== undefined && next() < profile.twinInStayRate) {
      // By the point he left from, or 30 to 150 m off where he is.
      const home = next() < 0.5;
      const r = home ? between(next, 0, 4) : between(next, 30, 150);
      const a = between(next, 0, 2 * Math.PI);
      push({ ...fix, ...offset((home ? stay.e : p.e) + r * Math.cos(a), (home ? stay.n : p.n) + r * Math.sin(a)) }, 'twin');
    }
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
  const deliveredKinds: Kind[] = [];
  for (let i = 0; i < fixes.length; i += 7) {
    const order = fixes.slice(i, i + 7).map((_, k) => i + k);
    if (next() < 0.2) order.reverse();
    for (const k of order) {
      delivered.push(fixes[k]);
      deliveredKinds.push(kinds[k]);
    }
  }

  return {
    fixes: delivered,
    kinds: deliveredKinds,
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

export const ON_FOOT: Profile = { modes: ['run', 'walk', 'slow', 'stand'], gaps: 3, spikeRate: 0.02, afterGapSpikeRate: 0.3, quietEndFixes: 0 };
export const WITH_DRIVE: Profile = { modes: ['run', 'walk', 'stand', 'drive'], gaps: 3, spikeRate: 0.02, afterGapSpikeRate: 0.3, quietEndFixes: 0 };
export const STANDING: Profile = { modes: ['stand'], gaps: 3, spikeRate: 0.03, afterGapSpikeRate: 0.3, quietEndFixes: 0 };
export const NO_GAP: Profile = { modes: ['run', 'walk', 'slow', 'stand', 'drive'], gaps: 0, spikeRate: 0.02, afterGapSpikeRate: 0, quietEndFixes: 0 };
/**
 * Out to a place and back to the point he left from, across long gaps (see `tripBack`), with everything a gap can have
 * next to it: single spikes and bursts as the first fixes after either gap, a spike as the last fix before one, a stale
 * position as the first fix after one, and a second position at the same instant in the stay.
 */
export const TRIP_BACK: Profile = {
  modes: ['run', 'walk', 'stand'],
  gaps: 2,
  spikeRate: 0,
  afterGapSpikeRate: 0.4,
  quietEndFixes: 0,
  tripBack: true,
  afterGapFixes: 4,
  maxBurst: 2,
  beforeGapSpikeRate: 0.3,
  staleAfterGapRate: 0.2,
  twinInStayRate: 0.15,
};
