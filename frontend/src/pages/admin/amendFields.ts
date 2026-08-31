import { dogadjaj, unosRezultata } from '../../forms/definitions'

/** The names of the boxes that make a time, and the race they belong to, as the
 *  form away from the calendar asks for them. */
const TIMED = ['raceName', 'hours', 'minutes', 'seconds']

/**
 * What this panel writes into, each paired with the definition that owns it: the
 * race and the three boxes of a time from the form away from the calendar, and
 * the event from the form that makes one.
 *
 * **The event by its own definition and not by the race's.** The two agree today,
 * so the difference is invisible until one of them moves, and the day it does the
 * panel would hold the event to a limit the administration does not.
 *
 * A list of pairs rather than a lookup by name: a lookup answers „or nothing" for
 * a name that is always there, and the nothing is a branch no case can reach. The
 * price is that a field renamed in a definition would quietly leave this list, so
 * the list is counted in `adminFlows.test.tsx` rather than trusted.
 */
export const ASKED = [
  ...unosRezultata.fields
    .filter((one) => TIMED.includes(one.name))
    .map((field) => ({ name: field.name, field })),
  ...dogadjaj.fields
    .filter((one) => one.name === 'name')
    .map((field) => ({ name: 'eventName', field })),
]
