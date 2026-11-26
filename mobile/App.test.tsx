import { render, screen } from '@testing-library/react-native';
import { FakeSensors } from './src/session/testing/fakeSensors';

const mockSensors = new FakeSensors();

jest.mock("expo", () => ({
  ...jest.requireActual("expo"),
  requireNativeModule: (name: string) => {
    if (name !== 'BtlSensors') throw new Error(`unexpected native module ${name}`);
    return mockSensors;
  },
  registerRootComponent: jest.fn(),
}));

it("opens the meter in Serbian over the native sensor module", async () => {
  const App = require('./App').default;
  await render(<App />);

  expect(screen.getByRole('header', { name: 'BTL merilo' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Počni merenje' })).toBeTruthy();
});

it('registers App as the root component', () => {
  require('./index');
  const { registerRootComponent } = require('expo');

  expect(registerRootComponent).toHaveBeenCalledWith(require('./App').default);
});
