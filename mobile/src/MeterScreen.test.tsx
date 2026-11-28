import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { translator } from './i18n/translate';
import { offset } from './measure/testing/synth';
import { MeterScreen, READ_EVERY_MS } from './MeterScreen';
import { Meter } from './session/meter';
import { FakeSensors } from './session/testing/fakeSensors';

const t = translator('sr');

async function setUp(sensors = new FakeSensors(), granted = true) {
  const meter = new Meter(sensors, async () => granted, { title: 'n', text: 'n' });
  await render(<MeterScreen meter={meter} t={t} locale="sr" />);
  return sensors;
}

function walkEast(sensors: FakeSensors, toS: number, fromS = 0) {
  for (let s = fromS; s < toS; s += 1) {
    sensors.write({ k: 'loc', t: s * 1000, ...offset(3 * s, 0), rx: s * 1000, mock: false, acc: 4, spd: 3 });
  }
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('opens idle, with its title and a button to start', async () => {
  await setUp();

  expect(screen.getByRole('header', { name: 'BTL merilo' })).toBeTruthy();
  expect(screen.getByText(t('meter.idle'))).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Počni merenje' })).toBeTruthy();
});

it('says why it cannot start without precise location', async () => {
  await setUp(new FakeSensors(), false);

  await fireEvent.press(screen.getByRole('button', { name: 'Počni merenje' }));

  expect(screen.getByText(t('meter.denied'))).toBeTruthy();
});

it('shows distance, ascent and descent live, and the GPS state, while recording', async () => {
  const sensors = await setUp();
  await fireEvent.press(screen.getByRole('button', { name: 'Počni merenje' }));
  expect(screen.getByText(t('meter.starting'))).toBeTruthy();

  sensors.writeMeta();
  // One fix and one pressure a second, as the service writes them: in the order they were taken.
  for (let s = 0; s < 401; s += 1) {
    walkEast(sensors, s + 1, s);
    sensors.write({ k: 'prs', t: s * 1000, hpa: 1000 - Math.min(s, 100) * 0.012, rx: s * 1000 });
  }
  sensors.now = 400_000;
  await act(async () => jest.advanceTimersByTime(READ_EVERY_MS));

  expect(screen.getByLabelText('Dužina: 1,20 km')).toBeTruthy();
  expect(screen.getByLabelText(/^Uspon: \d+ m$/)).toBeTruthy();
  expect(screen.getByLabelText('Spust: 0 m')).toBeTruthy();
  expect(screen.getByText(t('gps.good'))).toBeTruthy();
  expect(screen.getByText('Telefon ima senzor pritiska.')).toBeTruthy();
  expect(screen.getByText('Stiglo uzoraka: lokacija 401, pritiska 401.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Završi merenje' })).toBeTruthy();
});

it('says that the phone has no pressure sensor instead of showing ascent and descent', async () => {
  const sensors = new FakeSensors();
  sensors.pressureSensor = false;
  await setUp(sensors);
  await fireEvent.press(screen.getByRole('button', { name: 'Počni merenje' }));
  sensors.writeMeta();
  await act(async () => jest.advanceTimersByTime(READ_EVERY_MS));

  expect(screen.getByText(t('meter.noPressureSensor'))).toBeTruthy();
  expect(screen.queryByLabelText(/^Uspon/)).toBeNull();
  expect(screen.queryByLabelText(/^Spust/)).toBeNull();
  expect(screen.getByText(t('gps.searching'))).toBeTruthy();
  expect(screen.queryByText('Telefon ima senzor pritiska.')).toBeNull();
  expect(screen.getByText('Stiglo uzoraka: lokacija 0, pritiska 0.')).toBeTruthy();
});

it('counts a drive in the distance and says nothing about it to the member', async () => {
  // PDL, „Član na ekranu aplikacije ne dobija rečenicu o vozilu; napomena je moderatorova".
  const sensors = await setUp();
  await fireEvent.press(screen.getByRole('button', { name: 'Počni merenje' }));
  sensors.writeMeta();
  for (let s = 0; s < 41; s += 1) {
    sensors.write({ k: 'loc', t: s * 1000, ...offset(25 * s, 0), rx: s * 1000, mock: false, acc: 4, spd: 25 });
  }
  sensors.now = 40_000;
  await act(async () => jest.advanceTimersByTime(READ_EVERY_MS));

  expect(screen.getByLabelText('Dužina: 1,00 km')).toBeTruthy();
  expect(screen.queryByText(/vozil/i)).toBeNull();
});

it('stops, shows the last measurement without a GPS state, and stops reading', async () => {
  const sensors = await setUp();
  await fireEvent.press(screen.getByRole('button', { name: 'Počni merenje' }));
  sensors.writeMeta();
  walkEast(sensors, 101);

  await fireEvent.press(screen.getByRole('button', { name: 'Završi merenje' }));

  expect(screen.getByText(t('meter.last'))).toBeTruthy();
  expect(screen.getByLabelText('Dužina: 0,30 km')).toBeTruthy();
  expect(screen.queryByText(t('gps.good'))).toBeNull();
  walkEast(sensors, 401);
  await act(async () => jest.advanceTimersByTime(5 * READ_EVERY_MS));
  expect(screen.getByLabelText('Dužina: 0,30 km')).toBeTruthy();
});
