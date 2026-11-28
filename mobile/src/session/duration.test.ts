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
    expect(duration(stopped)).toBe(60_400);
    expect(duration(meter.tick())).toBe(60_400);
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

describe('ended by the member, it lasts until the moment of the stop', () => {
  // PDL, „Kraj merenja je trenutak kad ga član zaustavi, i trajanje završenog merenja je tačno ono što je tajmer
  // pokazivao u tom trenutku".
  const MIN = 60_000;

  it('the timer showed 40:00 when the GPS was gone since 30:00 and there is no barometer: stopped, it still says 40:00', async () => {
    const sensors = new FakeSensors();
    sensors.pressureSensor = false;
    const meter = new Meter(sensors, async () => true, NOTIFICATION);
    await meter.start();
    sensors.writeMeta(0);
    walkEast(sensors, 0, 1800);
    sensors.now = 40 * MIN;
    expect(duration(meter.tick())).toBe(40 * MIN);

    const stopped = meter.stop();

    expect(stopped.phase).toBe('stopped');
    expect(duration(stopped)).toBe(40 * MIN);
    expect(formatDuration(duration(stopped))).toBe('40:00');
    sensors.now = 9 * 60 * MIN;
    expect(duration(meter.tick())).toBe(40 * MIN);
  });

  it('with the service down since 30:00 when the member stops, in 40:00, the time it was down is inside', () => {
    const sensors = new FakeSensors();
    sensors.recording = true;
    sensors.pressureSensor = false;
    sensors.writeMeta(0);
    walkEast(sensors, 0, 1800);
    // Android killed the service at 30:00; the app is opened on it at 35:00 and asks for it again, and it does not come up.
    sensors.now = 35 * MIN;
    const meter = new Meter(sensors, async () => true, NOTIFICATION);
    expect(duration(meter.open())).toBe(35 * MIN);
    expect(sensors.resumed).toBe(1);

    sensors.now = 40 * MIN;
    const stopped = meter.stop();

    expect(duration(stopped)).toBe(40 * MIN);
    // A screen opened on it after the app was closed reads the same end from the file.
    sensors.now = 9 * 60 * MIN;
    const later = new Meter(sensors, async () => true, NOTIFICATION).open();
    expect(later.phase).toBe('stopped');
    expect(duration(later)).toBe(40 * MIN);
  });

  it('is the moment of the stop, not the moment the timer was last drawn', async () => {
    const sensors = new FakeSensors();
    const meter = new Meter(sensors, async () => true, NOTIFICATION);
    await meter.start();
    sensors.writeMeta(0);
    walkEast(sensors, 0, 100);
    sensors.now = 100_000;
    expect(duration(meter.tick())).toBe(100_000);

    sensors.now = 107_500;

    expect(duration(meter.stop())).toBe(107_500);
  });

  it('is the stop on the samples clock, which the wall clock of the phone is not', async () => {
    const sensors = new FakeSensors();
    sensors.wallNow = 1764200000000 + 3_600_000;
    const meter = new Meter(sensors, async () => true, NOTIFICATION);
    await meter.start();
    sensors.writeMeta(1_000_000);
    walkEast(sensors, 1000, 1100);
    sensors.now = 1_130_000;

    expect(duration(meter.stop())).toBe(130_000);
  });

  it('with the stop and the last sample at the same moment is the same either way', async () => {
    const sensors = new FakeSensors();
    const meter = new Meter(sensors, async () => true, NOTIFICATION);
    await meter.start();
    sensors.writeMeta(0);
    walkEast(sensors, 0, 61);
    sensors.now = 60_000;

    expect(duration(meter.stop())).toBe(60_000);
  });

  it('a file written before the stop was written into it ends at its last line, as it did', () => {
    const withEnd = new FakeSensors();
    withEnd.recording = true;
    withEnd.writeMeta(0);
    walkEast(withEnd, 0, 101);
    withEnd.now = 130_000;
    withEnd.stop();

    const without = new FakeSensors();
    without.writeMeta(0);
    walkEast(without, 0, 101);
    without.now = 130_000;

    expect(duration(new Meter(withEnd, async () => true, NOTIFICATION).open())).toBe(130_000);
    expect(duration(new Meter(without, async () => true, NOTIFICATION).open())).toBe(100_000);
  });

  it('a stop of a session that is not recording writes no end into the file of the one before', () => {
    const sensors = new FakeSensors();
    sensors.writeMeta(0);
    walkEast(sensors, 0, 101);
    sensors.now = 500_000;
    const meter = new Meter(sensors, async () => true, NOTIFICATION);

    const view = meter.stop();

    expect(duration(view)).toBe(100_000);
    expect(sensors.file.includes('"k":"end"')).toBe(false);
  });

  it('a stop line that is still half written is not read, and the end is the last sample until the rest of it arrives', () => {
    const sensors = new FakeSensors();
    sensors.recording = true;
    sensors.writeMeta(0);
    walkEast(sensors, 0, 101);
    sensors.file += '{"k":"end","t":130000,"rx":13';
    sensors.recording = false;
    sensors.now = 140_000;
    const meter = new Meter(sensors, async () => true, NOTIFICATION);

    expect(duration(meter.open())).toBe(100_000);

    sensors.file += '0000}\n';
    expect(duration(meter.tick())).toBe(130_000);
  });
});

describe('ended by a restart of the phone, there is no stop and the end is the last sample before it', () => {
  it('a restart the module noticed: the lines after it and the stop it makes are left out', () => {
    const sensors = new FakeSensors();
    sensors.recording = true;
    sensors.writeMeta(0);
    walkEast(sensors, 0, 1800);
    walkEast(sensors, 0, 600);
    sensors.now = 5_000_000;
    const meter = new Meter(sensors, async () => true, NOTIFICATION);

    expect(duration(meter.open())).toBe(1_799_000);
    // The stop the screen made of the session wrote its line at 5 000 000 on the clock after the restart.
    expect(sensors.file.includes('"k":"end"')).toBe(true);
    sensors.now = 6_000_000;
    expect(duration(meter.tick())).toBe(1_799_000);
    expect(duration(new Meter(sensors, async () => true, NOTIFICATION).open())).toBe(1_799_000);
  });

  it('a restart nothing was written after, which the module did not notice: the member stops it, and the stop is no end', () => {
    const sensors = new FakeSensors();
    sensors.recording = true;
    sensors.writeMeta(0);
    walkEast(sensors, 0, 1800);
    // After the restart the clock reads 60 s, the session has lasted 30 minutes before it.
    sensors.now = 60_000;
    const meter = new Meter(sensors, async () => true, NOTIFICATION);
    meter.open();

    const stopped = meter.stop();

    expect(stopped.phase).toBe('stopped');
    expect(duration(stopped)).toBe(1_799_000);
    sensors.now = 3_000_000;
    expect(duration(meter.tick())).toBe(1_799_000);
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
