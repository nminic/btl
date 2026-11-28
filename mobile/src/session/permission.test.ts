import { PermissionsAndroid } from 'react-native';
import { askForLocation } from './permission';

const { ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, POST_NOTIFICATIONS } = PermissionsAndroid.PERMISSIONS;
const { GRANTED, DENIED } = PermissionsAndroid.RESULTS;

afterEach(() => jest.restoreAllMocks());

it('asks for fine and coarse location and for notifications at once', async () => {
  const request = jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [ACCESS_FINE_LOCATION]: GRANTED,
    [ACCESS_COARSE_LOCATION]: GRANTED,
    [POST_NOTIFICATIONS]: GRANTED,
  } as never);

  await askForLocation();

  expect(request).toHaveBeenCalledWith([ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, POST_NOTIFICATIONS]);
});

it('goes on without notifications, and only precise location decides', async () => {
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [ACCESS_FINE_LOCATION]: GRANTED,
    [ACCESS_COARSE_LOCATION]: GRANTED,
    [POST_NOTIFICATIONS]: DENIED,
  } as never);

  expect(await askForLocation()).toBe(true);
});

it('refuses with coarse location alone', async () => {
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [ACCESS_FINE_LOCATION]: DENIED,
    [ACCESS_COARSE_LOCATION]: GRANTED,
    [POST_NOTIFICATIONS]: GRANTED,
  } as never);

  expect(await askForLocation()).toBe(false);
});
