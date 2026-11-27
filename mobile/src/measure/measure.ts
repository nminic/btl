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
  /** How many samples of each kind the service wrote, so that a phone can be checked without a cable. */
  samples: { locations: number; pressures: number };
  /**
   * Marks for the moderator, gathered in one place. They take nothing away from
   * the result: every stretch they name is counted. Nothing sends them yet
   * (inkrement 3), and the member does not see them (PDL, „Član na ekranu
   * aplikacije ne dobija rečenicu o vozilu").
   */
  suspicious: {
    vehicleSegments: number;
    vehicleDurationMs: number;
    mockFixes: number;
    verticalSegments: number;
    verticalDurationMs: number;
  };
};

/** Everything the screen shows, from the samples alone. `now` is on the samples' clock and only dates the GPS state. */
export function measure(recording: Recording & { meta: SessionMeta }, now: number): Measures {
  const distance = measureDistance(recording.locations);

  let gps: GpsState;
  if (distance.lastFixT === null) gps = 'searching';
  else if (now - distance.lastFixT > SIGNAL_LOST_MS) gps = 'lost';
  else gps = distance.lastFixPoor ? 'poor' : 'good';

  const elevation = measureElevation(recording.meta.pressureSensor, recording.pressures, recording.locations);
  const measured = elevation.status === 'measured';

  return {
    distanceM: distance.distanceM,
    elevation,
    gps,
    samples: { locations: recording.locations.length, pressures: recording.pressures.length },
    suspicious: {
      vehicleSegments: distance.vehicleSegments,
      vehicleDurationMs: distance.vehicleDurationMs,
      mockFixes: distance.mockFixes,
      verticalSegments: measured ? elevation.verticalSegments : 0,
      verticalDurationMs: measured ? elevation.verticalDurationMs : 0,
    },
  };
}
