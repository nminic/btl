import type { BtlSensors } from '../../../modules/btl-sensors';

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

  stop() {
    this.recording = false;
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
