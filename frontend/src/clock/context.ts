import { createContext } from 'react'

export type ClockValue = {
  /** The day the portal is being read as, yyyy-mm-dd. */
  today: string
  /** The day somebody put the clock on, and null while it reads the real one. */
  simulated: string | null
  /** Move the clock to a day, or hand it back to the machine with null. */
  simulate: (day: string | null) => void
}

export const ClockContext = createContext<ClockValue | null>(null)

/** The zone the league's days are counted in, which is the server's (`SeasonClock`). */
const THE_LEAGUES_ZONE = 'Europe/Belgrade'

/* Built once, and with the zone written out: a formatter given no zone formats in the
 * zone of whichever machine is reading, which is a third answer to a question that has
 * two already. Parts rather than a locale's own way of writing a date, so that the
 * result does not depend on what a locale does with its separators. */
const BELGRADE = new Intl.DateTimeFormat('en-US', {
  timeZone: THE_LEAGUES_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * The calendar day an instant falls on in Belgrade, yyyy-mm-dd.
 *
 * The zone's own rules do the work, so winter (CET, UTC+1), summer (CEST, UTC+2) and the
 * two nights a year the offset changes are all answered by the same line: a fixed
 * one-hour offset would be right for half the year and wrong in the other half. Pure and
 * given its instant, so a case can ask it about 23:30 UTC without moving the system
 * clock.
 */
export function belgradeDay(instant: Date): string {
  const part = Object.fromEntries(
    BELGRADE.formatToParts(instant).map(({ type, value }) => [type, value]),
  )

  return `${part.year}-${part.month}-${part.day}`
}

/**
 * The one place in the portal that reads the machine's clock.
 *
 * One place because a simulated date is only worth anything if it is not
 * possible to go around it. Eleven screens used to call `new Date()` for
 * themselves, and a simulation that reached ten of them would be worse than
 * none: the calendar would open on a month the price beside it disagreed with,
 * and the disagreement would look like a bug in the portal rather than in the
 * simulation. A test reads the source and fails on a second reader
 * (oneClock.test.ts).
 *
 * **The day is Belgrade's, not UTC's** (owner, 20.10.2026, ADL A7), the same day the
 * server counts in. It was the UTC day until then, which in Belgrade is the previous
 * day between midnight and 01:00 in winter or 02:00 in summer: in that hour an event's
 * page still offered the arrival announcement for the event of the day before
 * (PENDING 29202). One zone for the screen and the server, so the season boundary is
 * answered on both sides at the same instant rather than twice in two zones.
 */
export function realToday(): string {
  return belgradeDay(new Date())
}
