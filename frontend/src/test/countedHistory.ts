import { afterEach, beforeEach, vi } from 'vitest'

/**
 * THE HISTORY, SERVED AS RUNS THAT A SEASON COUNTS, AND NOTHING ELSE ABOUT IT CHANGED.
 *
 * **Why this exists.** `test/mock/results.json` is the imported history of 2010 to 2026, and no
 * season counts a run of a year before the league or of a year its member was no member of (PDL P9,
 * the owner's choice of 18.10.2026; `Result.inItsSeason`, `data/derive.ts`, `seasonOf`). The
 * competitions of the generated files are of those years (`brdska-2019` and the rest), so as served
 * every standing of a competition has nobody in it, and a case about how such a standing is drawn
 * would measure an empty one.
 *
 * **What it does not do:** it moves no year, unlike `test/leagueSeasons.ts`, whose cases need a
 * season the league runs and not only a run that counts. A competition is of its own season, and
 * what its cases measure is the layout of a standing.
 *
 * **What it does not stand in for:** that a run counting in no season stays out of a standing.
 * That is measured where the runs are written case by case (`pages/league/leagueTable.test.ts`,
 * `data/seasonCounts.test.ts`), never through this.
 */
export function countTheHistoryInItsSeasons(): void {
  let before: typeof globalThis.fetch | undefined

  beforeEach(() => {
    const served = globalThis.fetch

    before = served
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const answer = await served(input, init)
      const path = String(input).split('?')[0] ?? ''

      if ((init?.method ?? 'GET') !== 'GET' || !path.endsWith('/api/results') || !answer.ok) {
        return answer
      }

      const body: unknown = await answer.json()

      return new Response(
        JSON.stringify(
          Array.isArray(body)
            ? body.map((one: unknown) =>
                typeof one === 'object' && one !== null ? { ...one, inItsSeason: true } : one,
              )
            : body,
        ),
        { status: answer.status, headers: { 'content-type': 'application/json' } },
      )
    })
  })

  afterEach(() => {
    if (before !== undefined) {
      vi.stubGlobal('fetch', before)
    }
  })
}
