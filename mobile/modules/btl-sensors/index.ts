import { requireNativeModule } from 'expo';

/** The latest fix of the GPS the screen listens to before a start: its time on the elapsedRealtime clock, and its accuracy in metres when it has one. */
export type GpsFix = { t: number; acc?: number };

/**
 * The sensor layer, as written in Kotlin in `android/.../BtlSensorsModule.kt`.
 * Android only (PDL, „Aplikacija je samo za Android").
 */
export interface BtlSensors {
  /** From the member's start to the member's stop, also while Android has the service down. */
  isRecording(): boolean;
  /** The clock every sample's `t` is on: elapsed real time, which keeps counting in sleep. */
  elapsedRealtimeMs(): number;
  /** Throws when fine location is not granted. The texts are the foreground notification's. */
  start(notificationTitle: string, notificationText: string): void;
  /** Starts the service again for a session that is recording but whose service Android killed. */
  resume(): void;
  stop(): void;
  /** Complete lines of the latest session from a byte offset, and the offset after them. */
  read(offset: number): { text: string; next: number };
  /** Asks for the battery exemption the first time only; true when it asked. */
  askBatteryExemptionOnce(): boolean;
  /**
   * Listens to GPS for the screen, before a start: once a second, nothing written
   * anywhere. False when fine location is not granted; it does not throw.
   */
  watchGps(): boolean;
  unwatchGps(): void;
  /** The latest fix that listener received, of any age and quality; null when it has received none. */
  lastGpsFix(): GpsFix | null;
}

export default requireNativeModule<BtlSensors>('BtlSensors');
