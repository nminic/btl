/**
 * WHICH RACES A COMPETITION COUNTS, READ OFF THE ANSWER ITSELF.
 *
 * **Why this reads the field off the answer and not off `League.raceIds`, and it is a leftover
 * named as one.** `/api/leagues` has answered with `raceIds` since B40, and the moderation of a
 * competition was the first screen that had to ask for it: from B40 on a day of four distances
 * may count one of them, so `eventIds` answers „which days" and cannot answer „which races".
 * The portal's own type did not carry the field then, which is what this module was written
 * around. **It does since 01.10.2026**, because the standing and the list of competitions count
 * by it now (`pages/league/leagueCounting.ts`, `data/types.ts`), and this module was not moved
 * with them: moving it is a change to the screens of the administration, and the increment that
 * moved the public ones touches nothing under `admin/`. The answer read here is the same one,
 * so nothing disagrees; the day somebody does move it, it is `league.raceIds` and this reading
 * of an `unknown` goes.
 *
 * **Read without an assertion (ADL A14).** What comes off the wire is `unknown` and is
 * narrowed by looking at it, so an answer of some other shape yields an empty list rather
 * than being claimed to hold one. That is the same rule `pages/account/askTheServer.ts`
 * reads a refusal by, and it is what makes this safe to point at a resource whose type says
 * nothing about the field.
 */

import type { BtlEvent, Race } from '../../data/types'
import { racesByEvent, type EventRaces } from '../league/leagueCounting'

/** A number that really is one, which `JSON.parse` does not promise. */
function numbersIn(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((one) => typeof one === 'number') : []
}

/**
 * The races the competition with this key counts, oldest first as the server ordered them,
 * or nothing at all where the answer says nothing about it.
 *
 * **Nothing and an empty list are deliberately one answer.** A competition that counts no
 * race yet is a real state - the state every one of them is in before its season - and a
 * screen that told it apart from „the answer did not carry the field" would be drawing a
 * difference nobody can act on.
 */
export function countedRacesOf(served: unknown, leagueId: number): number[] {
  if (!Array.isArray(served)) {
    return []
  }

  const mine = served.find(
    (one: unknown) =>
      typeof one === 'object' && one !== null && Reflect.get(one, 'id') === leagueId,
  )

  return mine === undefined ? [] : numbersIn(Reflect.get(mine, 'raceIds'))
}

/**
 * THOSE RACES UNDER THE DAY EACH OF THEM BELONGS TO, AND IT IS ONE CALL SO THAT THE COUNT IN THE ROW
 * ON THE ROW AND THE BOX UNDER IT CANNOT DISAGREE.
 *
 * **This exists because they did disagree, on QA, and the owner read it as work lost**
 * (28.09.2026, his own words: „Popunim ovo ovako i onda se nista ne sacuva, nije se
 * kreirala Liga sa ovim dogadjajem"). Nothing had been lost: `league` held its row,
 * `league_race` held four, and `GET /api/leagues` answered with every one of them. The row
 * said „Bez dogadjaja" because it was counting `League.eventIds` - the field of the answer
 * this screen was served BEFORE the panel under it wrote anything - while the panel was
 * counting what it had just written. A true record and a false sentence about it.
 *
 * **The portal had already answered which of the two numbers is right, and not here.**
 * `pages/Leagues.tsx` stopped reading `eventIds` on 13.09.2026 for the same reason on the
 * public list („the row follows the box rather than the other way round"), and
 * `V20__league_reads_races` is what settles it: from that migration on, a competition's days
 * ARE the days of its races. So the count is taken off the races and the days are grouped out
 * of them, never the other way about.
 *
 * **What it costs, named rather than left to be found.** A served answer cannot tell the two
 * readings apart - `LeagueApi` builds `eventIds` by aggregating over the races it counts - so
 * this changes no number the server produces. It changes two: a competition entered during
 * this visit, whose `eventIds` is the empty list `entityForms.ts` gives a new record and can
 * never be anything else; and the generated file's `brdska-2019`, whose list of days was
 * written by hand and holds one day whose races nothing counts. Both now read as what they
 * are.
 */
export function countedDaysOf(counted: number[], races: Race[], events: BtlEvent[]): EventRaces[] {
  return racesByEvent(
    races.filter((race) => counted.includes(race.id)),
    events,
  )
}
