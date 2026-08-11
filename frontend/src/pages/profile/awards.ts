import {
  categoryOfMember,
  rankingFor,
  resultsOf,
  seasonOf,
  seasonsWithResults,
} from '../../data/derive'
import type { Competitor, Result } from '../../data/types'

/* What a competitor has won, worked out rather than stored.
 *
 * Nothing anywhere records that a trophy was handed over: the standing is frozen
 * at the end of a season and the top three of each board take one (PDL P16). So
 * the awards are read back out of the standings, through the same function the
 * public tables are drawn with, and cannot drift away from them. That is the
 * whole of why they are read that way: one place, one member, one trophy, and
 * no way for the board and the shelf to disagree (PDL P12, no shared place).
 *
 * Permanent by decision: what a member has won stays written on the profile for
 * good (PDL P11). A season somebody did not race is a season with no award, never one
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

  /* The whole file, cut into seasons once. Without it every season asked
     rankingFor for the standing and rankingFor walked every result there is, so
     a competitor with sixteen seasons walked the file thirty-two times: on the
     generated data that is a hundred and twelve thousand rows for one view of
     one page, and a real league is thirty times bigger. */
  const bySeason = new Map<number, Result[]>()

  for (const result of results) {
    const season = seasonOf(result)
    const inSeason = bySeason.get(season)

    if (inSeason === undefined) {
      bySeason.set(season, [result])
    } else {
      inSeason.push(result)
    }
  }

  const raced = new Set(seasonsWithResults(mine))

  return [...bySeason.entries()]
    .filter(([season]) => raced.has(season))
    .flatMap(([season, inSeason]) => {
      /* Which board they stood on. Known to be imperfect: categoryOfMember reads
         the stored "first season" flag and ignores the season it is handed
         (src/data/categories.ts), so somebody who spent 2027 as a beginner is
         filed under that band in every season. P7 says the band belongs to one
         year alone; putting that right means changing what every table shows and
         is not this change to make. */
      const category = categoryOfMember(competitor, season)

      return [
        { kind: 'overall' as AwardKind, category: '', code: undefined },
        { kind: 'category' as AwardKind, category, code: category },
      ].flatMap(({ kind, category: band, code }) => {
        const row = rankingFor(competitors, inSeason, {
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
