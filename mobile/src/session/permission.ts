import { PermissionsAndroid } from 'react-native';

/**
 * Asks for precise location, and with it for coarse (Android 12 and later refuse
 * a request for fine alone) and for notifications (Android 13 and later hide the
 * foreground notification without it). Only precise location decides: without it
 * there is nothing to measure; without notifications the service still records.
 */
export async function askForLocation(): Promise<boolean> {
  const { ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, POST_NOTIFICATIONS } = PermissionsAndroid.PERMISSIONS;
  const granted = await PermissionsAndroid.requestMultiple([ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, POST_NOTIFICATIONS]);
  return granted[ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
}
