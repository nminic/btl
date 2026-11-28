import type { BtlSensors, GpsFix } from '../../modules/btl-sensors';
import { MAX_ACCURACY_M } from '../measure/distance';
import { SIGNAL_LOST_MS } from '../measure/measure';

/**
 * The same test of a fix that the length algorithm applies (`measureDistance` in
 * `../measure/distance.ts`): an accuracy that is reported and no worse than
 * MAX_ACCURACY_M. A fix without one is poor.
 */
export function isGoodFix(fix: GpsFix): boolean {
  return fix.acc !== undefined && fix.acc <= MAX_ACCURACY_M;
}

/**
 * „Dugme za početak merenja čeka GPS: zaključano je dok ne stigne prva dobra GPS
 * tačka" (PDL, „Mobilna aplikacija BTL-a (27.11.2026)"). Before a start, and only
 * then, the screen listens to GPS through the module, and this decides from the
 * latest fix whether the member may start. The module only hands the fix over;
 * judging it is TypeScript's, as it is for every sample the service writes.
 *
 * May start: the latest fix is good, it was taken since this listening began (a
 * fix from before the screen was last hidden says nothing about now), and it is
 * no older than SIGNAL_LOST_MS, the age at which the screen calls the signal lost.
 * So a good fix that is followed by a poor one, or by none for that long, locks
 * the button again: what the member is told is that GPS is good at the start.
 */
export class StartGate {
  private asked: Promise<boolean> | null = null;
  private listeningSince: number | null = null;

  constructor(
    private readonly sensors: BtlSensors,
    private readonly askForLocation: () => Promise<boolean>,
  ) {}

  /**
   * Asks for location once, on opening: a second call is answered from the first
   * ask. `again` asks anew, for the member who presses the button after a no. A
   * request that fails is a no.
   */
  ask(again = false): Promise<boolean> {
    if (again || this.asked === null) this.asked = this.askForLocation().catch(() => false);
    return this.asked;
  }

  /** False when precise location is not granted any more (taken away in the phone's settings). */
  listen(): boolean {
    if (!this.sensors.watchGps()) return false;
    this.listeningSince = this.sensors.elapsedRealtimeMs();
    return true;
  }

  stopListening(): void {
    this.sensors.unwatchGps();
    this.listeningSince = null;
  }

  mayStart(): boolean {
    if (this.listeningSince === null) return false;
    const fix = this.sensors.lastGpsFix();
    if (fix === null || !isGoodFix(fix)) return false;
    return fix.t >= this.listeningSince && this.sensors.elapsedRealtimeMs() - fix.t <= SIGNAL_LOST_MS;
  }
}
