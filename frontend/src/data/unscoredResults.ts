import type { Result } from './types'
import { useResource, type ResourceState } from './useResource'

/**
 * THE RESULTS OF THE RACES THE LEAGUE DOES NOT SCORE, as the server serves them at
 * `GET /api/unscored-results` (PDL, 14.11.2026, „Ostale discipline kao lična evidencija").
 *
 * <p><b>The same row as `/api/results` and the same type</b>: a swim, a ride or a triathlon is a
 * length, an ascent, a descent and a time like any other run on the portal. The only thing that
 * differs is `points`, which is 0 and is never drawn as a number (`pages/CompetitorProfile.tsx`
 * and `pages/member/MyResults.tsx` write „–").
 *
 * <p><b>Read by exactly two screens, and that is the whole of the design.</b> `/api/results`
 * serves only the scored results, so every counter, board, standing and total on the portal reads
 * a list an unscored result is not in. This list is asked for by the profile, which draws it
 * beside the scored ones, and by „Moji rezultati". A screen that merged this list into
 * `useResults` would put an unscored result into the league's arithmetic, which is the one thing
 * the owner's decision rules out.
 *
 * <p><b>No overlay of deletions here.</b> The writes that take an unscored result away are the
 * next step of the increment (entering and correcting results on every door), and they clear this
 * name from the cache the way `resultWrites.ts` clears `results`.
 */
export const useUnscoredResults = (): ResourceState<Result[]> =>
  useResource<Result[]>('unscored-results')
