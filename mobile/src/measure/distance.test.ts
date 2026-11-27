import { GAP_MS, measureDistance, MAX_ACCURACY_M, MIN_STEP_M, STATIONARY_SPEED_MPS } from './distance';
import { NO_GAP, ON_FOOT, type Profile, session, STANDING, type Truth, WITH_DRIVE } from './testing/paths';
import { every, fix, jitter } from './testing/synth';

/** A straight run east at `speed` m/s, one fix a second. */
function straight(fromS: number, toS: number, speed = 3, startM = 0) {
  return every(fromS * 1000, toS * 1000, 1).map((t) => fix(t, startM + speed * (t / 1000 - fromS), 0, { speed }));
}

describe('standing and moving', () => {
  it('adds nothing while the position wanders around a runner who stands', () => {
    const next = jitter(1);
    const fixes = every(0, 600_000, 1).map((t) => fix(t, next() * 6, next() * 6, { speed: 0.1 }));

    const result = measureDistance(fixes);

    expect(result.distanceM).toBe(0);
    expect(fixes.length).toBe(600);
  });

  it('adds the whole run when the same number of fixes moves in a straight line', () => {
    const result = measureDistance(straight(0, 600));

    expect(result.distanceM).toBeGreaterThan(1797 * 0.995 - 6);
    expect(result.distanceM).toBeLessThanOrEqual(1797.000001);
  });

  it('without Doppler speed, holds jitter below both errors together', () => {
    const next = jitter(2);
    const fixes = every(0, 300_000, 1).map((t) => fix(t, next() * 1.5, next() * 1.5, { speed: undefined }));

    expect(measureDistance(fixes).distanceM).toBe(0);
  });
});

describe('good and poor accuracy', () => {
  /** A run east with a stretch from 60 to 100 s that wanders 60 m north and back. */
  function withDetour(accuracy: number) {
    return straight(0, 160).map((f, i) => {
      if (i < 60 || i >= 100) return f;
      const north = i < 80 ? (i - 60) * 3 : (100 - i) * 3;
      return fix(f.t, 3 * i, north, { accuracy, speed: 3 });
    });
  }

  it(`drops fixes worse than ${MAX_ACCURACY_M} m even when they wander slowly enough to look real`, () => {
    const result = measureDistance(withDetour(30));

    expect(result.distanceM).toBeLessThanOrEqual(477.000001);
    expect(result.distanceM).toBeGreaterThan(470);
    expect(result.poorFixes).toBe(40);
  });

  it('counts the same detour when its fixes are good', () => {
    const result = measureDistance(withDetour(4));

    expect(result.distanceM).toBeGreaterThan(515);
    expect(result.poorFixes).toBe(0);
  });

  it('treats a fix that reports no accuracy as poor', () => {
    const fixes = straight(0, 10).map((f) => ({ ...f, accuracy: undefined }));

    const result = measureDistance(fixes);

    expect(result.distanceM).toBe(0);
    expect(result.poorFixes).toBe(10);
    expect(result.lastFixPoor).toBe(true);
  });
});

describe('a lost signal and a continuous one', () => {
  it('bridges a gap of a minute with the straight line, as the continuous run would have', () => {
    const continuous = measureDistance(straight(0, 400));
    const gapped = measureDistance(straight(0, 400).filter((f) => f.t < 130_000 || f.t >= 200_000));

    expect(continuous.distanceM).toBeGreaterThan(1190);
    expect(gapped.distanceM).toBeCloseTo(continuous.distanceM, 0);
  });
});

describe('the time a fix was taken and the time it was read', () => {
  it('measures by sample time when Android hands fixes over in batches, out of order', () => {
    const fixes = straight(0, 300).map((f) => ({ ...f, receivedAt: Math.ceil((f.t + 1) / 10_000) * 10_000 }));
    // Within every batch of ten the file holds them reversed.
    const delivered = [];
    for (let i = 0; i < fixes.length; i += 10) delivered.push(...fixes.slice(i, i + 10).reverse());

    const result = measureDistance(delivered);

    expect(result.distanceM).toBeGreaterThan(890);
    expect(result.vehicleSegments).toBe(0);
    expect(result.spikeFixes).toBe(0);
  });
});

describe('a spike and a vehicle', () => {
  it('drops a single fix that jumps 80 m and back, and counts it', () => {
    const fixes = straight(0, 100).map((f, i) => (i === 50 ? fix(f.t, 150, 80) : f));

    const result = measureDistance(fixes);

    expect(result.distanceM).toBeGreaterThan(290);
    expect(result.distanceM).toBeLessThanOrEqual(297.000001);
    expect(result.spikeFixes).toBe(1);
    expect(result.vehicleSegments).toBe(0);
  });

  it('counts a spike at the very end of the session', () => {
    const fixes = [...straight(0, 20), fix(20_000, 500, 0)];

    expect(measureDistance(fixes).spikeFixes).toBe(1);
  });

  it('counts a stretch at vehicle speed as it counts running, and marks how many and how long', () => {
    // PDL, „Deonica pređena brzinom vozila se RAČUNA, uz napomenu za moderatora".
    const run = measureDistance(straight(0, 600));
    const drive = measureDistance([...straight(0, 100), ...straight(100, 160, 20, 300), ...straight(160, 260, 3, 1500)]);

    expect(run.distanceM).toBeGreaterThan(1780);
    expect(drive.distanceM).toBeGreaterThan(1780);
    expect(drive.distanceM).toBeLessThanOrEqual(1797.000001);
    expect(run.vehicleSegments).toBe(0);
    expect(run.vehicleDurationMs).toBe(0);
    expect(drive.vehicleSegments).toBe(1);
    expect(drive.vehicleDurationMs).toBeGreaterThanOrEqual(58_000);
    expect(drive.vehicleDurationMs).toBeLessThanOrEqual(62_000);
  });

  it('counts the first fixes of a drive too, the ones it held until the drive was confirmed', () => {
    // Ends at 90 m; the three fixes at 50, 70 and 90 m are the ones held.
    const fixes = [...straight(0, 10), ...straight(10, 14, 20, 30)];

    const result = measureDistance(fixes);

    expect(result.vehicleSegments).toBe(1);
    expect(result.distanceM).toBeGreaterThan(89.99);
    expect(result.distanceM).toBeLessThanOrEqual(90.000001);
  });

  it('closes a vehicle stretch that lasts to the end of the session', () => {
    const fixes = [...straight(0, 100), ...straight(100, 131, 20, 300)];

    const result = measureDistance(fixes);

    expect(result.vehicleSegments).toBe(1);
    expect(result.vehicleDurationMs).toBe(30_000);
    expect(result.spikeFixes).toBe(0);
  });

  it('in a drive counts every fix as it comes, and skips one repeated at the same instant', () => {
    const drive = straight(100, 132, 20, 300);
    const fixes = [...straight(0, 100), ...drive.slice(0, 20), { ...drive[19] }, ...drive.slice(20)];

    const result = measureDistance(fixes);

    expect(result.vehicleDurationMs).toBe(31_000);
    expect(result.spikeFixes).toBe(0);
    expect(result.distanceM).toBeGreaterThan(297 + 620 - 6);
    expect(result.distanceM).toBeLessThanOrEqual(920.000001);
  });

  it('counts two separate drives as two', () => {
    const fixes = [
      ...straight(0, 50),
      ...straight(50, 80, 20, 150),
      ...straight(80, 130, 3, 750),
      ...straight(130, 160, 20, 900),
      ...straight(160, 200, 3, 1500),
    ];

    expect(measureDistance(fixes).vehicleSegments).toBe(2);
  });
});

/** Seconds `fromS` to `toS` at `speed`, the runner at `eastM` at `fromS`, one fix a second. */
const run = (fromS: number, toS: number, eastM: number) =>
  every(fromS * 1000, toS * 1000, 1).map((t) => fix(t, eastM + 3 * (t / 1000 - fromS), 0, { speed: 3 }));

/** The fix at `at` replaced by one 80 m north of where the runner is (`eastM`), with the same accuracy and Doppler speed as a real one. */
const jumpAt = (fixes: ReturnType<typeof run>, at: number, eastM: number) =>
  fixes.map((f, i) => (i === at ? fix(f.t, eastM, 80, { speed: 3 }) : f));

describe('a spike after the speed check has lost its reference', () => {
  // A stand does not move the anchor, so the speed of the next fix used to be measured over the whole
  // stand and an 80 m jump looked like a slow walk. A gap in the signal does the same: the anchor is old.
  const standing = (fromS: number, toS: number, eastM: number) =>
    every(fromS * 1000, toS * 1000, 1).map((t) => fix(t, eastM, 0, { speed: 0 }));

  const standResume = (spike: boolean) => {
    const after = run(160, 260, 300);
    return [...run(0, 100, 0), ...standing(100, 160, 300), ...(spike ? jumpAt(after, 0, 300) : after)];
  };

  it('drops a jump right after a minute of standing, as it drops one in the middle of a run', () => {
    const clean = measureDistance(standResume(false));
    const spiked = measureDistance(standResume(true));

    expect(clean.distanceM).toBeGreaterThan(590);
    expect(spiked.spikeFixes).toBe(1);
    expect(spiked.vehicleSegments).toBe(0);
    expect(Math.abs(spiked.distanceM - clean.distanceM)).toBeLessThanOrEqual(MIN_STEP_M);
    expect(spiked.distanceM).toBeLessThanOrEqual(597.000001);
  });

  it('still drops the same jump in the middle of a run without any stand', () => {
    const result = measureDistance(jumpAt(run(0, 200, 0), 100, 300));

    expect(result.spikeFixes).toBe(1);
    expect(result.distanceM).toBeLessThanOrEqual(597.000001);
  });

  it('counts a run that resumes after a stand, and marks no vehicle', () => {
    const result = measureDistance(standResume(false));

    expect(result.distanceM).toBeGreaterThan(590);
    expect(result.distanceM).toBeLessThanOrEqual(597.000001);
    expect(result.spikeFixes).toBe(0);
    expect(result.vehicleSegments).toBe(0);
  });

  it('counts a run that resumes after a stand whose fixes Android delivered in a late batch', () => {
    const stand = standing(100, 160, 300).map((f) => ({ ...f, receivedAt: Math.ceil((f.t + 1) / 30_000) * 30_000 }));
    const result = measureDistance([...run(0, 100, 0), ...stand, ...run(160, 260, 300)]);

    expect(result.distanceM).toBeGreaterThan(590);
    expect(result.vehicleSegments).toBe(0);
    expect(result.spikeFixes).toBe(0);
  });

  it('drops a jump right after a minute without any fix', () => {
    const after = run(160, 260, 480);
    const result = measureDistance([...run(0, 100, 0), ...jumpAt(after, 0, 480)]);

    expect(result.spikeFixes).toBe(1);
    expect(result.vehicleSegments).toBe(0);
    expect(result.distanceM).toBeLessThanOrEqual(777.000001);
    expect(result.distanceM).toBeGreaterThan(770);
  });

  it('drops a jump right after a service that was killed and started again, 40 s later', () => {
    const after = run(140, 240, 420);
    const result = measureDistance([...run(0, 100, 0), ...jumpAt(after, 0, 420)]);

    expect(result.spikeFixes).toBe(1);
    expect(result.vehicleSegments).toBe(0);
    expect(result.distanceM).toBeLessThanOrEqual(717.000001);
    expect(result.distanceM).toBeGreaterThan(710);
  });

  it('counts a real run that resumes after the gap, bridged as before', () => {
    const result = measureDistance([...run(0, 100, 0), ...run(160, 260, 480)]);

    expect(result.spikeFixes).toBe(0);
    expect(result.vehicleSegments).toBe(0);
    expect(result.distanceM).toBeGreaterThan(770);
    expect(result.distanceM).toBeLessThanOrEqual(777.000001);
  });

  it('counts the fix that ends a gap when it is the last of the session', () => {
    const result = measureDistance([...run(0, 100, 0), fix(200_000, 497, 0, { speed: 3 })]);

    expect(result.spikeFixes).toBe(0);
    expect(result.distanceM).toBeGreaterThan(490);
  });
});

describe('a stand right after a gap in the signal', () => {
  // The first fix after a gap is held until the next one says whether it is real. A fix that says the runner
  // stands used to move the stand clock to now and leave the anchor where it was before the gap, so the next
  // fix looked like a hundred metres in one second and three of them became a vehicle.
  const standing = (fromS: number, toS: number, eastM: number) =>
    every(fromS * 1000, toS * 1000, 1).map((t) => fix(t, eastM, 0, { speed: 0 }));
  const control = measureDistance([...run(0, 100, 0), ...run(160, 260, 480)]);

  const afterStand = (standS: number) => measureDistance([...run(0, 100, 0), ...standing(160, 160 + standS, 480), ...run(160 + standS, 260 + standS, 480)]);

  it('has no vehicle and the same distance when the runner stands ten seconds after a minute without a fix', () => {
    const result = afterStand(10);

    expect(result.vehicleSegments).toBe(0);
    expect(result.vehicleDurationMs).toBe(0);
    expect(result.spikeFixes).toBe(0);
    expect(Math.abs(result.distanceM - control.distanceM)).toBeLessThanOrEqual(MIN_STEP_M);
  });

  it('has no vehicle when he stands three seconds, or for a single fix', () => {
    for (const seconds of [3, 1]) {
      const result = afterStand(seconds);

      expect(result.vehicleSegments).toBe(0);
      expect(result.spikeFixes).toBe(0);
      expect(result.distanceM).toBeGreaterThan(control.distanceM - MIN_STEP_M);
    }
  });

  it('has no vehicle when the minute was filled with fixes too poor to use, not left empty', () => {
    const poor = every(100_000, 160_000, 1).map((t) => fix(t, 300 + 3 * (t / 1000 - 100), 0, { accuracy: 50, speed: 3 }));
    const result = measureDistance([...run(0, 100, 0), ...poor, ...standing(160, 170, 480), ...run(170, 270, 480)]);

    expect(result.poorFixes).toBe(60);
    expect(result.vehicleSegments).toBe(0);
    expect(Math.abs(result.distanceM - control.distanceM)).toBeLessThanOrEqual(MIN_STEP_M);
  });

  it('counts the bridge to where he stands, so the distance does not stay at the anchor before the gap', () => {
    expect(afterStand(10).distanceM).toBeGreaterThan(770);
  });

  it('still marks a real drive that starts after a stand that follows a gap', () => {
    const drive = straight(161, 200, 20, 480);
    const result = measureDistance([...run(0, 100, 0), ...standing(160, 161, 480), ...drive]);

    expect(result.vehicleSegments).toBe(1);
    expect(result.vehicleDurationMs).toBeGreaterThan(30_000);
    expect(result.distanceM).toBeGreaterThan(297 + 183 + 700);
  });

  it('counts the bridge to the place where he stands when the stand is the end of the session', () => {
    const result = measureDistance([...run(0, 100, 0), ...standing(160, 161, 480)]);

    expect(result.distanceM).toBeGreaterThan(470);
    expect(result.vehicleSegments).toBe(0);
  });

  it('drops a held fix of standing that the fix after it contradicts, as it drops any held fix', () => {
    const result = measureDistance([...run(0, 100, 0), fix(160_000, 480, 80, { speed: 0 }), ...run(161, 261, 480)]);

    expect(result.spikeFixes).toBe(1);
    expect(result.vehicleSegments).toBe(0);
  });

  it('keeps the stand clock moving when fixes of standing come further apart than a gap', () => {
    // Every one of them is the first after a gap. Without the clock a jump of 80 m looks like a walk of five minutes.
    const stands = every(115_000, 401_000, 1 / 15).map((t) => fix(t, 300, 0, { speed: 0 }));
    const result = measureDistance([...run(0, 100, 0), ...stands, ...jumpAt(run(401, 501, 300), 1, 303)]);

    expect(result.spikeFixes).toBe(1);
    expect(result.vehicleSegments).toBe(0);
    expect(result.distanceM).toBeGreaterThan(590);
    expect(result.distanceM).toBeLessThanOrEqual(597.000001);
  });
});

describe('the first fixes after a gap in the signal, as a class', () => {
  // Rule above `consider()` in distance.ts: a fix after a gap is held until the next one confirms it; a dropped one
  // leaves the gap open; a fix of standing never moves the anchor and never adds distance, before a gap or after one.
  const standing = (fromS: number, toS: number, eastM: number) =>
    every(fromS * 1000, toS * 1000, 1).map((t) => fix(t, eastM, 0, { speed: 0 }));
  const control = measureDistance([...run(0, 100, 0), ...run(160, 260, 480)]);

  it('has no vehicle when the held fix after a gap is dropped as a spike and the runner then stands', () => {
    const result = measureDistance([...run(0, 100, 0), fix(160_000, 480, 80, { speed: 0 }), ...standing(161, 171, 480), ...run(171, 271, 480)]);

    expect(result.spikeFixes).toBe(1);
    expect(result.vehicleSegments).toBe(0);
    expect(result.vehicleDurationMs).toBe(0);
    expect(Math.abs(result.distanceM - control.distanceM)).toBeLessThanOrEqual(MIN_STEP_M);
  });

  it('has no vehicle when two fixes of standing come at the same instant right after a gap', () => {
    // The second is a copy of the first: one fix delivered twice, so it is neither a second place nor a spike.
    const twice = fix(160_000, 480, 0, { speed: 0 });
    const result = measureDistance([...run(0, 100, 0), twice, { ...twice }, ...run(161, 261, 480)]);

    expect(result.vehicleSegments).toBe(0);
    expect(result.spikeFixes).toBe(0);
    expect(Math.abs(result.distanceM - control.distanceM)).toBeLessThanOrEqual(MIN_STEP_M);
  });

  it('drops two spikes in a row after a gap, so the second is never measured over the gap', () => {
    const spikes = [fix(160_000, 480, 80), fix(161_000, 300, -90)];
    const result = measureDistance([...run(0, 100, 0), ...spikes, ...run(162, 262, 486)]);

    expect(result.spikeFixes).toBe(2);
    expect(result.vehicleSegments).toBe(0);
    expect(result.distanceM).toBeGreaterThan(783 - MIN_STEP_M);
    expect(result.distanceM).toBeLessThanOrEqual(783.000001);
  });

  it('adds nothing while he stands with a fix every 15 s whose position wanders past the accuracy', () => {
    // The case of round 3, verbatim: noise of ±6 m with an accuracy of 4 m gave 702.48 m instead of 594.00 m.
    const next = jitter(31);
    const stands = every(115_000, 415_000, 1 / 15).map((t) => fix(t, 297 + next() * 6, next() * 6, { speed: 0.1 }));
    const result = measureDistance([...run(0, 100, 0), ...stands, ...run(415, 515, 297)]);

    expect(result.distanceM).toBeCloseTo(594, 6);
    expect(result.vehicleSegments).toBe(0);
    expect(result.spikeFixes).toBe(0);
  });

  it('marks a gap crossed at vehicle speed that ends in a stand, and counts it', () => {
    // Before the gap he is at 297 m at 99 s; 61 s later he stands at 2000 m: 28 m/s.
    const result = measureDistance([...run(0, 100, 0), ...standing(160, 170, 2000), ...run(170, 270, 2000)]);

    expect(result.vehicleSegments).toBe(1);
    // From 99 s, the time of the fix before the gap, where he is known to have been; not 98 s, the anchor's time
    // (the fix at 99 s was a step of 3 m, too short to count, but he was there).
    expect(result.vehicleDurationMs).toBe(61_000);
    expect(result.distanceM).toBeGreaterThan(2297 - MIN_STEP_M);
    expect(result.distanceM).toBeLessThanOrEqual(2297.000001);
  });

  it('marks a gap crossed at vehicle speed after he stood ten minutes before it', () => {
    // From the time of the last fix he ran to, the gap would be 1700 m in eleven minutes, a walk.
    const result = measureDistance([...run(0, 100, 0), ...standing(100, 700, 297), ...standing(760, 770, 2000), ...run(770, 870, 2000)]);

    expect(result.vehicleSegments).toBe(1);
    expect(result.vehicleDurationMs).toBe(61_000);
    expect(result.distanceM).toBeGreaterThan(2297 - MIN_STEP_M);
  });

  it('counts a spike held just before such a gap as a spike, not as part of the vehicle', () => {
    const fixes = [...run(0, 100, 0), fix(100_000, 300, 80), ...standing(160, 170, 2000), ...run(170, 270, 2000)];
    const result = measureDistance(fixes);

    expect(result.spikeFixes).toBe(1);
    expect(result.vehicleSegments).toBe(1);
    expect(result.distanceM).toBeLessThanOrEqual(2297.000001);
  });

  it('marks a drive that starts right as the gap ends, drops none of its fixes, and counts it', () => {
    const result = measureDistance([...run(0, 100, 0), ...straight(160, 200, 20, 480)]);

    expect(result.vehicleSegments).toBe(1);
    expect(result.spikeFixes).toBe(0);
    expect(result.vehicleDurationMs).toBe(39_000);
    expect(result.distanceM).toBeGreaterThan(1260 - 0.000001);
    expect(result.distanceM).toBeLessThanOrEqual(1260.000001);
  });

  it('keeps one drive one stretch when the signal is lost while the car keeps going', () => {
    const drive = straight(100, 220, 20, 297).filter((f) => f.t < 140_000 || f.t >= 155_000);
    const result = measureDistance([...run(0, 100, 0), ...drive, ...run(220, 260, 2697)]);

    expect(result.vehicleSegments).toBe(1);
    // From 100 s, the fix the first step at 20 m/s leaves, to 220 s, the first fix of the run, which is itself still
    // reached 20 m from the drive's last fix in one second.
    expect(result.vehicleDurationMs).toBe(120_000);
    expect(result.distanceM).toBeGreaterThan(2814 - MIN_STEP_M);
    expect(result.distanceM).toBeLessThanOrEqual(2814.000001);
  });

  it('starts a drive where the stand clock is, after a stand and after a gap that ends in one', () => {
    // A drive is marked from the last time he was known to be where its speed is measured from.
    const plain = measureDistance([...run(0, 100, 0), ...standing(100, 160, 297), ...straight(160, 200, 20, 317)]);
    const afterGap = measureDistance([...run(0, 100, 0), ...standing(160, 170, 480), ...straight(170, 210, 20, 500)]);

    expect(plain.vehicleSegments).toBe(1);
    expect(plain.vehicleDurationMs).toBe(40_000);
    expect(afterGap.vehicleSegments).toBe(1);
    expect(afterGap.vehicleDurationMs).toBe(40_000);
    expect(afterGap.distanceM).toBeGreaterThan(297 + 183 + 780 - MIN_STEP_M);
  });

  it('measures a second gap from where he stands after the first, not from the anchor before both', () => {
    // 297 m at 99 s, then 1000 m at 160 s (11.5 m/s, a runner), then 15 s later 10 m further on.
    const second = measureDistance([...run(0, 100, 0), ...standing(160, 170, 1000), ...standing(185, 195, 1010), ...run(195, 295, 1010)]);
    // The same, but the second gap was a drive of 2000 m: the bridge from the anchor across both gaps counts.
    const drive = measureDistance([...run(0, 100, 0), ...standing(160, 170, 1000), ...standing(185, 195, 3000), ...run(195, 295, 3000)]);

    expect(second.vehicleSegments).toBe(0);
    expect(second.distanceM).toBeGreaterThan(1307 - MIN_STEP_M);
    expect(drive.vehicleSegments).toBe(1);
    expect(drive.distanceM).toBeGreaterThan(3297 - MIN_STEP_M);
    expect(drive.distanceM).toBeLessThanOrEqual(3297.000001);
  });

  it('drops a spike two fixes after a gap that ends in a stand, after a step too short to count', () => {
    // The anchor is at 294 m. He stands at 296 m after the gap, then takes a step of 4 m from the anchor, too short to
    // count, so the stand clock is still the time of the stand; from the time before the gap the spike would be a walk.
    const fixes = [...run(0, 100, 0), fix(160_000, 296, 0, { speed: 0 }), fix(161_000, 298, 0), fix(162_000, 298, 80), ...run(163, 263, 300)];
    const result = measureDistance(fixes);

    expect(result.spikeFixes).toBe(1);
    expect(result.distanceM).toBeLessThanOrEqual(597.000001);
    expect(result.distanceM).toBeGreaterThan(597 - MIN_STEP_M);
  });

  it('holds a fix that comes a gap after the one it confirmed, so a spike there is dropped', () => {
    // 480 m at 160 s is real; 15 s later a fix 80 m off is confirmed by nothing.
    const fixes = [...run(0, 100, 0), fix(160_000, 480, 0), fix(175_000, 525, 80), ...run(176, 276, 528)];
    const result = measureDistance(fixes);

    expect(result.spikeFixes).toBe(1);
    expect(result.distanceM).toBeLessThanOrEqual(825.000001);
    expect(result.distanceM).toBeGreaterThan(825 - MIN_STEP_M);
  });

  it('keeps one drive one stretch when the car stands at a light, with no gap', () => {
    // A fix of standing never ends a drive. The first fix after the light is already 20 m on, so nothing else ends it either.
    const fixes = [...run(0, 100, 0), ...straight(100, 160, 20, 297), ...standing(160, 180, 1477), ...straight(180, 240, 20, 1497), ...run(240, 300, 2677)];
    const result = measureDistance(fixes);

    expect(result.vehicleSegments).toBe(1);
    expect(result.distanceM).toBeGreaterThan(2854 - MIN_STEP_M);
    expect(result.distanceM).toBeLessThanOrEqual(2854.000001);
  });

  it('drops a spike that is the first fix after a gap and the session ends with the fix after it', () => {
    const result = measureDistance([...run(0, 100, 0), fix(200_000, 497, 80), fix(201_000, 500, 0)]);

    expect(result.spikeFixes).toBe(1);
    expect(result.distanceM).toBeGreaterThan(500 - MIN_STEP_M);
    expect(result.distanceM).toBeLessThanOrEqual(500.000001);
  });

  it('adds no bridge at the end of the session when he stands, after a gap, where the anchor is', () => {
    // The anchor is at 294 m (the fix at 297 m was a step too short to count); 5 m from it is no step either.
    const result = measureDistance([...run(0, 100, 0), ...standing(160, 170, 299)]);

    expect(result.distanceM).toBeCloseTo(294, 6);
  });
});

describe('properties over random sessions, fixed seeds', () => {
  const SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i);
  const u01 = (next: () => number) => (next() + 1) / 2;
  const between = (next: () => number, lo: number, hi: number) => lo + u01(next) * (hi - lo);
  /** A point uniformly inside a circle of `radiusM` around `eastM`, 0. */
  const within = (next: () => number, eastM: number, radiusM: number) => {
    const r = radiusM * Math.sqrt(u01(next));
    const a = u01(next) * 2 * Math.PI;
    return [eastM + r * Math.cos(a), r * Math.sin(a)] as const;
  };

  /**
   * Fixes of a runner who stands at `eastM` from `fromMs`: Doppler below the stand speed, every position within the
   * reported accuracy, and fixes a second apart, a few seconds apart, or further apart than a gap, in any mix.
   */
  const stand = (next: () => number, fromMs: number, count: number, eastM: number, accuracy: number) => {
    const out: ReturnType<typeof fix>[] = [];
    let t = fromMs;
    for (let i = 0; i < count; i += 1) {
      const [e, n] = within(next, eastM, accuracy);
      out.push(fix(t, e, n, { speed: u01(next) * STATIONARY_SPEED_MPS * 0.98, accuracy }));
      const p = u01(next);
      t += Math.round(p < 0.4 ? 1000 : p < 0.7 ? between(next, 2000, 9000) : between(next, GAP_MS + 1000, 45_000));
    }
    return { fixes: out, endMs: t };
  };

  it('a runner who stands the whole session adds no more than one bridge, however sparse his fixes and however many gaps', () => {
    for (const seed of SEEDS) {
      const next = jitter(seed);
      const accuracy = Math.round(between(next, 3, 10));
      const { fixes } = stand(next, 0, Math.round(between(next, 20, 80)), 500, accuracy);

      const result = measureDistance(fixes);

      expect({ seed, d: result.distanceM <= 2 * accuracy, vehicles: result.vehicleSegments }).toEqual({ seed, d: true, vehicles: 0 });
    }
  });

  it('a stand between two runs adds no more than one bridge to the runs, however sparse and gapped', () => {
    for (const seed of SEEDS) {
      const next = jitter(seed);
      const accuracy = Math.round(between(next, 3, 10));
      const { fixes: stands, endMs } = stand(next, 100_000, Math.round(between(next, 10, 40)), 297, accuracy);
      const fromS = Math.ceil(endMs / 1000);
      const fixes = [...run(0, 100, 0), ...stands, ...run(fromS, fromS + 100, 297)];
      // Both runs are straight lines east: 297 m, then 297 m from the place where he stood.
      const result = measureDistance(fixes);

      expect({ seed, low: result.distanceM >= 594 - 2 * MIN_STEP_M, high: result.distanceM <= 594 + 2 * accuracy }).toEqual({ seed, low: true, high: true });
      expect({ seed, vehicles: result.vehicleSegments }).toEqual({ seed, vehicles: 0 });
    }
  });

  /**
   * Ten minutes a second at a time of a runner on foot, east: stretches of running at 2 to 5 m/s and of standing,
   * single spikes 80 to 150 m off with a believable Doppler speed while he runs, and fixes repeated at the same
   * instant. No vehicle. Spikes only while he runs: three spikes during one stand are a vehicle without any gap,
   * because a fix of standing does not settle the held ones, and that is not this property.
   */
  const onFoot = (next: () => number) => {
    const out: ReturnType<typeof fix>[] = [];
    let eastM = 0;
    // Nothing odd in the first seconds: the first fix of a session is the anchor, whatever it is.
    let odd = 0;
    let modeLeftS = 0;
    let speed = 3;
    for (let s = 0; s < 600; s += 1) {
      if (modeLeftS <= 0) {
        modeLeftS = Math.round(between(next, 10, 60));
        speed = u01(next) < 0.35 ? 0 : between(next, 2, 5);
      }
      modeLeftS -= 1;
      eastM += speed;
      const t = s * 1000;
      const [e, n] = speed === 0 ? within(next, eastM, 4) : [eastM, 0];
      const doppler = speed === 0 ? 0.1 : speed;
      const p = u01(next);
      if (p < 0.03 && s - odd > 4 && speed > 0) {
        out.push(fix(t, eastM, between(next, 80, 150), { speed: doppler === 0.1 ? 3 : doppler }));
        odd = s;
      } else {
        out.push(fix(t, e, n, { speed: doppler }));
        if (p > 0.98 && s - odd > 4) {
          out.push(fix(t, e, n, { speed: doppler }));
          odd = s;
        }
      }
    }
    return out;
  };

  it('taking fixes out, so that the signal has gaps, never makes a vehicle out of a runner on foot', () => {
    for (const seed of SEEDS) {
      const next = jitter(seed);
      const fixes = onFoot(next);
      const windows = Array.from({ length: 1 + Math.floor(u01(next) * 3) }, () => {
        // Every window ends before the session does, so that the gapped session ends where the continuous one does.
        const from = Math.round(between(next, 20_000, 500_000));
        return [from, from + Math.round(between(next, GAP_MS + 1000, 90_000))] as const;
      });
      const gapped = fixes.filter((f) => windows.every(([from, to]) => f.t < from || f.t >= to));

      const continuous = measureDistance(fixes);
      const result = measureDistance(gapped);

      expect({ seed, continuous: continuous.vehicleSegments, gapped: result.vehicleSegments }).toEqual({ seed, continuous: 0, gapped: 0 });
      expect({ seed, d: Math.abs(result.distanceM - continuous.distanceM) <= 2 * MIN_STEP_M * (windows.length + 1) }).toEqual({ seed, d: true });
    }
  });

  it('a real drive is marked and counted, with the signal lost before, inside or after it', () => {
    for (const seed of SEEDS) {
      const next = jitter(seed);
      const before = Math.round(between(next, 30, 100));
      const driveS = Math.round(between(next, 60, 120));
      const speed = between(next, 15, 30);
      const fixes = [
        ...run(0, before, 0),
        ...straight(before, before + driveS, speed, 3 * before),
        ...run(before + driveS, before + driveS + 60, 3 * before + speed * driveS),
      ];
      const endM = 3 * before + speed * driveS + 3 * 59;
      const windows = Array.from({ length: Math.floor(u01(next) * 3) }, () => {
        const from = Math.round(between(next, (before - 20) * 1000, (before + driveS + 20) * 1000));
        return [from, from + Math.round(between(next, GAP_MS + 1000, 20_000))] as const;
      });
      const gapped = fixes.filter((f) => windows.every(([from, to]) => f.t < from || f.t >= to));

      const result = measureDistance(gapped);

      expect({ seed, marked: result.vehicleSegments >= 1, low: result.distanceM >= endM - 2 * MIN_STEP_M, high: result.distanceM <= endM + 0.000001 }).toEqual({
        seed,
        marked: true,
        low: true,
        high: true,
      });
    }
  });
});

describe('the cases of round 4 of the review', () => {
  const standing = (fromS: number, toS: number, eastM: number, northM = 0) =>
    every(fromS * 1000, toS * 1000, 1).map((t) => fix(t, eastM, northM, { speed: 0 }));
  /** A run north at 3 m/s from `eastM`, `northM` at `fromS`, one fix a second. */
  const north = (fromS: number, toS: number, eastM: number, northM: number) =>
    every(fromS * 1000, toS * 1000, 1).map((t) => fix(t, eastM, northM + 3 * (t / 1000 - fromS), { speed: 3 }));

  // K1 and K1b: after a gap, spike, real, spike, real (and once more). The rule before this one took the chain as
  // confirming the spike: +97 to +273 m and a vehicle.
  const after = (spikesAt: readonly number[]) =>
    run(160, 264, 480).map((f, i) => (spikesAt.includes(i) ? fix(f.t, 480 + 3 * i, i % 4 === 0 ? 80 : -90) : f));
  it.each([[[0, 2]], [[0, 2, 4]]])('K1: drops the spikes at %j right after a gap and keeps the run between them', (spikesAt) => {
    const control = measureDistance([...run(0, 100, 0), ...after([])]);
    const result = measureDistance([...run(0, 100, 0), ...after(spikesAt)]);

    expect(result.vehicleSegments).toBe(0);
    expect(result.spikeFixes).toBe(spikesAt.length);
    expect(Math.abs(result.distanceM - control.distanceM)).toBeLessThanOrEqual(MIN_STEP_M);
  });

  it('K3: adds nothing for a spike with a Doppler speed of standing, to a man who stands, and nothing when he runs on', () => {
    const before = [...run(0, 100, 0), ...standing(100, 130, 297)];
    const spike = fix(190_000, 297, 150, { speed: 0 });
    const stand = standing(191, 200, 297);
    const control = measureDistance([...before, ...standing(190, 200, 297)]);
    const controlRun = measureDistance([...before, ...standing(190, 200, 297), ...run(200, 261, 297)]);

    const spiked = measureDistance([...before, spike, ...stand]);
    const spikedRun = measureDistance([...before, spike, ...stand, ...run(200, 261, 297)]);

    expect(control.distanceM).toBeCloseTo(294, 6);
    expect(controlRun.distanceM).toBeGreaterThan(470);
    expect(spiked.distanceM).toBeCloseTo(control.distanceM, 6);
    expect(spikedRun.distanceM).toBeCloseTo(controlRun.distanceM, 6);
    expect([spiked.vehicleSegments, spiked.spikeFixes, spikedRun.vehicleSegments, spikedRun.spikeFixes]).toEqual([0, 1, 0, 1]);
  });

  it('K2: measures the way through a place where he stood between two gaps, on a path that turns', () => {
    // 297 m east at 99 s; standing at (700, 400) from 160 s; running north from (297, 800) at 230 s. A straight line from
    // before the first gap to after the second would be 800 m instead of 1136 m.
    const result = measureDistance([...run(0, 100, 0), ...standing(160, 170, 700, 400), ...north(230, 330, 297, 800)]);
    const truth = 294 + leg([294, 0], [700, 400]) + leg([700, 400], [297, 800]) + 294;

    expect(result.vehicleSegments).toBe(0);
    expect(result.distanceM).toBeGreaterThan(truth - MIN_STEP_M);
    expect(result.distanceM).toBeLessThanOrEqual(truth + MIN_STEP_M);
  });

  it('K2b: and through two such places, the first held by two fixes a gap apart', () => {
    const fixes = [
      ...run(0, 100, 0),
      fix(140_000, 600, 300, { speed: 0 }),
      fix(155_000, 600, 300, { speed: 0 }),
      ...standing(200, 203, 400, 700),
      ...north(260, 360, 100, 900),
    ];
    const truth = 294 + leg([294, 0], [600, 300]) + leg([600, 300], [400, 700]) + leg([400, 700], [100, 900]) + 294;

    const result = measureDistance(fixes);

    expect(result.vehicleSegments).toBe(0);
    expect(result.distanceM).toBeGreaterThan(truth - MIN_STEP_M);
    expect(result.distanceM).toBeLessThanOrEqual(truth + MIN_STEP_M);
  });
});

describe('what tells a spike from a drive, and a trip away from a place he went to', () => {
  const standing = (fromS: number, toS: number, eastM: number, northM = 0, hz = 1) =>
    every(fromS * 1000, toS * 1000, hz).map((t) => fix(t, eastM, northM, { speed: 0.1 }));

  it('drops fixes at the end of a session that jump ahead of a runner whose Doppler speed says he runs', () => {
    // Four fixes 45 m ahead and moving with him: no drive, because his own Doppler speed rules out the jump.
    const ahead = every(100_000, 104_000, 1).map((t) => fix(t, 3 * (t / 1000) + 45, 0, { speed: 3 }));
    const result = measureDistance([...run(0, 100, 0), ...ahead]);

    expect(result.vehicleSegments).toBe(0);
    expect(result.spikeFixes).toBe(4);
    expect(result.distanceM).toBeCloseTo(294, 6);
  });

  it('marks three fixes in a row at vehicle speed as a drive, though a runner could have covered the whole stretch', () => {
    // 150 m at 50 s, then 170, 190 and 210 m a second apart at 20 m/s, then a run from 213 m at 56 s: from 50 s to 56 s
    // is 63 m in 6 s, a runner's speed, but each of the three steps is a car's, with a car's Doppler speed.
    const fixes = [...run(0, 50, 0), fix(50_000, 150, 0, { speed: 0.1 }), ...straight(51, 54, 20, 170), ...run(56, 100, 213)];
    const result = measureDistance(fixes);

    expect(result.vehicleSegments).toBe(1);
    expect(result.spikeFixes).toBe(0);
  });

  it('counts and marks a drive across a gap that leaves only two fixes before it', () => {
    // Two fixes at the start, then the next one 397 m on, 29 s later: dropping the two would be cheaper than a drive
    // that begins like any other.
    const result = measureDistance([...run(0, 2, 0), ...run(30, 90, 400)]);

    expect(result.vehicleSegments).toBe(1);
    expect(result.vehicleDurationMs).toBe(29_000);
    expect(result.distanceM).toBeGreaterThan(400 + 174 - 0.000001);
  });

  it('drops a trip away that the session ends coming back from, though the trip has more fixes than the return', () => {
    // A fix every 5 s at one place, then three fixes 142 m off, then the session ends on one back at the place.
    const trip = [312, 319, 333].map((s) => fix(s * 1000, -90, -110, { speed: 0.1 }));
    const result = measureDistance([...standing(0, 300, 0, 0, 1 / 5), ...trip, fix(339_000, 0, 0, { speed: 0.1 })]);

    expect(result.distanceM).toBe(0);
    expect(result.spikeFixes).toBe(3);
  });

  it('keeps the real fixes between two spikes at one place, which only look like a trip away', () => {
    const spike = (s: number, eastM: number, northM: number) => fix(s * 1000, eastM, northM, { speed: 0.1 });
    const fixes = [...standing(0, 60, 0), spike(60, -120, -95), spike(61, -120, -95), ...standing(62, 71, 0), spike(71, -54, -67)];
    const result = measureDistance(fixes);

    expect(result.distanceM).toBe(0);
    expect(result.spikeFixes).toBe(3);
  });

  it('measures a gap by the signal, not by the fixes left once the spikes are taken out', () => {
    // Five spikes 31 s after he last stood here, then one more elsewhere 5 s later, then 31 s with no fix at all. Once
    // the five are out, the sixth looks like a place between two long gaps, but the signal was never silent before it.
    const burst = every(131_000, 136_000, 1).map((t) => fix(t, -90, 115, { speed: 0.1 }));
    const result = measureDistance([...standing(0, 101, 0), ...burst, fix(140_000, 80, 0, { speed: 0.1 }), ...standing(171, 200, 0)]);

    expect(result.distanceM).toBe(0);
    expect(result.spikeFixes).toBe(6);
  });

  it('counts a place he walked to and back from across two long gaps as a place he went to', () => {
    const walk = (fromS: number, toS: number, eastM: number, northM: number) =>
      every(fromS * 1000, toS * 1000, 1).map((t) => fix(t, eastM + 1.5 * (t / 1000 - fromS), northM, { speed: 1.5 }));
    // Out 80 m north during a minute without a fix, five fixes there, back during another minute; and the same with
    // three fixes of standing there, which would be a trip of spikes but for the two long gaps.
    const moving = measureDistance([...walk(0, 100, 0, 0), ...walk(160, 165, 150, 80), ...walk(225, 260, 150, 0)]);
    const stood = measureDistance([...walk(0, 100, 0, 0), ...standing(160, 163, 150, 80), ...walk(225, 260, 150, 0)]);
    const not = measureDistance([...walk(0, 100, 0, 0), ...walk(225, 260, 150, 0)]);

    expect([moving.spikeFixes, stood.spikeFixes]).toEqual([0, 0]);
    expect(moving.distanceM - not.distanceM).toBeGreaterThan(2 * 80 - 2 * MIN_STEP_M);
    expect(stood.distanceM - not.distanceM).toBeGreaterThan(2 * 80 - 2 * MIN_STEP_M);
  });

  it('keeps every fix of a man who stands while his position wanders within its accuracy, faster than a runner', () => {
    // Accuracy 8 m, positions 7 m either side of where he stands: 14 m apart a second, faster than a runner unless the
    // two errors are taken off, and then nothing.
    const fixes = every(0, 60_000, 1).map((t, i) => fix(t, i % 2 === 0 ? 7 : -7, 0, { speed: 0.1, accuracy: 8 }));
    const result = measureDistance(fixes);

    expect(result.spikeFixes).toBe(0);
    expect(result.vehicleSegments).toBe(0);
  });

  it('drops a burst of six fixes 100 m off without a Doppler speed, a jump no vehicle makes', () => {
    const plain = (fromS: number, toS: number, eastM: number, northM: number) =>
      every(fromS * 1000, toS * 1000, 1).map((t) => fix(t, eastM + 3 * (t / 1000 - fromS), northM, { speed: undefined }));
    const result = measureDistance([...plain(0, 100, 0, 0), ...plain(100, 106, 300, 100), ...plain(106, 200, 318, 0)]);

    expect(result.vehicleSegments).toBe(0);
    expect(result.spikeFixes).toBe(6);
    expect(result.distanceM).toBeGreaterThan(597 - 2 * MIN_STEP_M);
    expect(result.distanceM).toBeLessThanOrEqual(597.000001);
  });

  it('keeps a loop he ran out and back through a gap, entered and left at a runner speed', () => {
    // 19 fixes of running after a gap of a minute, which end 15 m from where he then stands, 10 m from where he was
    // before the gap.
    const loop = every(280_000, 299_000, 1).map((t) => fix(t, -79 + 2.6 * (t / 1000 - 280), -49 + 2.7 * (t / 1000 - 280), { speed: 4 }));
    const before = every(0, 10_000, 1).map((t) => fix(t, -52 + 3 * (t / 1000), 17, { speed: 3 }));
    const fixes = [...before, ...loop, ...standing(306, 360, -33, 17)];
    const result = measureDistance(fixes);

    expect(result.spikeFixes).toBe(0);
    expect(result.distanceM).toBeGreaterThan(24 + leg([-25, 17], [-79, -49]) + 18 * 3.7 - 3 * MIN_STEP_M);
  });
});

describe('properties against the true path, fixed seeds (testing/paths.ts)', () => {
  const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);
  /**
   * What the fixes can know at best (`idealM`), within 2 % of it and two shortest steps per gap and per stand: corners
   * cut by the shortest step, GPS error, and the step left over at either end of a stand or a gap.
   */
  const tolerance = (t: Truth) => 0.02 * t.idealM + 2 * MIN_STEP_M * (1 + t.gaps + t.stands);
  const sessions = (profile: Profile) => SEEDS.map((seed) => ({ seed, ...session(seed, { ...profile, quietEndFixes: 10 }) }));

  it.each([
    ['on foot', ON_FOOT],
    ['with a drive', WITH_DRIVE],
    ['with no gap', NO_GAP],
    ['standing', STANDING],
  ] as const)('%s: the length is within its tolerance of the true path, and a vehicle is marked exactly when there was one', (_, profile) => {
    const wrong = sessions(profile).flatMap(({ seed, fixes, truth }) => {
      const result = measureDistance(fixes);
      const out: string[] = [];
      if (Math.abs(result.distanceM - truth.idealM) > tolerance(truth)) out.push(`${seed}: ${result.distanceM.toFixed(1)} m against ${truth.idealM.toFixed(1)} m`);
      if (truth.noVehicle && result.vehicleSegments > 0) out.push(`${seed}: a vehicle without a drive`);
      if (truth.vehicleVisible && result.vehicleSegments === 0) out.push(`${seed}: a drive not marked`);
      if (truth.standsOnly && result.distanceM > 2 * truth.accuracy) out.push(`${seed}: ${result.distanceM.toFixed(1)} m to a man who stands`);
      return out;
    });

    expect(wrong).toEqual([]);
  });

  it('the generator holds every state it claims, so that no property is met by leaving one out', () => {
    const all = [ON_FOOT, WITH_DRIVE, NO_GAP, STANDING].flatMap((p) => sessions(p));

    expect(all.some((s) => s.truth.standsOnly)).toBe(true);
    expect(all.some((s) => s.truth.vehicleVisible && s.truth.gaps > 0)).toBe(true);
    expect(all.filter((s) => s.truth.gaps > 0).length).toBeGreaterThan(all.length / 3);
    expect(all.some((s) => s.fixes.some((f, i) => s.fixes.some((g, j) => j !== i && g.t === f.t)))).toBe(true);
    expect(all.some((s) => s.fixes.some((f) => (f.accuracy as number) > MAX_ACCURACY_M))).toBe(true);
  });
});

const leg = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);

describe('a mock location', () => {
  it('counts the distance and exposes the fixes Android marked as mock', () => {
    const fixes = straight(0, 100).map((f, i) => ({ ...f, mock: i % 2 === 0 }));

    const result = measureDistance(fixes);

    expect(result.mockFixes).toBe(50);
    expect(result.distanceM).toBeGreaterThan(290);
  });
});

it('answers an empty session with nothing', () => {
  expect(measureDistance([])).toEqual({
    distanceM: 0,
    poorFixes: 0,
    spikeFixes: 0,
    vehicleSegments: 0,
    vehicleDurationMs: 0,
    mockFixes: 0,
    lastFixT: null,
    lastFixPoor: false,
  });
});
