import { daysBetween, shiftDate } from '../../forms/dateField'
import type { Race } from '../../data/types'

/**
 * An event put on another day, with its races.
 *
 * One event may run over more than one morning, and each race carries the day it
 * is run on (owner, 10.08.2026). Moving the event therefore moves all of them by
 * the same number of days, so the shape of the weekend survives: two races on the
 * Saturday and one on the Sunday are still two and one, a year on, and a single
 * race is corrected on its own form afterwards.
 *
 * Written once and called from both places that move an event, because there are
 * two: the form in the administration, and a reported change of date the
 * moderator accepts. The second one used to write the event's day alone, which
 * put an event and its races a week apart in one press.
 */
export function moveEvent(
  eventId: string,
  from: string,
  to: string,
  races: Race[],
  editRecord: (id: string, values: Record<string, string>) => void,
): void {
  const days = daysBetween(from, to)

  editRecord(eventId, { date: to })

  /* Nothing to move where the day has not changed, and nothing to move where
     either day is not a date: `daysBetween` answers nought to both, and a loop
     that wrote every race back unchanged would fill the overlay with edits
     nobody made. */
  if (days === 0) {
    return
  }

  for (const race of races.filter((one) => one.eventId === eventId)) {
    editRecord(race.id, { date: shiftDate(race.date, days) })
  }
}
