import { act, render, screen } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';
import { PermissionsAndroid } from 'react-native';
import { FakeSensors } from './src/session/testing/fakeSensors';

const mockSensors = new FakeSensors();

jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireNativeModule: () => mockSensors,
  registerRootComponent: jest.fn(),
}));

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

afterEach(() => jest.restoreAllMocks());

/*
 * The first start asks two things of the member through system dialogs: location
 * (asked by the screen on opening) and the battery exemption (PDL, „Aplikacija na
 * prvom pokretanju traži izuzetak od štednje baterije"). The second is asked once
 * the first is answered, so that the two do not open over each other.
 */
it('asks for location on opening, and for the battery exemption once that is answered, granted or not', async () => {
  jest.mocked(getLocales).mockReturnValue([{ languageTag: 'sr-Latn-RS', languageCode: 'sr' }] as never);
  const { ACCESS_FINE_LOCATION } = PermissionsAndroid.PERMISSIONS;
  let answer: (result: object) => void = () => undefined;
  const request = jest
    .spyOn(PermissionsAndroid, 'requestMultiple')
    .mockReturnValue(new Promise((resolve) => (answer = resolve)) as never);
  const before = mockSensors.batteryAsked;

  const App = require('./App').default;
  await render(<App />);

  expect(request).toHaveBeenCalledTimes(1);
  expect(mockSensors.batteryAsked).toBe(before);

  await act(async () => answer({ [ACCESS_FINE_LOCATION]: PermissionsAndroid.RESULTS.DENIED }));

  expect(mockSensors.batteryAsked).toBe(before + 1);
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Bez dozvole za tačnu lokaciju merenje ne može da počne. Dozvolu daješ u podešavanjima telefona.')).toBeTruthy();
});
