import type { BtlEvent, League, Race } from '../../data/types'

/** One event of a competition, with the races of it that the competition counts. */
export type EventRaces = { event: BtlEvent; races: Race[] }

/**
 * The races a competition counts, which are the ones its record names and no others.
 *
 * **This is the one place a competition is asked which races are in it, and since 01.10.2026 it
 * answers out of `League.raceIds`** (`data/types.ts`). It answered out of the events until then,
 * so every race of a day the competition held was in it, whether or not anybody had chosen it:
 * a day with four distances of which the competition counts one drew all four, in the box that
 * lists them and in the standing that adds them up. The owner had decided the other way on
 * 12.09.2026 (`PDL.md`): „izbor događaja bira sve njegove trke odjednom, a sme se izabrati i samo
 * neka trka", and „Trka koja se doda posle sklapanja čeka da je neko izabere" - a race entered
 * into a day after the competition was put together is not in it until somebody puts it there,
 * which a reading by days could never say.
 *
 * **What reads this, and so reads nothing else.** The standing (`leagueTable.ts`), the box that
 * lists the days and the races under them (`LeagueEvents.tsx`), and the count of days on the row
 * of a competition (`Leagues.tsx`) all take their races from here, and the number of people in a
 * competition is counted off the standing. A reading of `eventIds` anywhere beside this one is
 * the same fault in another place.
 *
 * **The Balkan league does not come through here.** It is not a record, and it counts every race
 * of every event of the kind „trka" in the calendar, by the owner's decision of the same day.
 *
 * **Which races, and in what order.** Those of the list handed in, in the order they were handed
 * in; the order of `raceIds` itself is the server's and decides nothing here. A name in `raceIds`
 * that is not among the races handed in is simply not found, and an empty `raceIds` is an empty
 * list whatever days the record still names: the races are what is counted.
 */
export function leagueRaces(league: League, races: Race[]): Race[] {
  const counted = new Set(league.raceIds)

  return races.filter((race) => counted.has(race.id))
}

/**
 * Those races under the event each of them belongs to, oldest event first.
 *
 * **Built out of the races and grouped by the event, never the other way round** (owner,
 * 12.09.2026). An event none of whose races the competition counts is not a heading with
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
  const byEvent = new Map<number, Race[]>()

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
