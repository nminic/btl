import type { BtlEvent, Race } from '../../data/types'
import type { Suggestion } from '../../forms/types'
import { fieldDate } from '../../forms/dateField'
import { formatNumericDate } from '../../i18n/format'
import { racesToOffer } from './racesToOffer'

/**
 * THE EVENTS A MEMBER MAY NAME FOR A RESULT, AS THE ENTRIES OF THE BOX „DOGAĐAJ".
 *
 * <p>PDL P9, owner, 19.10.2026: „Prvo ima naziv događaja koji je autocomplete iz baze, ali mogu da
 * unesem novu vrednost", and of what it offers: „autocomplete ne treba da vuce dogadjaje van aktuelne
 * sezone". So an event is offered when:
 *
 * <ul>
 * <li>it is a race - an event of another kind holds no races (owner, 23.08.2026), and a run is on a
 * race (the coordinator's answer Q9 of 7a, 19.10.2026);
 * <li>its year is a season open for a report at this moment, which the server says
 * (`MeApi.WhoIAm.seasonsOpenForAReport`, the window's one home) and this does not work out;
 * <li>it has begun by today: its day is its first race's, and a run is on a race already run.
 * </ul>
 *
 * <p><b>Choosing one fills the day of the race with the event's own day, and locks only the event</b>
 * (`holds`): „Povuce se datum dogadjaja po default-u, a onda se prepopuni i datum trke, ali ga mogu
 * dalje menjati" (owner, 19.10.2026). The event's key rides in the values as `eventId`, which no box
 * draws, the way `raceId` rides beside a race (`racesToOffer.ts`).
 *
 * <p>Newest first, the order the races under it are offered in.
 *
 * @param open  the seasons the server says are open, possibly none (before 2027, owner: „NIŠTA!")
 * @param today the day the portal agrees on, as every screen compares days
 */
export function eventsToOffer(events: BtlEvent[], open: number[], today: string): Suggestion[] {
  return events
    .filter((one) => one.kind === 'race' && open.includes(yearOf(one.date)) && one.date <= today)
    .toSorted((left, right) => right.date.localeCompare(left.date))
    .map((one) => ({
      id: String(one.id),
      value: one.name,
      said: [one.name, formatNumericDate(one.date), one.city].filter((part) => part !== '').join(' – '),
      fills: { eventId: String(one.id), date: fieldDate(one.date) },
      holds: ['eventId'],
    }))
}

/**
 * THE RACES OF THE EVENT HE CHOSE, as the entries of the box for the race: „ako je postojeća vrednost, polje trka postaje autocomplete u koji se ukucava postojeća ili
 * nova trka" (owner, 19.10.2026). Nothing where no event of the calendar is chosen: a new event has
 * no races, and its race takes the name the event was given (`FormRenderer`, `follows`).
 *
 * <p>Through `racesToOffer`, so a race offered here fills and locks exactly what it does everywhere
 * else, and its day and measure read the same, and nothing still to come is offered.
 *
 * <p><b>No season is asked of a race here, and that is measured, not left out</b>: the event was
 * offered only in a season open for a report, and a race of it run by today is in that season or in
 * the year today is in, which is open whenever the event's is. A second filter would be a branch no
 * state of the calendar can reach.
 *
 * @param chosen the key of the chosen event as the values hold it, or empty where none is chosen
 */
export function racesOfTheChosenEvent(
  events: BtlEvent[],
  races: Race[],
  chosen: string,
  today: string,
  locale: string,
): Suggestion[] {
  const event = events.find((one) => String(one.id) === chosen)

  return event === undefined ? [] : racesToOffer([event], races, today, locale)
}

/** The year of a day kept as `yyyy-MM-dd`, which is how every record keeps one. */
function yearOf(day: string): number {
  return Number(day.slice(0, 4))
}
