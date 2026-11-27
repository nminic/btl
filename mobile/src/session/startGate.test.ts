import { measureDistance } from '../measure/distance';
import { SIGNAL_LOST_MS } from '../measure/measure';
import { isGoodFix, StartGate } from './startGate';
import { FakeSensors } from './testing/fakeSensors';

/** A phone with no fix yet, and the gate listening since `now`. */
function listening(now = 50_000) {
  const sensors = new FakeSensors();
  sensors.gpsFix = null;
  sensors.now = now;
  const gate = new StartGate(sensors, async () => true);
  expect(gate.listen()).toBe(true);
  return { sensors, gate };
}

describe('a good fix is what the length algorithm takes as good, and nothing else', () => {
  // Asked of measureDistance itself, so that the gate cannot drift from it: `lastFixPoor` is its own verdict on a fix.
  const algorithmSaysGood = (acc: number | undefined) =>
    !measureDistance([{ t: 0, lat: 44.8, lon: 20.4, accuracy: acc, mock: false, receivedAt: 0 }]).lastFixPoor;

  it.each([undefined, 0, 4, 19.9, 20, 20.01, 21, 50, 1000])('accuracy %p', (acc) => {
    expect(isGoodFix({ t: 0, acc })).toBe(algorithmSaysGood(acc));
  });

  it('has both answers among those accuracies', () => {
    expect(isGoodFix({ t: 0, acc: 20 })).toBe(true);
    expect(isGoodFix({ t: 0, acc: 20.01 })).toBe(false);
    expect(isGoodFix({ t: 0 })).toBe(false);
  });
});

describe('may the member start', () => {
  it('no: there is no fix', () => {
    const { gate } = listening();

    expect(gate.mayStart()).toBe(false);
  });

  it('no: the fix is poor, or has no accuracy', () => {
    const { sensors, gate } = listening();
    sensors.gpsFix = { t: 50_000, acc: 35 };
    expect(gate.mayStart()).toBe(false);

    sensors.gpsFix = { t: 50_000 };
    expect(gate.mayStart()).toBe(false);
  });

  it('yes: the fix is good and fresh', () => {
    const { sensors, gate } = listening();
    sensors.now = 52_000;
    sensors.gpsFix = { t: 51_000, acc: 6 };

    expect(gate.mayStart()).toBe(true);
  });

  it('no again: the good fix is followed by a poor one', () => {
    const { sensors, gate } = listening();
    sensors.gpsFix = { t: 51_000, acc: 6 };
    sensors.now = 52_000;
    expect(gate.mayStart()).toBe(true);

    sensors.gpsFix = { t: 53_000, acc: 40 };
    sensors.now = 53_500;
    expect(gate.mayStart()).toBe(false);
  });

  it('no again: the good fix grows older than the age at which the screen calls the signal lost', () => {
    const { sensors, gate } = listening();
    sensors.gpsFix = { t: 51_000, acc: 6 };
    sensors.now = 51_000 + SIGNAL_LOST_MS;
    expect(gate.mayStart()).toBe(true);

    sensors.now = 51_000 + SIGNAL_LOST_MS + 1;
    expect(gate.mayStart()).toBe(false);
  });

  it('no: the good fix was taken before this listening began, however young it is', () => {
    // The screen was hidden at 49 s and seen again at 50 s; the module still holds the fix of 49 s.
    const { sensors, gate } = listening(50_000);
    sensors.gpsFix = { t: 49_000, acc: 4 };
    sensors.now = 50_500;
    expect(gate.mayStart()).toBe(false);

    sensors.gpsFix = { t: 50_000, acc: 4 };
    expect(gate.mayStart()).toBe(true);
  });

  it('no: it is not listening, before it began or after it stopped, however good the fix', () => {
    const sensors = new FakeSensors();
    const gate = new StartGate(sensors, async () => true);
    expect(gate.mayStart()).toBe(false);

    expect(gate.listen()).toBe(true);
    expect(sensors.watchingGps).toBe(true);
    expect(gate.mayStart()).toBe(true);

    gate.stopListening();
    expect(sensors.watchingGps).toBe(false);
    expect(gate.mayStart()).toBe(false);
  });

  it('cannot listen without precise location, and says so', () => {
    const sensors = new FakeSensors();
    sensors.fineLocation = false;
    const gate = new StartGate(sensors, async () => true);

    expect(gate.listen()).toBe(false);
    expect(sensors.watchingGps).toBe(false);
    expect(gate.mayStart()).toBe(false);
  });
});

describe('asking for location', () => {
  it('asks once, however many times it is asked, and asks anew only when told to', async () => {
    const ask = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const gate = new StartGate(new FakeSensors(), ask);

    expect(await gate.ask()).toBe(false);
    expect(await gate.ask()).toBe(false);
    expect(ask).toHaveBeenCalledTimes(1);

    expect(await gate.ask(true)).toBe(true);
    expect(await gate.ask()).toBe(true);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('takes a request that fails for a no', async () => {
    const gate = new StartGate(new FakeSensors(), () => Promise.reject(new Error('not attached to an Activity')));

    expect(await gate.ask()).toBe(false);
  });
});
