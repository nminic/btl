import { hPaAt, offset } from '../measure/testing/synth';
import { Meter } from './meter';
import { FakeSensors } from './testing/fakeSensors';

const NOTIFICATION = { title: 'title', text: 'text' };

function walkEast(sensors: FakeSensors, fromS: number, toS: number) {
  for (let s = fromS; s < toS; s += 1) {
    sensors.write({ k: 'loc', t: s * 1000, ...offset(3 * s, 0), rx: s * 1000, mock: false, acc: 4, spd: 3 });
  }
}

it('opens idle when nothing was ever recorded', () => {
  expect(new Meter(new FakeSensors(), async () => true, NOTIFICATION).open()).toEqual({ phase: 'idle' });
});

it('opens on the last saved session, as it was, when the app was closed', () => {
  const sensors = new FakeSensors();
  sensors.writeMeta();
  walkEast(sensors, 0, 101);

  const view = new Meter(sensors, async () => true, NOTIFICATION).open();

  expect(view.phase).toBe('stopped');
  expect(view.phase === 'stopped' && view.measures.distanceM).toBeGreaterThan(290);
});

it('opens on a session the service is still recording, and asks for its service to be started again', () => {
  const sensors = new FakeSensors();
  sensors.recording = true;
  sensors.writeMeta();

  expect(new Meter(sensors, async () => true, NOTIFICATION).open().phase).toBe('recording');
  expect(sensors.resumed).toBe(1);
});

it('does not start anything again for a session that ended', () => {
  const sensors = new FakeSensors();
  sensors.writeMeta();
  new Meter(sensors, async () => true, NOTIFICATION).open();

  expect(sensors.resumed).toBe(0);
});

describe('a service Android killed and started again, and one that ran without a break', () => {
  // PDL, „Kad Android ubije servis za merenje, servis se sam podiže i nastavlja ISTO merenje".
  it('opens on the SAME session, bridges the time it was down, and measures what the unbroken one does', () => {
    const unbroken = new FakeSensors();
    unbroken.recording = true;
    unbroken.writeMeta();
    walkEast(unbroken, 0, 301);
    unbroken.now = 300_000;

    const killed = new FakeSensors();
    killed.recording = true;
    killed.writeMeta();
    walkEast(killed, 0, 100);
    // Down from 100 to 160 s: nothing written. Started again: the same file goes on, with no second meta.
    walkEast(killed, 160, 301);
    killed.now = 300_000;

    const a = new Meter(unbroken, async () => true, NOTIFICATION).open();
    const b = new Meter(killed, async () => true, NOTIFICATION).open();

    expect(a.phase).toBe('recording');
    expect(b.phase).toBe('recording');
    const distance = (v: typeof a) => (v.phase === 'recording' ? v.measures.distanceM : NaN);
    expect(distance(b)).toBeGreaterThan(890);
    expect(distance(b)).toBeCloseTo(distance(a), 0);
    expect(killed.started).toEqual([]);
  });
});

it('does not start without precise location, and does not ask the module', async () => {
  const sensors = new FakeSensors();

  expect(await new Meter(sensors, async () => false, NOTIFICATION).start()).toEqual({ phase: 'denied' });
  expect(sensors.started).toEqual([]);
});

it('says denied when the module refuses after all', async () => {
  const sensors = new FakeSensors();
  sensors.refuseStart = true;

  expect(await new Meter(sensors, async () => true, NOTIFICATION).start()).toEqual({ phase: 'denied' });
});

it('starts with the notification texts, then catches up on everything written while it was not reading', async () => {
  const sensors = new FakeSensors();
  const meter = new Meter(sensors, async () => true, NOTIFICATION);

  expect(await meter.start()).toEqual({ phase: 'starting' });
  expect(sensors.started).toEqual([['title', 'text']]);

  sensors.writeMeta();
  walkEast(sensors, 0, 50);
  const first = meter.tick();
  // Paused in the background: the service keeps writing, the screen reads it all on return.
  walkEast(sensors, 50, 201);
  sensors.now = 200_000;
  const second = meter.tick();

  expect(first.phase === 'recording' && first.measures.distanceM).toBeGreaterThan(140);
  expect(second.phase === 'recording' && second.measures.distanceM).toBeGreaterThan(590);
  expect(second.phase === 'recording' && second.measures.gps).toBe('good');
});

it('starts a new session from nothing, not on top of the last one', async () => {
  const sensors = new FakeSensors();
  sensors.writeMeta();
  walkEast(sensors, 0, 101);
  const meter = new Meter(sensors, async () => true, NOTIFICATION);
  meter.open();

  await meter.start();
  sensors.writeMeta();
  const view = meter.tick();

  expect(view.phase === 'recording' && view.measures.distanceM).toBe(0);
});

it('stops, and shows the session as it ended', async () => {
  const sensors = new FakeSensors();
  const meter = new Meter(sensors, async () => true, NOTIFICATION);
  await meter.start();
  sensors.writeMeta();
  walkEast(sensors, 0, 101);

  const view = meter.stop();

  expect(sensors.recording).toBe(false);
  expect(view.phase).toBe('stopped');
  expect(view.phase === 'stopped' && view.measures.distanceM).toBeGreaterThan(290);
});

it('notices a service that ended on its own', async () => {
  const sensors = new FakeSensors();
  const meter = new Meter(sensors, async () => true, NOTIFICATION);
  await meter.start();
  sensors.writeMeta();
  sensors.recording = false;

  expect(meter.tick().phase).toBe('stopped');
});

describe('a phone that was restarted in the middle of the session', () => {
  // PDL, „Kad se telefon usred merenja restartuje, merenje se završava": what was measured up to the
  // restart stays and shows as a finished session; nothing after the restart is part of it.
  function pressureAt(sensors: FakeSensors, s: number, altitudeM: number, rxOffset = 0) {
    sensors.write({ k: 'prs', t: s * 1000, hpa: hPaAt(altitudeM), rx: s * 1000 + rxOffset });
  }

  /** One fix and one pressure a second over `[fromS, toS)`, in the order the service writes them. */
  function run(sensors: FakeSensors, fromS: number, toS: number, altitudeM: number) {
    for (let s = fromS; s < toS; s += 1) {
      walkEast(sensors, s, s + 1);
      pressureAt(sensors, s, altitudeM);
    }
  }

  /** 30 minutes at 3 m/s and 100 m, then the phone restarts and the clock begins again from zero for another 30. */
  function restartedAfterThirtyMinutes(sensors: FakeSensors, afterRestartAltitudeM: number) {
    sensors.recording = true;
    sensors.writeMeta();
    run(sensors, 0, 1800, 100);
    // After the restart: the clock is at zero again, and the weather is not what it was.
    run(sensors, 0, 1800, afterRestartAltitudeM);
    sensors.now = 1_800_000;
  }

  function control() {
    const sensors = new FakeSensors();
    sensors.writeMeta();
    run(sensors, 0, 1800, 100);
    return new Meter(sensors, async () => true, NOTIFICATION).open();
  }

  it('opens on a finished session that holds what was measured before the restart, and does not start the service', () => {
    const sensors = new FakeSensors();
    restartedAfterThirtyMinutes(sensors, 100);

    const view = new Meter(sensors, async () => true, NOTIFICATION).open();
    const before = control();

    expect(view.phase).toBe('stopped');
    expect(before.phase).toBe('stopped');
    expect(sensors.resumed).toBe(0);
    expect(sensors.recording).toBe(false);
    if (view.phase !== 'stopped' || before.phase !== 'stopped') return;
    // The length is that of the first thirty minutes (about 5400 m), not of sixty (10800 m).
    expect(view.measures.distanceM).toBeCloseTo(before.measures.distanceM, 0);
    expect(view.measures.distanceM).toBeLessThan(5500);
    expect(view.measures.samples).toEqual(before.measures.samples);
  });

  it('adds no descent for the difference between the weather before and after the restart', () => {
    const sensors = new FakeSensors();
    restartedAfterThirtyMinutes(sensors, -100);

    const view = new Meter(sensors, async () => true, NOTIFICATION).open();

    expect(view.phase).toBe('stopped');
    const elevation = view.phase === 'stopped' ? view.measures.elevation : null;
    expect(elevation?.status === 'measured' && elevation.descentM).toBe(0);
    expect(elevation?.status === 'measured' && elevation.ascentM).toBe(0);
  });

  it('ends the session on a read while it is recording, and stops the service so that it writes no more', async () => {
    const sensors = new FakeSensors();
    const meter = new Meter(sensors, async () => true, NOTIFICATION);
    await meter.start();
    sensors.writeMeta();
    walkEast(sensors, 0, 600);
    expect(meter.tick().phase).toBe('recording');

    walkEast(sensors, 0, 100);
    const view = meter.tick();

    expect(view.phase).toBe('stopped');
    expect(sensors.recording).toBe(false);
    expect(view.phase === 'stopped' && view.measures.distanceM).toBeLessThan(1900);
  });

  it('is not what a service killed and started again in the same boot is: that one goes on, as before', () => {
    const sensors = new FakeSensors();
    sensors.recording = true;
    sensors.writeMeta();
    walkEast(sensors, 0, 100);
    walkEast(sensors, 160, 301);
    sensors.now = 300_000;

    const view = new Meter(sensors, async () => true, NOTIFICATION).open();

    expect(view.phase).toBe('recording');
    expect(sensors.resumed).toBe(1);
    expect(sensors.recording).toBe(true);
  });
});
