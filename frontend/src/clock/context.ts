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
 * Known and deliberately left alone: this is the UTC day, which is what all
 * eleven callers computed before. In Belgrade that is the previous day between
 * midnight and 01:00 or 02:00, and the season runs on CET (PDL P4). The season
 * boundary belongs to the backend, which owns the freeze at 1 January 16:00,
 * and it must not be answered twice in two different zones. Written down here
 * so the day it matters, it is found at once.
 */
export function realToday(): string {
  return new Date().toISOString().slice(0, 10)
}
