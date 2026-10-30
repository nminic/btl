import {
  categoryIn,
  rankingFor,
  resultsOf,
  seasonOf,
  seasonsCounted,
} from '../../data/derive'
import { FIRST_SEASON } from '../../data/season'
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

    /* A result no season counts stands on no board of any season (`seasonOf`). */
    if (season === null) {
      continue
    }

    const inSeason = bySeason.get(season)

    if (inSeason === undefined) {
      bySeason.set(season, [result])
    } else {
      inSeason.push(result)
    }
  }

  /* **Only the seasons the league runs.** PDL P27: „Takmičenje kreće ispočetka: nijedan
     istorijski rezultat ne ulazi u tabele, rang liste, priznanja ni „all time" statistiku.
     Sezona 2027. počinje od nule za sve." Until 17.10.2026 this read every season the member
     raced, so somebody who stood third on the imported 2019 was handed a trophy of a standing
     the league never had. The results themselves stay on the profile (P27, 28.07.2026: the
     personal history goes into the profile); what goes is the place worked out of them. */
  const raced = new Set(seasonsCounted(mine).filter((season) => season >= FIRST_SEASON))

  return [...bySeason.entries()]
    .filter(([season]) => raced.has(season))
    .flatMap(([season, inSeason]) => {
      /* Which board they stood on: the category of THAT season (`categoryIn`), since 30.10.2026 when
         the server began to keep it per season (PDL, owner, 30.10.2026, „poredak svake sezone prikazuje
         kategoriju te sezone"). Until then it was today's band in every season, and this note said so.
         None where he does not stand in that season's table, and then there is no board of a category
         to have stood on. */
      const category = categoryIn(competitor, season)

      /* The two boards one season is stood on, named rather than written into
         the loop, because the list is what says `kind` holds an award kind and
         not merely a word. */
      const boards: { kind: AwardKind; category: string; code: string | undefined }[] = [
        { kind: 'overall', category: '', code: undefined },
        ...(category === null ? [] : [{ kind: 'category' as const, category, code: category }]),
      ]

      return boards.flatMap(({ kind, category: band, code }) => {
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
