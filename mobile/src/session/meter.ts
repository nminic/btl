import type { BtlSensors } from '../../modules/btl-sensors';
import { measure, type Measures } from '../measure/measure';
import { Recording, type SessionMeta } from '../measure/recording';

export type MeterView =
  | { phase: 'idle' }
  | { phase: 'denied' }
  | { phase: 'starting' }
  | { phase: 'recording'; measures: Measures }
  | { phase: 'stopped'; measures: Measures };

/**
 * The screen's side of a session. The session file is the only source: every
 * view is computed from the samples read from it, so a JavaScript that Android
 * paused in the background catches up on its next read and loses nothing, and a
 * meter opened after the app was closed shows the last session as it was saved,
 * or the session still recording, in the same file, when Android killed
 * everything in between.
 */
export class Meter {
  private recording = new Recording();
  private offset = 0;
  private recordingNow = false;

  constructor(
    private readonly sensors: BtlSensors,
    private readonly askForLocation: () => Promise<boolean>,
    private readonly notification: { title: string; text: string },
  ) {}

  /**
   * On opening the app: a session still recording, the last one saved, or none.
   * A session still recording whose service Android killed is started again.
   */
  open(): MeterView {
    this.recordingNow = this.sensors.isRecording();
    if (this.recordingNow) this.sensors.resume();
    return this.tick();
  }

  async start(): Promise<MeterView> {
    if (!(await this.askForLocation())) return { phase: 'denied' };
    try {
      this.sensors.start(this.notification.title, this.notification.text);
    } catch {
      // The module refuses when fine location is not granted after all.
      return { phase: 'denied' };
    }
    this.recording = new Recording();
    this.offset = 0;
    this.recordingNow = true;
    return this.tick();
  }

  stop(): MeterView {
    this.sensors.stop();
    this.recordingNow = false;
    return this.tick();
  }

  /** Reads what the service wrote since the last read and measures again. */
  tick(): MeterView {
    const { text, next } = this.sensors.read(this.offset);
    this.recording.append(text);
    this.offset = next;
    if (this.recordingNow && !this.sensors.isRecording()) this.recordingNow = false;

    const meta = this.recording.meta;
    if (meta === null) return this.recordingNow ? { phase: 'starting' } : { phase: 'idle' };
    const measures = measure(this.recording as Recording & { meta: SessionMeta }, this.sensors.elapsedRealtimeMs());
    return { phase: this.recordingNow ? 'recording' : 'stopped', measures };
  }
}
