import type { BtlEvent, League, Race } from '../../data/types'

/** One event of a competition, with the races of it that the competition counts. */
export type EventRaces = { event: BtlEvent; races: Race[] }

/**
 * The races a competition counts.
 *
 * **This is the one place a competition is asked which races are in it, and the one place
 * `raceIds` will narrow when the record carries it.** Today the record names events
 * (`League.eventIds`, `data/types.ts`), so every race of an event the competition holds is in
 * it; the backend that names races is on a branch of its own and is not merged. When it lands,
 * the line below is what changes, and nothing above it: what reads this gets a list of races
 * either way.
 *
 * **What cannot be measured until that day, written down rather than left to be found.** With
 * only `eventIds` there is no arrangement of the real data in which some races of an event count
 * and others do not, so no screen can tell „the list is built from the races" from „the list is
 * built from the events and their races". What can be told apart, and is, is an event the
 * competition holds that has no race at all: it is absent from the list, and that is what
 * `racesByEvent` below is measured on. The other half is measured on the function itself
 * (`leagueCounting.test.ts`), where two races of an event can be handed in and the third left
 * out.
 */
export function leagueRaces(league: League, races: Race[]): Race[] {
  const held = new Set(league.eventIds)

  return races.filter((race) => held.has(race.eventId))
}

/**
 * Those races under the event each of them belongs to, oldest event first.
 *
 * **Built out of the races and grouped by the event, never the other way round** (owner,
 * 12.09.2026). An event the competition holds that has no race in it is not a heading with
 * nothing under it; it is not there at all. That is the same answer the standing already gives
 * its columns, and for the same reason (`leagueTable.ts`): an event entered a fortnight before
 * its distances are known (owner, 23.08.2026) is such an event, and it appears here the day its
 * first race does.
 *
 * **The order is the one the season is run in**, oldest first, which is the order the calendar
 * and the standing above it already show. Two events on one day keep the order their names sort
 * in, so the list does not shuffle between renders; the data holds such a pair (two half
 * marathons in Mandarine, 3.11.2019).
 *
 * **Inside an event, the day and then the distance**, which is the order the event's own page
 * lists its races in (`pages/EventDetail.tsx`). One event may run over several mornings (PDL
 * P10), so the day comes first there and the distance parts the races of one morning.
 */
export function racesByEvent(races: Race[], events: BtlEvent[]): EventRaces[] {
  const byEvent = new Map<string, Race[]>()

  for (const race of races) {
    byEvent.set(race.eventId, [...(byEvent.get(race.eventId) ?? []), race])
  }

  return events
    .flatMap((event) => {
      const mine = byEvent.get(event.id)

      return mine === undefined
        ? []
        : [
            {
              event,
              races: [...mine].sort(
                (left, right) =>
                  left.date.localeCompare(right.date) || left.distanceKm - right.distanceKm,
              ),
            },
          ]
    })
    .sort(
      (left, right) =>
        left.event.date.localeCompare(right.event.date) ||
        left.event.name.localeCompare(right.event.name),
    )
}
