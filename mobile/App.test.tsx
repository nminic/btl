import { render, screen } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';
import { FakeSensors } from './src/session/testing/fakeSensors';

const mockSensors = new FakeSensors();

jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireNativeModule: (name: string) => {
    if (name !== 'BtlSensors') throw new Error(`unexpected native module ${name}`);
    return mockSensors;
  },
  registerRootComponent: jest.fn(),
}));

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

function phoneSetTo(languageTag: string, languageCode: string) {
  jest.mocked(getLocales).mockReturnValue([{ languageTag, languageCode }] as never);
}

it('speaks Serbian, in Latin script, on a phone set to Serbian in Cyrillic', async () => {
  phoneSetTo('sr-Cyrl-RS', 'sr');
  const App = require('./App').default;
  await render(<App />);

  expect(screen.getByRole('header', { name: 'BTL merilo' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Počni merenje' })).toBeTruthy();
});

it('speaks English on a phone set to anything else', async () => {
  phoneSetTo('de-DE', 'de');
  const App = require('./App').default;
  await render(<App />);

  expect(screen.getByRole('header', { name: 'BTL meter' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start measuring' })).toBeTruthy();
});

it('asks the module for the battery exemption when the app opens', async () => {
  phoneSetTo('sr-Latn-RS', 'sr');
  const before = mockSensors.batteryAsked;
  const App = require('./App').default;
  await render(<App />);

  expect(mockSensors.batteryAsked).toBe(before + 1);
});

it('registers App as the root component', () => {
  require('./index');
  const { registerRootComponent } = require('expo');

  expect(registerRootComponent).toHaveBeenCalledWith(require('./App').default);
});
