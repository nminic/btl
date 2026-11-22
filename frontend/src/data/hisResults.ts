import type { Result } from './types'
import { UNSCORED_RESULTS } from './unscoredResults'
import { RESULTS, useLive, useResource, type ResourceState } from './useResource'

/**
 * THE RUNS OF ONE MEMBER, AS HIS PROFILE DRAWS THEM: `GET /api/competitors/{memberNumber}/results` and
 * `.../unscored-results` (`ResultApi.resultsOf`), instead of the whole league.
 *
 * <p>Inkrement „Poboljšanje performansi”, korak 1, owner, 21.11.2026: „Profil traži samo rezultate tog
 * člana (nova ruta, na primer `/api/competitors/{broj}/results`) umesto rezultata cele lige.” Measured on
 * production on 22.11.2026 for 000001, the member with the most runs: 86 KB over the wire and 993 KB to
 * parse for the league, 12.6 KB and 116 KB for him.
 *
 * <p><b>The same rows and the same type as `useResults` and `useUnscoredResults`</b>: the server serves at
 * his address exactly the rows of `/api/results` and `/api/unscored-results` that carry his number, by the
 * same query, so the profile is drawn from them exactly as it was drawn from those. And the same overlay of
 * deletions, under the same two names (`useLive`), so a run taken away during the visit goes from his page
 * at once as it did.
 *
 * <p><b>Read through the visit's cache, and that is what keeps a reader's place in it.</b> Coming back from
 * an event to a profile half read finds his runs in hand at the first paint, so the router has a page to
 * put the scroll back into (owner, 04.08.2026, `data/client.ts`). Whatever drops `results` or
 * `unscored-results` drops every member's answer of them too (`client.ts`, `ONE_MEMBERS_DOORS`), so no
 * screen that writes a result has to know the profile reads it this way.
 *
 * <p><b>Who may reach the page is not decided here</b> and never was: the server answers these to anybody,
 * as it answers the whole league, and the page decides whether to draw them (`pages/profile/visible.ts`).
 *
 * @param memberNumber the number on the profile's address, never empty (`CompetitorProfile` answers an
 *   address with no number before anything is asked)
 */
export const useHisResults = (memberNumber: string): ResourceState<Result[]> =>
  useLive(useResource<Result[]>('results', { member: memberNumber }), RESULTS, 'id')

/** His runs of the races the league does not score, on the terms of {@link useHisResults}. */
export const useHisUnscoredResults = (memberNumber: string): ResourceState<Result[]> =>
  useLive(useResource<Result[]>('unscored-results', { member: memberNumber }), UNSCORED_RESULTS, 'id')
