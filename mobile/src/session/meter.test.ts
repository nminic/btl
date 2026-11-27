import { offset } from '../measure/testing/synth';
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
