import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, PermissionsAndroid } from 'react-native';
import { translator, type Locale } from './i18n/translate';
import { offset } from './measure/testing/synth';
import { MeterScreen, READ_EVERY_MS } from './MeterScreen';
import { Meter } from './session/meter';
import { askForLocation } from './session/permission';
import { FakeSensors } from './session/testing/fakeSensors';

/*
 * The start button and the timer (PDL, „Mobilna aplikacija BTL-a (27.11.2026)"):
 * „Dugme za početak merenja čeka GPS: zaključano je dok ne stigne prva dobra GPS
 * tačka"; while it is locked the screen says it waits for GPS, and the permission
 * is asked as soon as the screen opens. Once a session runs nothing about GPS
 * locks anything. „treba mi timer koji pokazuje koliko dugo vec traje merenje".
 */

const sr = translator('sr');

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** A phone without a fix yet, unless the case gives it one. */
function phone() {
  const sensors = new FakeSensors();
  sensors.gpsFix = null;
  sensors.now = 100_000;
  return sensors;
}

async function open(sensors: FakeSensors, ask: () => Promise<boolean> = async () => true, locale: Locale = 'sr') {
  const meter = new Meter(sensors, ask, { title: 'n', text: 'n' });
  await render(<MeterScreen meter={meter} t={translator(locale)} locale={locale} />);
}

const startButton = () => screen.getByRole('button', { name: 'Počni merenje' });

/** A second passes on the phone, and the screen reads. */
async function second(sensors: FakeSensors, fix?: { t: number; acc?: number } | null) {
  sensors.now += 1000;
  if (fix !== undefined) sensors.gpsFix = fix;
  await act(async () => jest.advanceTimersByTime(READ_EVERY_MS));
}

/** The app goes to the background, or comes back: what AppState tells the screen. */
async function appState(state: 'active' | 'background') {
  const calls = jest.mocked(AppState.addEventListener).mock.calls;
  const [, listener] = calls[calls.length - 1];
  await act(async () => (listener as (s: string) => void)(state));
}

describe('the permission', () => {
  it('is asked as soon as the screen opens, before anything is pressed', async () => {
    const ask = jest.fn(async () => true);
    const sensors = phone();
    await open(sensors, ask);

    expect(ask).toHaveBeenCalledTimes(1);
    expect(sensors.watchingGps).toBe(true);
  });

  it('while it is being asked, the button is locked and the screen says it waits for GPS', async () => {
    await open(phone(), () => new Promise(() => undefined));

    expect(startButton()).toBeDisabled();
    expect(screen.getByText(sr('meter.waitingForGps'))).toBeTruthy();
  });

  it('refused: the screen says why, not that it waits for GPS, and the button asks again and starts nothing', async () => {
    const ask = jest.fn().mockResolvedValue(false);
    const sensors = phone();
    sensors.gpsFix = { t: 100_000, acc: 4 };
    await open(sensors, ask);

    expect(screen.getByText(sr('meter.denied'))).toBeTruthy();
    expect(screen.queryByText(sr('meter.waitingForGps'))).toBeNull();
    expect(sensors.watchingGps).toBe(false);
    expect(startButton()).toBeEnabled();

    await fireEvent.press(startButton());

    expect(ask).toHaveBeenCalledTimes(2);
    expect(sensors.started).toEqual([]);
    expect(screen.getByText(sr('meter.denied'))).toBeTruthy();
  });

  it('granted on the second ask: listening begins, and the button waits for GPS like any other', async () => {
    const ask = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const sensors = phone();
    await open(sensors, ask);

    await fireEvent.press(startButton());

    expect(screen.queryByText(sr('meter.denied'))).toBeNull();
    expect(sensors.watchingGps).toBe(true);
    expect(startButton()).toBeDisabled();
    expect(sensors.started).toEqual([]);
  });

  it('approximate location only is a refusal, through the request the app really makes', async () => {
    const { ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, POST_NOTIFICATIONS } = PermissionsAndroid.PERMISSIONS;
    const { GRANTED, DENIED } = PermissionsAndroid.RESULTS;
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [ACCESS_FINE_LOCATION]: DENIED,
      [ACCESS_COARSE_LOCATION]: GRANTED,
      [POST_NOTIFICATIONS]: GRANTED,
    } as never);
    const sensors = phone();
    await open(sensors, askForLocation);

    expect(screen.getByText(sr('meter.denied'))).toBeTruthy();
    expect(sensors.watchingGps).toBe(false);
  });

  it('taken away in the settings since it was granted: the module cannot listen, and the screen says why', async () => {
    const sensors = phone();
    sensors.fineLocation = false;
    await open(sensors);

    expect(screen.getByText(sr('meter.denied'))).toBeTruthy();
    expect(screen.queryByText(sr('meter.waitingForGps'))).toBeNull();
  });
});

describe('the start button before a session', () => {
  it('is locked without a fix, and with a poor one, and the screen says it waits for GPS', async () => {
    const sensors = phone();
    await open(sensors);
    expect(startButton()).toBeDisabled();
    expect(screen.getByText(sr('meter.waitingForGps'))).toBeTruthy();

    await second(sensors, { t: sensors.now + 1000, acc: 30 });

    expect(startButton()).toBeDisabled();
    expect(screen.getByText(sr('meter.waitingForGps'))).toBeTruthy();
    await fireEvent.press(startButton());
    expect(sensors.started).toEqual([]);
  });

  it('opens on the first good fix, says so, and starts', async () => {
    const sensors = phone();
    await open(sensors);

    await second(sensors, { t: sensors.now + 1000, acc: 8 });

    expect(startButton()).toBeEnabled();
    expect(screen.getByText(sr('meter.gpsReady'))).toBeTruthy();
    expect(screen.queryByText(sr('meter.waitingForGps'))).toBeNull();
    await fireEvent.press(startButton());
    expect(sensors.started).toHaveLength(1);
  });

  it('locks again when the good fix is lost before the start', async () => {
    const sensors = phone();
    await open(sensors);
    await second(sensors, { t: sensors.now + 1000, acc: 8 });
    expect(startButton()).toBeEnabled();

    // No fix since: after ten seconds the screen calls the signal lost, and so does the button.
    for (let s = 0; s < 11; s += 1) await second(sensors);

    expect(startButton()).toBeDisabled();
    expect(screen.getByText(sr('meter.waitingForGps'))).toBeTruthy();
  });

  it('stops listening while the app is not seen, and does not take a fix from before that for a fix of now', async () => {
    const sensors = phone();
    await open(sensors);
    await second(sensors, { t: sensors.now + 1000, acc: 8 });
    expect(startButton()).toBeEnabled();

    await appState('background');
    expect(sensors.watchingGps).toBe(false);
    expect(startButton()).toBeDisabled();

    // Back two seconds later: the module still holds the fix of before, two seconds old.
    sensors.now += 2000;
    await appState('active');
    expect(sensors.watchingGps).toBe(true);
    expect(startButton()).toBeDisabled();

    await second(sensors, { t: sensors.now + 1000, acc: 8 });
    expect(startButton()).toBeEnabled();
  });
});

describe('once a session runs', () => {
  it('stops listening for the gate, and a lost GPS locks nothing: the session goes on and can be stopped', async () => {
    const sensors = phone();
    await open(sensors);
    await second(sensors, { t: sensors.now + 1000, acc: 8 });
    await fireEvent.press(startButton());
    sensors.writeMeta(sensors.now);
    expect(sensors.watchingGps).toBe(false);

    // Into a building: no fix for a minute.
    sensors.gpsFix = null;
    for (let s = 0; s < 60; s += 1) await second(sensors);

    expect(screen.getByText(sr('gps.searching'))).toBeTruthy();
    expect(screen.queryByText(sr('meter.waitingForGps'))).toBeNull();
    const stop = screen.getByRole('button', { name: 'Završi merenje' });
    expect(stop).toBeEnabled();
    expect(sensors.recording).toBe(true);

    await fireEvent.press(stop);
    expect(sensors.recording).toBe(false);
  });

  it('after it is stopped, the next start waits for GPS again', async () => {
    const sensors = phone();
    await open(sensors);
    await second(sensors, { t: sensors.now + 1000, acc: 8 });
    await fireEvent.press(startButton());
    sensors.writeMeta(sensors.now);
    await second(sensors, null);

    await fireEvent.press(screen.getByRole('button', { name: 'Završi merenje' }));

    expect(sensors.watchingGps).toBe(true);
    expect(startButton()).toBeDisabled();
    expect(screen.getByText(sr('meter.waitingForGps'))).toBeTruthy();
  });
});

describe('the timer', () => {
  function walkEast(sensors: FakeSensors, fromS: number, toS: number) {
    for (let s = fromS; s < toS; s += 1) {
      sensors.write({ k: 'loc', t: s * 1000, ...offset(3 * s, 0), rx: s * 1000, mock: false, acc: 4, spd: 3 });
    }
  }

  it('shows how long the session already lasts, from its start and not from the screen, and counts on', async () => {
    // Begun at 100 s, the app opened on it at 3 m 40 s.
    const sensors = phone();
    sensors.recording = true;
    sensors.writeMeta(100_000);
    walkEast(sensors, 100, 320);
    sensors.now = 320_000;
    await open(sensors);

    expect(screen.getByLabelText('Trajanje: 3:40')).toBeTruthy();
    await second(sensors);
    expect(screen.getByLabelText('Trajanje: 3:41')).toBeTruthy();
  });

  it('after the stop, shows the whole duration of the finished session, and stands still', async () => {
    const sensors = phone();
    sensors.recording = true;
    sensors.writeMeta(0);
    walkEast(sensors, 0, 3725);
    sensors.now = 3_725_000;
    await open(sensors);

    await fireEvent.press(screen.getByRole('button', { name: 'Završi merenje' }));

    expect(screen.getByText(sr('meter.last'))).toBeTruthy();
    expect(screen.getByLabelText('Trajanje: 1:02:04')).toBeTruthy();
    for (let s = 0; s < 5; s += 1) await second(sensors);
    expect(screen.getByLabelText('Trajanje: 1:02:04')).toBeTruthy();
  });

  it('is there on a phone without a pressure sensor too', async () => {
    const sensors = phone();
    sensors.pressureSensor = false;
    sensors.recording = true;
    sensors.writeMeta(0);
    sensors.now = 65_000;
    await open(sensors);

    expect(screen.getByLabelText('Trajanje: 1:05')).toBeTruthy();
    expect(screen.getByText(sr('meter.noPressureSensor'))).toBeTruthy();
  });
});

it('says all of it in English on a phone that speaks anything else', async () => {
  const en = translator('en');
  const sensors = phone();
  sensors.recording = true;
  sensors.writeMeta(0);
  sensors.now = 5_000;
  await open(sensors, async () => true, 'en');
  expect(screen.getByLabelText('Duration: 0:05')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Stop measuring' }));
  expect(screen.getByText(en('meter.waitingForGps'))).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start measuring' })).toBeDisabled();

  await second(sensors, { t: sensors.now + 1000, acc: 8 });
  expect(screen.getByText(en('meter.gpsReady'))).toBeTruthy();
});

it('says it in both languages, and the two sentences are not the same', () => {
  const en = translator('en');
  for (const key of ['meter.duration', 'meter.waitingForGps', 'meter.gpsReady']) {
    expect(sr(key)).not.toBe(key);
    expect(en(key)).not.toBe(key);
    expect(sr(key)).not.toBe(en(key));
  }
});
