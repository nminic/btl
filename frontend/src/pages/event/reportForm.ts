import { prijava, unosRezultata } from '../../forms/definitions'
import type { FieldDef, FormDef } from '../../forms/types'
import type { RaceKind } from '../../data/types'

/** What the member is asked to measure where the race cannot measure it for them.
 *  In the order they are asked in on the form away from the calendar, since a
 *  member filling both in should meet the same three in the same order. */
const MEASURED = ['distanceKm', 'ascentM', 'descentM'] as const

/** What a race of a length answers for, so the member is not asked. */
const TIMED = ['hours', 'minutes', 'seconds'] as const

/**
 * The three measurements as the form away from the calendar already asks for them:
 * the same labels, the same hints, the same bounds, in the order that form asks
 * them in.
 *
 * Filtered rather than looked up one by one, so there is no branch here for a name
 * that is not there. A name that stops being there quietly gives fewer fields, and
 * what says so is a case rather than an exception nothing can reach
 * (`reportForm.test.ts` compares this list to `MEASURED` by name and to the written
 * definition field for field).
 */
const MEASURED_FIELDS: FieldDef[] = unosRezultata.fields.filter((one) =>
  MEASURED.some((name) => name === one.name),
)

function withMeasurements(asked: FieldDef[]): FormDef {
  return { ...prijava, fields: [...MEASURED_FIELDS, ...asked] }
}

/* Built once and kept, rather than on each call, for the reason
   `forms/definitions/index.ts` gives: these are handed to `FormRenderer` as a prop,
   and a fresh object on every render is a changed prop on every render, which ADL
   A2 records the cost of on the race form. A record and not a function with
   branches, so a kind added to `RACE_KINDS` and forgotten here does not compile. */
const BY_KIND: Record<RaceKind, FormDef> = {
  length: prijava,
  time: withMeasurements(prijava.fields.filter((one) => !TIMED.some((name) => name === one.name))),
  free: withMeasurements(prijava.fields),
}

/**
 * The form for reporting a result from a race, which is not the same form for
 * every kind of race.
 *
 * A race fixes one thing and leaves the other to whoever runs it (`data/types.ts`).
 * A race of a length knows how far it is, so the member gives the time and nothing
 * else. A timed race knows how long it lasts and is the same length of time for
 * everyone who finished it, so the member gives the distance, the climb and the
 * fall, and is not asked for a time at all. A free race fixes neither, so the
 * member gives all four. Owner, 29.08.2026: „Na vremenskoj trci član unosi dužinu,
 * uspon i spust. Vreme ne unosi, jer je zadato trkom", and on a free race „i
 * dužinu i uspon i spust i vreme".
 *
 * **Built from the two written definitions rather than written a third time.** The
 * three measurements are the ones the form away from the calendar already asks for
 * (`unos-rezultata`), so the two forms cannot come to ask for the same thing in two
 * ways: the same labels, the same hints and the same bounds, in the same order.
 * That is the precedent this follows, and it is the one this screen's neighbour
 * already uses to leave a field off a form (`admin/AdminEvents.tsx`, `copyOfEvent`).
 *
 * Asked by name and not by position, and what happens when a name stops being there
 * is answered by a case rather than by an exception nothing can reach.
 */
export function reportForm(kind: RaceKind): FormDef {
  return BY_KIND[kind]
}
