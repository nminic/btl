import { offset } from '../measure/testing/synth';
import { formatDuration } from './duration';
import { Meter, type MeterView } from './meter';
import { FakeSensors } from './testing/fakeSensors';

const NOTIFICATION = { title: 'title', text: 'text' };

function walkEast(sensors: FakeSensors, fromS: number, toS: number) {
  for (let s = fromS; s < toS; s += 1) {
    sensors.write({ k: 'loc', t: s * 1000, ...offset(3 * s, 0), rx: s * 1000, mock: false, acc: 4, spd: 3 });
  }
}

/** Fixes up to `fixesToS` and pressures up to `pressuresToS`, a second apart, in the order the service writes them. */
function fixesAndPressures(sensors: FakeSensors, fixesToS: number, pressuresToS: number) {
  for (let s = 0; s < Math.max(fixesToS, pressuresToS); s += 1) {
    if (s < fixesToS) walkEast(sensors, s, s + 1);
    if (s < pressuresToS) sensors.write({ k: 'prs', t: s * 1000, hpa: 1000, rx: s * 1000 });
  }
}

const duration = (view: MeterView) => (view.phase === 'recording' || view.phase === 'stopped' ? view.durationMs : NaN);

describe('while the session records', () => {
  it('lasts from when the session began, not from when the screen opened on it', () => {
    // Begun at 100 s on the samples' clock; the app is opened on it at 400 s.
    const sensors = new FakeSensors();
    sensors.recording = true;
    sensors.writeMeta(100_000);
    walkEast(sensors, 100, 400);
    sensors.now = 400_000;
    const meter = new Meter(sensors, async () => true, NOTIFICATION);

    const view = meter.open();
    expect(view.phase).toBe('recording');
    expect(duration(view)).toBe(300_000);

    sensors.now = 401_000;
    expect(duration(meter.tick())).toBe(301_000);
  });

  it('counts the time Android had the service down, as the same session', () => {
    // PDL, „Kad Android ubije servis za merenje, servis se sam podiže i nastavlja ISTO merenje".
    const unbroken = new FakeSensors();
    unbroken.recording = true;
    unbroken.writeMeta(100_000);
    walkEast(unbroken, 100, 400);
    unbroken.now = 400_000;

    const killed = new FakeSensors();
    killed.recording = true;
    killed.writeMeta(100_000);
    walkEast(killed, 100, 200);
    // Down from 200 to 260 s: nothing written. Started again: the same file goes on.
    walkEast(killed, 260, 400);
    killed.now = 400_000;

    expect(duration(new Meter(killed, async () => true, NOTIFICATION).open())).toBe(300_000);
    expect(duration(new Meter(unbroken, async () => true, NOTIFICATION).open())).toBe(300_000);
  });

  it('is a second old when nothing but the meta line was written yet', async () => {
    const sensors = new FakeSensors();
    const meter = new Meter(sensors, async () => true, NOTIFICATION);
    await meter.start();
    sensors.writeMeta(20_000);
    sensors.now = 21_000;

    expect(duration(meter.tick())).toBe(1_000);
  });
});

describe('once the session ended', () => {
  it('lasts until the last line written into it, however late the app is opened on it', () => {
    const sensors = new FakeSensors();
    sensors.writeMeta(0);
    walkEast(sensors, 0, 101);
    sensors.now = 5_000_000;

    const view = new Meter(sensors, async () => true, NOTIFICATION).open();

    expect(view.phase).toBe('stopped');
    expect(duration(view)).toBe(100_000);
  });

  it('lasts until the member stopped it', async () => {
    const sensors = new FakeSensors();
    const meter = new Meter(sensors, async () => true, NOTIFICATION);
    await meter.start();
    sensors.writeMeta(10_000);
    walkEast(sensors, 10, 71);
    sensors.now = 70_400;
    expect(duration(meter.tick())).toBe(60_400);

    const stopped = meter.stop();
    sensors.now = 900_000;

    expect(stopped.phase).toBe('stopped');
    expect(duration(stopped)).toBe(60_000);
    expect(duration(meter.tick())).toBe(60_000);
  });

  it('takes the last line of either kind: pressure after the last fix, and a fix after the last pressure', () => {
    const later = new FakeSensors();
    later.writeMeta(0);
    fixesAndPressures(later, 101, 201);
    later.now = 9_000_000;

    const earlier = new FakeSensors();
    earlier.writeMeta(0);
    fixesAndPressures(earlier, 151, 51);
    earlier.now = 9_000_000;

    const a = new Meter(later, async () => true, NOTIFICATION).open();
    const b = new Meter(earlier, async () => true, NOTIFICATION).open();
    expect(duration(a)).toBe(200_000);
    expect(duration(b)).toBe(150_000);
    // Read as one session each: nothing in them looked like a restart.
    expect(a.phase === 'stopped' && a.measures.samples).toEqual({ locations: 101, pressures: 201 });
    expect(b.phase === 'stopped' && b.measures.samples).toEqual({ locations: 151, pressures: 51 });
  });

  it('ended by a restart of the phone, lasts until the last line before the restart', () => {
    // PDL, „Kad se telefon usred merenja restartuje, merenje se završava".
    const sensors = new FakeSensors();
    sensors.recording = true;
    sensors.writeMeta(0);
    walkEast(sensors, 0, 1800);
    // After the restart the clock begins again from zero, and the service wrote on for another half hour.
    walkEast(sensors, 0, 1800);
    sensors.now = 5_000_000;

    const view = new Meter(sensors, async () => true, NOTIFICATION).open();

    expect(view.phase).toBe('stopped');
    expect(duration(view)).toBe(1_799_000);
    expect(formatDuration(duration(view))).toBe('29:59');
  });
});

it('writes whole seconds as a watch does', () => {
  expect(formatDuration(0)).toBe('0:00');
  expect(formatDuration(999)).toBe('0:00');
  expect(formatDuration(59_999)).toBe('0:59');
  expect(formatDuration(65_000)).toBe('1:05');
  expect(formatDuration(3_599_999)).toBe('59:59');
  expect(formatDuration(3_600_000)).toBe('1:00:00');
  expect(formatDuration(3_725_000)).toBe('1:02:05');
  expect(formatDuration(36_000_000)).toBe('10:00:00');
});
