import type { BtlSensors, GpsFix } from '../../../modules/btl-sensors';

/**
 * The Kotlin module as the tests see it: a session file held as text, read the
 * way `Sessions.readFrom` reads it, up to the last complete line.
 */
export class FakeSensors implements BtlSensors {
  file = '';
  recording = false;
  pressureSensor = true;
  now = 0;
  refuseStart = false;
  started: Array<[string, string]> = [];

  isRecording() {
    return this.recording;
  }

  elapsedRealtimeMs() {
    return this.now;
  }

  start(title: string, text: string) {
    if (this.refuseStart) throw new Error('ERR_NO_LOCATION_PERMISSION');
    this.started.push([title, text]);
    this.file = '';
    this.recording = true;
  }

  /** How many times the screen asked for the service to be started again. */
  resumed = 0;
  batteryAsked = 0;

  resume() {
    this.resumed += 1;
  }

  stop() {
    this.recording = false;
  }

  askBatteryExemptionOnce() {
    this.batteryAsked += 1;
    return true;
  }

  /** Whether fine location is granted, as the module checks it before it listens to GPS. */
  fineLocation = true;
  watchingGps = false;
  /**
   * The phone has a good GPS fix at every moment it is asked, unless a case says
   * otherwise by setting `gpsFix`. A case that is not about the start button
   * presses it as a member does once the GPS is good.
   */
  gpsFix: GpsFix | null | 'good now' = 'good now';

  watchGps() {
    if (!this.fineLocation) return false;
    this.watchingGps = true;
    return true;
  }

  unwatchGps() {
    this.watchingGps = false;
  }

  lastGpsFix(): GpsFix | null {
    return this.gpsFix === 'good now' ? { t: this.now, acc: 4 } : this.gpsFix;
  }

  read(offset: number) {
    const lastNewline = this.file.lastIndexOf('\n');
    if (lastNewline < offset) return { text: '', next: offset };
    return { text: this.file.slice(offset, lastNewline + 1), next: lastNewline + 1 };
  }

  /** What the service would write: the meta line first, then samples. */
  writeMeta(t = 0) {
    this.write({ k: 'meta', v: 1, pressure: this.pressureSensor, wall: 1764200000000, t });
  }

  write(line: object) {
    this.file += `${JSON.stringify(line)}\n`;
  }
}
