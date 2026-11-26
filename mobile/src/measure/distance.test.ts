import { measureDistance, MAX_ACCURACY_M } from './distance';
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

  it('adds no distance for a stretch at vehicle speed and exposes how many and how long', () => {
    const fixes = [...straight(0, 100), ...straight(100, 160, 20, 300), ...straight(160, 260, 3, 1500)];

    const result = measureDistance(fixes);

    expect(result.distanceM).toBeGreaterThan(590);
    expect(result.distanceM).toBeLessThan(610);
    expect(result.vehicleSegments).toBe(1);
    expect(result.vehicleDurationMs).toBeGreaterThanOrEqual(58_000);
    expect(result.vehicleDurationMs).toBeLessThanOrEqual(62_000);
  });

  it('closes a vehicle stretch that lasts to the end of the session', () => {
    const fixes = [...straight(0, 100), ...straight(100, 131, 20, 300)];

    const result = measureDistance(fixes);

    expect(result.vehicleSegments).toBe(1);
    expect(result.vehicleDurationMs).toBe(30_000);
    expect(result.spikeFixes).toBe(0);
  });

  it('counts the last fixes of a drive that ends with the session before they are confirmed', () => {
    const fixes = [...straight(0, 100), ...straight(100, 132, 20, 300)];

    const result = measureDistance(fixes);

    expect(result.vehicleDurationMs).toBe(31_000);
    expect(result.spikeFixes).toBe(0);
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
