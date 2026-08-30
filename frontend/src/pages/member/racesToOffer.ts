import type { BtlEvent, Race } from '../../data/types'
import type { Suggestion } from '../../forms/types'
import { fieldDate } from '../../forms/dateField'
import { raceKind } from '../../data/raceKind'
import { raceMeasure } from '../../data/raceLabel'
import { formatNumericDate } from '../../i18n/format'

/**
 * The races the calendar already holds, offered while an event name is typed
 * (owner, 23.08.2026).
 *
 * Only what has been run, and newest first: „U autocomplete se navode samo
 * dogadjaji koji su u proslosti ili na taj dan, ne ubuduce", sorted „po datumu od
 * poslednje prema ranijim". A race still to come is not a result anybody can
 * enter (PDL P9 refuses a date in the future), so offering it would be offering a
 * row the form then refuses.
 *
 * One entry per race and not per event, because what is filled in is a race: an
 * event of five distances is five rows, told apart by the day and the length,
 * which is what the row says after the name.
 *
 * The races are grouped once rather than searched for each event, because the
 * data is eleven hundred events against sixteen hundred races and this is built
 * on every letter typed until it is memoised.
 */
export function racesToOffer(
  events: BtlEvent[],
  races: Race[],
  today: string,
  locale: string,
): Suggestion[] {
  const byEvent = new Map<string, Race[]>()

  for (const race of races) {
    byEvent.set(race.eventId, [...(byEvent.get(race.eventId) ?? []), race])
  }

  const pairs = events.flatMap((event) =>
    (byEvent.get(event.id) ?? [])
      .filter((race) => race.date <= today)
      .map((race) => ({ event, race })),
  )

  pairs.sort((left, right) => right.race.date.localeCompare(left.race.date))

  return pairs.map(({ race }) => ({
    id: race.id,
    /* The **race** is what is searched for and what goes into the box, since
       23.08.2026: „sad je postalo logičnije da se pretražuje zapravo naziv trke sa
       datumom i dužinom" (owner). Until that day a race had no name of its own and
       the event's stood in for it.

       Only the name goes into the box (owner: „u polje se upisuje samo naziv").
       The day and the length are what one race of an event is told apart from
       another by, and they go into the fields under it rather than into the
       name.

       The third of the three is what the race is measured by and not its length,
       since 30.08.2026: a timed race is offered as „24 h" and a free one is
       offered by its name and day alone, because there is nothing to measure it
       by until somebody has run it. Asked of `raceMeasure`, which is the same
       answer the brackets of a name carry, so the two cannot drift (ADL A31). */
    value: race.name,
    said: [race.name, formatNumericDate(race.date), raceMeasure(race, locale)]
      .filter((one) => one !== '')
      .join(' – '),
    /**
     * What choosing the race fills in under the box, and what choosing it locks.
     *
     * The two are the same list: the renderer locks by the **keys** of this
     * (`forms/FormRenderer.tsx`, `setLed(Object.keys(one.fills))`), not by the
     * values. A key with an empty string is a field that is empty and cannot be
     * typed into, which is a form nobody can send. A round of this filled the
     * length with „" for a timed race and called it „theirs to fill"; it was
     * neither filled nor theirs.
     *
     * So a race that does not fix its length hands over the day and nothing else.
     * That is also what the owner asked for on 29.08.2026: „Na vremenskoj trci član
     * unosi dužinu, uspon i spust", and on a free race the time as well. A course
     * run in laps has a climb that depends on how many laps somebody ran, so the
     * race cannot know it either.
     *
     * ADL A32 wrote this rule down after the same fault in another form: a lock
     * says what the reader may not change, so locking what the portal has not
     * filled in makes a dead end.
     */
    fills: {
      date: fieldDate(race.date),
      ...(raceKind(race.kind) === 'length'
        ? {
            distanceKm: String(race.distanceKm),
            ascentM: String(race.ascentM),
            descentM: String(race.descentM),
          }
        : {}),
    },
  }))
}
