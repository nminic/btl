import { categoryOfMember, rankingFor, resultsOf, seasonsWithResults } from '../../data/derive'
import type { Competitor, Result } from '../../data/types'

/* What a competitor has won, worked out rather than stored.
 *
 * Nothing anywhere records that a trophy was handed over: the standing is frozen
 * at the end of a season and the top three of each board take one (PDL P16). So
 * the awards are read back out of the standings, through the same function the
 * public tables are drawn with, and cannot drift away from them. Shared places
 * come with it, and they matter: two who tie for second are both second and both
 * take the plaque.
 *
 * Permanent by decision: "Značke i uspesi ostaju trajno zabeleženi na profilu"
 * (PDL P11). A season somebody did not race is a season with no award, never one
 * that takes an award away.
 */

/** Where a trophy is won: the standing of a gender, or one category inside it.
 *  Both are boards of the same shape and both give out three (PDL P16). */
export type AwardKind = 'overall' | 'category'

export type Award = {
  season: number
  kind: AwardKind
  /** The age band it was won in. Empty for the general standing. */
  category: string
  /** First, second or third. */
  position: number
  points: number
}

/** How many places a board rewards. */
const PLACES = 3

/** Every trophy and plaque this competitor holds, newest season first and the
 *  better place first inside a season. */
export function awardsOf(
  competitor: Competitor,
  competitors: Competitor[],
  results: Result[],
): Award[] {
  const mine = resultsOf(results, competitor.memberNumber)

  return seasonsWithResults(mine)
    .flatMap((season) => {
      /* The board the member actually stood on that season, which is a question
         about that season and not about today: the age band moves with the years
         and the first season category belongs to one year alone (PDL P7). */
      const category = categoryOfMember(competitor, season)

      return [
        { kind: 'overall' as AwardKind, category: '', code: undefined },
        { kind: 'category' as AwardKind, category, code: category },
      ].flatMap(({ kind, category: band, code }) => {
        const row = rankingFor(competitors, results, {
          season,
          gender: competitor.gender,
          categoryCode: code,
        }).find((one) => one.competitor.memberNumber === competitor.memberNumber)

        if (row === undefined || row.position > PLACES) {
          return []
        }

        return [{ season, kind, category: band, position: row.position, points: row.points }]
      })
    })
    .sort((left, right) => right.season - left.season || left.position - right.position)
}
