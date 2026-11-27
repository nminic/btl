import type { BtlSensors } from '../../modules/btl-sensors';
import { measure, type Measures } from '../measure/measure';
import { Recording, type SessionMeta } from '../measure/recording';
import { sessionDurationMs } from './duration';
import { StartGate } from './startGate';

export type MeterView =
  | { phase: 'idle' }
  | { phase: 'denied' }
  | { phase: 'starting' }
  | { phase: 'recording'; measures: Measures; durationMs: number }
  | { phase: 'stopped'; measures: Measures; durationMs: number };

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
  /** Whether the member may start, before a session; asks for location with the same request `start` does. */
  readonly gate: StartGate;

  constructor(
    private readonly sensors: BtlSensors,
    private readonly askForLocation: () => Promise<boolean>,
    private readonly notification: { title: string; text: string },
  ) {
    this.gate = new StartGate(sensors, askForLocation);
  }

  /**
   * On opening the app: a session still recording, the last one saved, or none.
   * A session still recording whose service Android killed is started again,
   * unless the phone was restarted in between: that ends it (PDL, „Kad se telefon
   * usred merenja restartuje, merenje se završava"). The file is read BEFORE the
   * service is asked to go on, so that a restart the module did not notice is seen
   * here and the service is never started over it.
   */
  open(): MeterView {
    this.recordingNow = this.sensors.isRecording();
    const view = this.tick();
    if (this.recordingNow) this.sensors.resume();
    return view;
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
    if (this.recordingNow && this.recording.restarted) this.sensors.stop();
    if (this.recordingNow && !this.sensors.isRecording()) this.recordingNow = false;

    const meta = this.recording.meta;
    if (meta === null) return this.recordingNow ? { phase: 'starting' } : { phase: 'idle' };
    const session = this.recording as Recording & { meta: SessionMeta };
    const now = this.sensors.elapsedRealtimeMs();
    const durationMs = sessionDurationMs(session, now, this.recordingNow);
    return { phase: this.recordingNow ? 'recording' : 'stopped', measures: measure(session, now), durationMs };
  }
}
