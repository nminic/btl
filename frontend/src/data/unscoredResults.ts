import { useMemo } from 'react'
import type { Result } from './types'
import { combinePair, useLive, useResource, useResults, type ResourceState } from './useResource'

/** What a deletion of an unscored result is filed under, beside `RESULTS` for the scored ones. */
export const UNSCORED_RESULTS = 'unscored-results'

/**
 * THE RESULTS OF THE RACES THE LEAGUE DOES NOT SCORE, as the server serves them at
 * `GET /api/unscored-results` (PDL, 14.11.2026, „Ostale discipline kao lična evidencija").
 *
 * <p><b>The same row as `/api/results` and the same type</b>: a swim, a ride or a triathlon is a
 * length, an ascent, a descent and a time like any other run on the portal. The only thing that
 * differs is `points`, which is 0 and is never drawn as a number (`pages/CompetitorProfile.tsx`
 * and `pages/member/MyResults.tsx` write „–").
 *
 * <p><b>Read only where a run is drawn and never where one is counted, and that is the whole of the
 * design.</b> `/api/results` serves only the scored results, so every counter, board, standing and total
 * on the portal reads a list an unscored result is not in. This list is asked for by „Moji rezultati" and
 * by the page of an event; the profile, which draws it beside the scored ones, asks since 22.11.2026 for
 * the member's own answer of it at `/api/competitors/{broj}/unscored-results` (`data/hisResults.ts`),
 * which is the same rows with his number on them. A screen that merged this list into
 * `useResults` would put an unscored result into the league's arithmetic, which is the one thing
 * the owner's decision rules out.
 *
 * <p><b>And the same overlay of deletions as `useResults`</b> (`useLive`), since the page of an
 * unscored event takes a result away with its x (PDL, 14.11.2026, „Strana događaja nebodovane trke
 * prikazuje rezultate članova kao kod bodovane"): the row goes at once and not on the next read.
 * Every write that drops `results` from the cache drops this name with it (`data/client.ts`,
 * `GO_WITH`).
 */
export const useUnscoredResults = (): ResourceState<Result[]> =>
  useLive(useResource<Result[]>('unscored-results'), UNSCORED_RESULTS, 'id')

/**
 * EVERY RESULT, SCORED AND UNSCORED, FOR A QUESTION ABOUT A RUN THAT IS NOT ONE THE LEAGUE COUNTS.
 *
 * <p>Who ran an event (whether he may rate it, PDL, 15.11.2026: „Član koji na događaju ima samo nebodovan
 * rezultat sme da oceni događaj”), which run a pencil on the event page is on, and how many results go with
 * an event, its races or a change of its kind (PDL, 14.11.2026, „pitanje pri prelasku nebodovane trke u
 * trening ili skup broji njene nebodovane rezultate”). Each of those is about the row of `result` whichever
 * list it is served on, and asked of one list it says nothing about an unscored event.
 *
 * <p>**Never for a count the league makes.** A standing, a board or a total reads `useResults`,
 * which an unscored result is never in; that is the whole of the design (see the head of this file).
 */
export function useEveryResult(): ResourceState<Result[]> {
  const scored = useResults()
  const unscored = useUnscoredResults()

  return useMemo(() => {
    const both = combinePair(scored, unscored)

    return both.status === 'ready' ? { status: 'ready', data: [...both.data[0], ...both.data[1]] } : both
  }, [scored, unscored])
}
