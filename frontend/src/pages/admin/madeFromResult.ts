import type { Submission } from '../../session/context'
import { categoryOf } from '../../data/raceCategory'
import { raceKind } from '../../data/raceKind'

/**
 * The event and the race a submission asks verification to make, when the member
 * ran something the calendar does not hold.
 *
 * Promised to the member before the portal could do it: point 7 of the terms of
 * use says „Ako trke nema u kalendaru, prijavite je svejedno; administrator će uz
 * vaš rezultat napraviti i događaj i trku." Decided on 30.08.2026 and built here.
 *
 * **Every field named, none left to a spread.** Three writers of a race record
 * already exist and one of them was found missing a field it had never been told
 * about (PR 170); a record built from `...one` would take whatever a submission
 * grows next and write it into the calendar. What a race is made of is written out,
 * so a field added to a submission does not silently become a field of a race.
 *
 * The kind and the time are the administration's by then: the member's answer was
 * a hint and the panel in the queue is where it is settled (owner, 30.08.2026), so
 * what is read here is what the submission holds at the moment of approval.
 */
export function eventFrom(one: Submission): Record<string, string> & { date: string } {
  return {
    /* The name the moderator settled, which starts as the race's own and is theirs
       to shorten (owner, 31.08.2026). A submission that was never opened in the
       panel carries none, and then the race's name is the event's, which is what
       the panel would have offered them. */
    name: one.eventName ?? one.raceName,
    date: one.date,
    city: one.city,
    country: one.country,
    /* A race, because that is what somebody ran. A gathering and a training are
       entered by the administration and nobody reports a result from one. */
    kind: 'race',
    featured: 'no',
    description: '',
    link: '',
    /* Not a copy of anything. The owner was asked whether the record should
       remember that it grew out of a submission and said no: „Ne, događaj je
       događaj" (31.08.2026). */
    copiedFrom: '',
  }
}

/* The address an event answers on was built here for one round and never reached
   anything: `idFor` reads the values it is handed only where an entity names
   itself, and an event does not; what an event answers on is worked out from its
   name and its date when the record is read (`entityForms.ts`, `EVENTS.derived`).
   Removed rather than left with a comment claiming a role it never had. */
/** The race itself, under the event above. */
export function raceFrom(one: Submission, eventId: string): Record<string, string> {
  return {
    eventId,
    name: one.raceName,
    /* Given by hand, whatever it started as: the member typed it and the moderator
       may have changed it, and neither is the event renaming its races. */
    renamed: 'yes',
    date: one.date,
    kind: raceKind(one.raceKind),
    /* What a timed race is run to, and nought for the other two. On such a race the
       three boxes hold the limit rather than a run (owner, 30.08.2026), so the
       number the result carries is the race's own. */
    limitSeconds: String(raceKind(one.raceKind) === 'time' ? one.seconds : 0),
    distanceKm: String(one.distanceKm),
    ascentM: String(one.ascentM),
    descentM: String(one.descentM),
    /* Worked out from the length, as everywhere else (`data/raceCategory.ts`), and
       not carried over from the submission: the member's own is worked out the same
       way, so copying it would be a second home for one arithmetic. */
    category: categoryOf(one.distanceKm),
  }
}
