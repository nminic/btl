/**
 * WHICH RACES A COMPETITION COUNTS, READ OFF THE ANSWER ITSELF.
 *
 * **Why this is not `League.raceIds` in `data/types.ts`, where it belongs.**
 * `/api/leagues` has answered with `raceIds` since B40 and the portal's own type does not
 * carry it (`data/servedShape.test.ts` names that in as many words: „`/api/leagues` answers
 * with `raceIds` and the portal does not read it yet"). The moderation of a competition is
 * the first screen that has to, because from B40 on a day of four distances may count one of
 * them - so `eventIds` answers „which days" and cannot answer „which races".
 *
 * Adding the field to the shared type is one line and is the right home for it. It is not
 * done here because `data/types.ts` is being changed by two other flows in this same window,
 * and the rule this project keeps is that independence is counted rather than felt: two
 * branches touching one file are not independent, whatever the change looks like. So this
 * reads the field off the served answer, the boundary is written down rather than left to be
 * found, and the field moves to the type in the increment that can have that file.
 *
 * **Read without an assertion (ADL A14).** What comes off the wire is `unknown` and is
 * narrowed by looking at it, so an answer of some other shape yields an empty list rather
 * than being claimed to hold one. That is the same rule `pages/account/askTheServer.ts`
 * reads a refusal by, and it is what makes this safe to point at a resource whose type says
 * nothing about the field.
 */

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
