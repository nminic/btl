import { ELEVATION_HYSTERESIS_M, measureElevation, pressureToAltitudeM } from './elevation';
import { every, fix, hPaAt, jitter, pressure } from './testing/synth';
import type { LocationSample, PressureSample } from './recording';

/** Pressure at 5 Hz over [fromS, toS) following `altitude(seconds)`. */
function barometer(fromS: number, toS: number, altitude: (s: number) => number): PressureSample[] {
  return every(fromS * 1000, toS * 1000, 5).map((t) => pressure(t, altitude(t / 1000)));
}

/** One fix a second over [fromS, toS) with Doppler `speed`; position is irrelevant to elevation. */
function doppler(fromS: number, toS: number, speed: number, gpsAltitude?: (s: number) => number): LocationSample[] {
  return every(fromS * 1000, toS * 1000, 1).map((t) =>
    fix(t, speed * (t / 1000), 0, { speed, altitude: gpsAltitude?.(t / 1000) }),
  );
}

const NOTHING = { status: 'measured', ascentM: 0, descentM: 0, verticalSegments: 0, verticalDurationMs: 0 };

function measured(result: ReturnType<typeof measureElevation>) {
  if (result.status !== 'measured') throw new Error(`expected a measurement, got ${result.status}`);
  return result;
}

it('turns pressure into altitude by the standard atmosphere', () => {
  expect(pressureToAltitudeM(1013.25)).toBe(0);
  expect(pressureToAltitudeM(hPaAt(250))).toBeCloseTo(250, 6);
});

describe('a pressure sensor and none', () => {
  it('says there is no sensor and does not fall back to GPS altitude, however it climbs', () => {
    const fixes = doppler(0, 600, 3, (s) => s / 12);

    expect(measureElevation(false, [], fixes)).toEqual({ status: 'noPressureSensor' });
  });

  it('with a sensor and flat pressure measures nothing, while GPS altitude jumps by twenty metres', () => {
    const next = jitter(3);
    const fixes = doppler(0, 600, 3, () => next() * 20);

    expect(measureElevation(true, barometer(0, 600, () => 120), fixes)).toEqual({
      status: 'measured',
      ascentM: 0,
      descentM: 0,
      verticalSegments: 0,
      verticalDurationMs: 0,
    });
  });

  it('with a sensor and no samples yet measures nothing', () => {
    expect(measureElevation(true, [], [])).toEqual(NOTHING);
  });
});

describe('standing and moving', () => {
  it('counts nothing when the weather moves pressure by 1 hPa over three hours while the runner stands', () => {
    const fixes = doppler(0, 3 * 3600, 0.1);
    const pressures = every(0, 3 * 3600 * 1000, 1).map((t) => ({ t, hPa: 1000 - t / (3 * 3600 * 1000), receivedAt: t }));

    expect(measureElevation(true, pressures, fixes)).toEqual(NOTHING);
  });

  it('counts nothing for the same drift with sensor noise of half a metre, which the short window sees as motion', () => {
    const next = jitter(5);
    const fixes = doppler(0, 3600, 0.1);
    const pressures = every(0, 3600 * 1000, 5).map((t) => pressure(t, 100 - t / 3_600_000 * 8 + next() * 0.5));

    expect(measureElevation(true, pressures, fixes)).toEqual(NOTHING);
  });

  it('counts the same kind of change when the runner moves', () => {
    const result = measured(measureElevation(true, barometer(0, 300, (s) => Math.min(10, s / 10)), doppler(0, 300, 3)));

    expect(result.ascentM).toBeCloseTo(10, 1);
    expect(result.descentM).toBe(0);
  });

  it('counts a steep climb at 0.3 m/s horizontally, which Doppler alone would call standing', () => {
    const climb = (s: number) => Math.min(30, Math.max(0, (s - 60) * 0.1));
    const result = measured(measureElevation(true, barometer(0, 500, climb), doppler(0, 500, 0.3)));

    expect(result.ascentM).toBeGreaterThan(29);
    expect(result.ascentM).toBeLessThanOrEqual(30.01);
    // Climbing along a trail, not without moving on: no mark.
    expect(result.verticalSegments).toBe(0);
    expect(result.verticalDurationMs).toBe(0);
  });

  it('counts a gentle gradient run fast, which the rate alone would call weather', () => {
    const result = measured(measureElevation(true, barometer(0, 1000, (s) => s * 0.005), doppler(0, 1000, 3)));

    expect(result.ascentM).toBeCloseTo(5, 0);
  });

  it('banks a climb when the runner stops at the top, and then ignores the weather there', () => {
    const altitude = (s: number) => (s < 100 ? s * 0.1 : 10 - (s - 100) / 3600);
    const fixes = [...doppler(0, 100, 3), ...doppler(100, 3700, 0)];

    const result = measured(measureElevation(true, barometer(0, 3700, altitude), fixes));

    expect(result.ascentM).toBeCloseTo(10, 0);
    expect(result.descentM).toBe(0);
  });
});

describe('climbing without moving on, and climbing along a way', () => {
  // PDL, „Uspon uz stepenice i liftom se broji, ali se skreće pažnja, isto kao za dužinu".
  const ride = (fromS: number, height: number, seconds: number) => (s: number) =>
    s < fromS ? 0 : Math.min(height, ((s - fromS) / seconds) * height);

  it('counts a lift of 30 m in 20 s whole, standing by Doppler, and marks it', () => {
    const result = measured(measureElevation(true, barometer(0, 200, ride(60, 30, 20)), doppler(0, 200, 0)));

    expect(result.ascentM).toBeCloseTo(30, 0);
    expect(result.verticalSegments).toBe(1);
    expect(result.verticalDurationMs).toBeGreaterThanOrEqual(19_000);
    expect(result.verticalDurationMs).toBeLessThanOrEqual(51_000);
  });

  it('counts stairs indoors, with no fix at all, and marks them', () => {
    const result = measured(measureElevation(true, barometer(0, 200, ride(30, 15, 60)), []));

    expect(result.ascentM).toBeCloseTo(15, 0);
    expect(result.verticalSegments).toBe(1);
  });

  it('marks a lift down as it marks a lift up, and counts the descent', () => {
    const down = (s: number) => 40 - ride(60, 30, 20)(s);
    const result = measured(measureElevation(true, barometer(0, 200, down), doppler(0, 200, 0)));

    expect(result.descentM).toBeCloseTo(30, 0);
    expect(result.verticalSegments).toBe(1);
  });

  it('counts two lift rides as two marks', () => {
    const twice = (s: number) => ride(60, 30, 20)(s) + ride(200, 30, 20)(s);
    const result = measured(measureElevation(true, barometer(0, 400, twice), doppler(0, 400, 0)));

    expect(result.ascentM).toBeCloseTo(60, 0);
    expect(result.verticalSegments).toBe(2);
  });

  it('KNOWN LIMIT: stairs outdoors with a good fix, 0.4 m/s along and 0.25 m/s up, count but get no mark', () => {
    // Stairs are about 30 to 37 degrees, gentler than 1:1, so the criterion takes them for a steep way.
    const result = measured(measureElevation(true, barometer(0, 200, ride(30, 15, 60)), doppler(0, 200, 0.4)));

    expect(result.ascentM).toBeCloseTo(15, 0);
    expect(result.verticalSegments).toBe(0);
  });
});

describe('a lost signal', () => {
  it('counts a slow climb in a tunnel, with no fix at all, as moving', () => {
    const result = measured(measureElevation(true, barometer(0, 1000, (s) => s * 0.01), []));

    expect(result.ascentM).toBeCloseTo(10, 0);
  });

  it('does not take a standing fix from a minute ago as standing now', () => {
    const fixes = doppler(0, 10, 0);
    const result = measured(measureElevation(true, barometer(0, 1000, (s) => s * 0.01), fixes));

    expect(result.ascentM).toBeGreaterThan(9);
  });

  it('reads standing only from good fixes', () => {
    const poorStanding = doppler(0, 1000, 0).map((f) => ({ ...f, accuracy: 50 }));
    const result = measured(measureElevation(true, barometer(0, 1000, (s) => s * 0.01), poorStanding));

    expect(result.ascentM).toBeCloseTo(10, 0);
  });

  it('takes a fix without Doppler speed as moving', () => {
    const noSpeed = doppler(0, 1000, 0).map((f) => ({ ...f, speed: undefined }));
    const result = measured(measureElevation(true, barometer(0, 1000, (s) => s * 0.01), noSpeed));

    expect(result.ascentM).toBeCloseTo(10, 0);
  });
});

describe(`a real climb below and above the ${ELEVATION_HYSTERESIS_M} m threshold`, () => {
  const bump = (height: number) => (s: number) => (s < 50 ? (s / 50) * height : s < 100 ? ((100 - s) / 50) * height : 0);

  it('counts nothing for a bump of 1.5 m up and down', () => {
    expect(measureElevation(true, barometer(0, 200, bump(1.5)), doppler(0, 200, 3))).toEqual({
      status: 'measured',
      ascentM: 0,
      descentM: 0,
      verticalSegments: 0,
      verticalDurationMs: 0,
    });
  });

  it('counts a bump of 2.5 m whole, up and down, not just the threshold', () => {
    const result = measured(measureElevation(true, barometer(0, 200, bump(2.5)), doppler(0, 200, 3)));

    expect(result.ascentM).toBeCloseTo(2.5, 1);
    expect(result.descentM).toBeCloseTo(2.5, 1);
  });

  it('keeps ascent and descent apart on a descent alone', () => {
    const result = measured(measureElevation(true, barometer(0, 300, (s) => 50 - Math.min(20, s / 10)), doppler(0, 300, 3)));

    expect(result.descentM).toBeCloseTo(20, 1);
    expect(result.ascentM).toBe(0);
  });

  it('adds nothing for sensor noise of half a metre on flat ground', () => {
    const next = jitter(4);
    const pressures = every(0, 600_000, 5).map((t) => pressure(t, 80 + next() * 0.5));

    expect(measureElevation(true, pressures, doppler(0, 600, 3))).toEqual(NOTHING);
  });

  it('counts both ways over several hills', () => {
    const hills = (s: number) => 10 * Math.sin((s / 200) * Math.PI) ** 2;
    const result = measured(measureElevation(true, barometer(0, 800, hills), doppler(0, 800, 3)));

    expect(result.ascentM).toBeCloseTo(40, 0);
    expect(result.descentM).toBeCloseTo(40, 0);
  });
});
