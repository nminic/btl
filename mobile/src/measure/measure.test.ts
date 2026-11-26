import { measure, SIGNAL_LOST_MS } from './measure';
import { Recording, type SessionMeta } from './recording';
import { every, fix, pressure } from './testing/synth';

function recording(pressureSensor: boolean): Recording & { meta: SessionMeta } {
  const r = new Recording();
  r.meta = { pressureSensor, startedAtWallMs: 0, startedAt: 0 };
  return r as Recording & { meta: SessionMeta };
}

describe('the GPS state', () => {
  it('is searching before the first fix', () => {
    expect(measure(recording(true), 50_000).gps).toBe('searching');
  });

  it('is good while good fixes keep coming', () => {
    const r = recording(true);
    r.locations.push(fix(40_000, 0, 0));

    expect(measure(r, 40_000 + SIGNAL_LOST_MS).gps).toBe('good');
  });

  it('is lost once the last fix is older than the limit, measured on the samples clock', () => {
    const r = recording(true);
    r.locations.push(fix(40_000, 0, 0));

    expect(measure(r, 40_001 + SIGNAL_LOST_MS).gps).toBe('lost');
  });

  it('is poor when the latest fix is too inaccurate to count', () => {
    const r = recording(true);
    r.locations.push(fix(40_000, 0, 0), fix(41_000, 0, 0, { accuracy: 35 }));

    expect(measure(r, 41_000).gps).toBe('poor');
  });
});

it('carries distance, elevation and what is suspicious from the samples', () => {
  const r = recording(true);
  every(0, 200_000, 1).forEach((t, i) => r.locations.push(fix(t, 3 * i, 0, { mock: i === 0 })));
  every(0, 200_000, 5).forEach((t) => r.pressures.push(pressure(t, Math.min(10, t / 10_000))));

  const result = measure(r, 200_000);

  expect(result.distanceM).toBeGreaterThan(590);
  expect(result.elevation).toEqual({ status: 'measured', ascentM: expect.closeTo(10, 1), descentM: 0 });
  expect(result.suspicious).toEqual({ vehicleSegments: 0, vehicleDurationMs: 0, mockFixes: 1 });
});

it('reads the absence of a pressure sensor from the session the service wrote', () => {
  expect(measure(recording(false), 0).elevation).toEqual({ status: 'noPressureSensor' });
});
