import { useContext } from 'react'
import { ClockContext, type ClockValue } from './context'

/** The clock itself, for the one control that is allowed to move it. */
export function useClock(): ClockValue {
  const value = useContext(ClockContext)

  if (value === null) {
    throw new Error('useClock must be used inside ClockProvider')
  }

  return value
}

/** What day it is, yyyy-mm-dd, which is the shape every record keeps a date in
 *  and therefore the shape a screen can compare against without converting. */
export function useToday(): string {
  return useClock().today
}

/**
 * The same day as a date at midnight UTC.
 *
 * For the two places that count in years rather than compare days: how old the
 * person filling the form is, and which month a calendar should open on. Both
 * used to be handed the clock complete with the time of day, and both threw the
 * time away; taking the day the portal agreed on is the same answer, and it is
 * the same answer as every other screen's.
 */
export function useTodayDate(): Date {
  return new Date(`${useToday()}T00:00:00Z`)
}
