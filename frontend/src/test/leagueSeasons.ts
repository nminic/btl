import { afterEach, beforeEach, vi } from 'vitest'
import { FIRST_SEASON } from '../data/season'

/**
 * THE IMPORTED HISTORY, READ AS IF THE LEAGUE HAD RUN IT.
 *
 * **Why this exists, and it is a decision rather than a convenience.** Owner,
 * 16.10.2026: „Prva sezona je 2027, pa su samim tim svi brojači na nuli, a i sve su
 * statistike prazne jer nema trka u 2027. godini. Ovo se odnosi na rang liste,
 * Tabelu, naslovnu stranu i sl." And 10.10.2026: „Ne postoje obracuni liga" before
 * 2027. So the table, the top boards, the front page and the standing of the teams
 * neither open on nor offer a season before 2027 (`seasonShown`, `seasonsOnOffer`),
 * and `test/mock/results.json` holds nothing but 2010 to 2026. Read as it is served,
 * every one of those screens is empty in every case.
 *
 * **What the cases on those screens measure is how a season is drawn, not which
 * years the history has**, so they are handed the same history moved forward by
 * {@link YEARS_ON} years: every result, and every pair, which belongs to a season of
 * its own. A season the cases knew as 2019 is {@link inLeague}`(2019)` here, with the
 * same people and the same figures in it.
 *
 * **Sixteen, and not any other number.** It has to lift the earliest season a case
 * reads (2012) to the league's first or later, and it has to be a multiple of four, so
 * that 29 February stays a day that exists (2016-02-29 becomes 2032-02-29). And it
 * leaves 2027 itself empty, because the history has no 2011: the season these
 * screens open on is the empty one the owner described.
 *
 * **What is deliberately not moved: who is in which team since when** (`teamSince` on
 * a competitor). A member is in a team in every season from that year on
 * (`inTeamIn`), so a year moved forward keeps everybody who was in the team; nothing
 * a case reads changes, and moving it would be a third thing to keep right.
 */
export const YEARS_ON = 16

/** The season a case knew by its year in the history, as these screens read it. */
export function inLeague(year: number): number {
  return year + YEARS_ON
}

function moved(day: string): string {
  return `${String(inLeague(Number(day.slice(0, 4))))}${day.slice(4)}`
}

/** One record of the history, with every year on it moved forward. */
function movedRecord(record: unknown): unknown {
  if (typeof record !== 'object' || record === null) {
    return record
  }

  const copy: Record<string, unknown> = { ...record }

  for (const name of ['date', 'since']) {
    const day = copy[name]

    if (typeof day === 'string' && /^\d{4}-/.test(day)) {
      copy[name] = moved(day)
    }
  }

  if (typeof copy.season === 'number') {
    copy.season = inLeague(copy.season)
  }

  return copy
}

const MOVED = new Set(['/api/results', '/api/pairs'])

/**
 * Serve the history in league seasons for every case of the `describe` this is
 * called in, and put back what was served before when each case ends.
 *
 * Read with the method, so a write to `/api/results` is answered by whatever stood
 * before, exactly as it was.
 */
export function playTheHistoryAsLeagueSeasons(): void {
  let before: typeof globalThis.fetch | undefined

  beforeEach(() => {
    const served = globalThis.fetch

    before = served
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const answer = await served(input, init)
      const path = String(input).split('?')[0] ?? ''

      if ((init?.method ?? 'GET') !== 'GET' || !MOVED.has(path) || !answer.ok) {
        return answer
      }

      const body: unknown = await answer.json()

      return new Response(JSON.stringify(Array.isArray(body) ? body.map(movedRecord) : body), {
        status: answer.status,
        headers: { 'content-type': 'application/json' },
      })
    })
  })

  afterEach(() => {
    if (before !== undefined) {
      vi.stubGlobal('fetch', before)
    }
  })
}

/* Said once, so that a reader of a case does not have to work it out: the earliest
   season any case reads is still one the league runs. */
if (inLeague(2012) < FIRST_SEASON) {
  throw new Error('the history moved forward still begins before the league does')
}
