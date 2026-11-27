import { measureDistance, MAX_ACCURACY_M, MIN_STEP_M } from './distance';
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
