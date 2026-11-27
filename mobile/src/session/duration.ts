import type { Recording, SessionMeta } from '../measure/recording';

/**
 * How long the session has lasted, on the elapsedRealtime clock of its samples,
 * from the meta line the service wrote when it began: „treba mi timer koji
 * pokazuje koliko dugo vec traje merenje" (PDL, „Mobilna aplikacija BTL-a
 * (27.11.2026)"). That clock keeps counting while the phone sleeps and while
 * Android has the service down, so the time a killed service was down is inside
 * the duration, as it is the same session.
 *
 * While it records, it lasts until now. Once it ended (the member stopped it, or a
 * restart of the phone ended it) it lasts until the last line written into it: the
 * only end the file holds, and the one that is the same however late the screen
 * reads it. A restart leaves nothing after it in `recording`, so its end is the
 * last line before the restart.
 */
export function sessionDurationMs(recording: Recording & { meta: SessionMeta }, now: number, live: boolean): number {
  const from = recording.meta.startedAt;
  if (live) return now - from;
  let last = from;
  for (const sample of recording.locations) last = Math.max(last, sample.receivedAt);
  for (const sample of recording.pressures) last = Math.max(last, sample.receivedAt);
  return last - from;
}

/** Whole seconds, as a watch shows them: 4:05 under an hour, 1:04:05 from an hour on. The same in both languages. */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const seconds = String(total % 60).padStart(2, '0');
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  return hours === 0 ? `${minutes}:${seconds}` : `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`;
}
