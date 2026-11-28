import { requireNativeModule } from 'expo';

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
}

export default requireNativeModule<BtlSensors>('BtlSensors');
