/**
 * THE WORD AN EVENT'S OWN PAGE LEAVES FOR THE CALENDAR WITH, once it has deleted the event (PDL, 25.10.2026, „Odgovori od
 * 25.10.2026 (noć): prozor brisanja": the event is deleted through the same sheet as everywhere, and „posle brisanja ide
 * poruka kao na ostalim mestima").
 *
 * <p>The same shape as `teamDeleted.ts`, for the same reason: carried in the state of the navigation, so it belongs to that
 * one arrival at the calendar and a reader who comes to it any other way is told nothing.
 */
export const EVENT_DELETED = { eventDeleted: true } as const

export function eventWasDeleted(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'eventDeleted' in state && state.eventDeleted === true
}
