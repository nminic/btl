/**
 * The raw samples of one session, read from the file the Kotlin service writes
 * (`modules/btl-sensors/android/.../SampleWriter.kt`), one JSON object per line.
 *
 * Every sample carries two times: `t`, when it was taken, and `receivedAt`, when
 * the service got it. Both are milliseconds on the elapsedRealtime clock. The
 * algorithm reads `t` only: Android hands fixes over in batches, so the time of
 * reading says nothing about where the runner was when.
 */

export type LocationSample = {
  t: number;
  lat: number;
  lon: number;
  /** Horizontal accuracy in metres, as Android reports it; absent when the fix has none. */
  accuracy?: number;
  /** GPS altitude. Recorded, and on purpose never read by the algorithm. */
  altitude?: number;
  /** Doppler speed in m/s, absent when the fix has none. */
  speed?: number;
  speedAccuracy?: number;
  /** Android marked the fix as coming from a mock location provider. */
  mock: boolean;
  receivedAt: number;
};

export type PressureSample = {
  t: number;
  hPa: number;
  receivedAt: number;
};

export type SessionMeta = {
  pressureSensor: boolean;
  startedAtWallMs: number;
  startedAt: number;
};

type Line = Record<string, unknown>;

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionalNumber(value: unknown): number | undefined {
  return isNumber(value) ? value : undefined;
}

function parse(line: string): Line | null {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Line) : null;
  } catch {
    return null;
  }
}

export class Recording {
  meta: SessionMeta | null = null;
  readonly locations: LocationSample[] = [];
  readonly pressures: PressureSample[] = [];
  /** Lines that could not be read: the half line of a killed process, or damage. */
  unreadable = 0;

  /** Appends the lines of `text`. Arrays grow in place: a session is tens of thousands of samples. */
  append(text: string): void {
    for (const raw of text.split('\n')) {
      if (raw.trim() === '') continue;
      if (!this.take(parse(raw))) this.unreadable += 1;
    }
  }

  private take(line: Line | null): boolean {
    if (line === null) return false;
    const { k, t, rx } = line;

    if (k === 'meta') {
      if (typeof line.pressure !== 'boolean' || !isNumber(line.wall) || !isNumber(t)) return false;
      this.meta = { pressureSensor: line.pressure, startedAtWallMs: line.wall, startedAt: t };
      return true;
    }
    if (!isNumber(t) || !isNumber(rx)) return false;

    if (k === 'loc') {
      if (!isNumber(line.lat) || !isNumber(line.lon)) return false;
      this.locations.push({
        t,
        lat: line.lat,
        lon: line.lon,
        accuracy: optionalNumber(line.acc),
        altitude: optionalNumber(line.alt),
        speed: optionalNumber(line.spd),
        speedAccuracy: optionalNumber(line.spdAcc),
        mock: line.mock === true,
        receivedAt: rx,
      });
      return true;
    }
    if (k === 'prs') {
      if (!isNumber(line.hpa)) return false;
      this.pressures.push({ t, hPa: line.hpa, receivedAt: rx });
      return true;
    }
    return false;
  }
}
