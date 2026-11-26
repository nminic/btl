import { measureDistance } from './distance';
import { measureElevation, type ElevationResult } from './elevation';
import type { Recording, SessionMeta } from './recording';

/** No fix for this long is a lost signal, shown as its own state. */
export const SIGNAL_LOST_MS = 10_000;

export type GpsState = 'searching' | 'good' | 'poor' | 'lost';

export type Measures = {
  distanceM: number;
  elevation: ElevationResult;
  gps: GpsState;
  /** What a moderator would look at; nothing sends it yet (inkrement 3). */
  suspicious: { vehicleSegments: number; vehicleDurationMs: number; mockFixes: number };
};

/** Everything the screen shows, from the samples alone. `now` is on the samples' clock and only dates the GPS state. */
export function measure(recording: Recording & { meta: SessionMeta }, now: number): Measures {
  const distance = measureDistance(recording.locations);

  let gps: GpsState;
  if (distance.lastFixT === null) gps = 'searching';
  else if (now - distance.lastFixT > SIGNAL_LOST_MS) gps = 'lost';
  else gps = distance.lastFixPoor ? 'poor' : 'good';

  return {
    distanceM: distance.distanceM,
    elevation: measureElevation(recording.meta.pressureSensor, recording.pressures, recording.locations),
    gps,
    suspicious: {
      vehicleSegments: distance.vehicleSegments,
      vehicleDurationMs: distance.vehicleDurationMs,
      mockFixes: distance.mockFixes,
    },
  };
}
