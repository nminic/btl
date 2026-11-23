import { FIRST_SEASON } from '../../data/season'
import type { FieldOption } from '../../forms/types'

/**
 * THE SEASONS A COMPETITION MAY BE MADE FOR ON THIS DAY: THE YEAR AND THE ONE AFTER IT, NEVER BEFORE 2027.
 *
 * <p>Owner, 23.11.2026 (PDL, „Tri brze izmene administracije"): „Želim dropdown gde mogu izabrati naredne dve
 * sezone", and, asked about the clash with „Nigde na portalu nema sezone pre 2027.", he chose „Tekuća i
 * naredna, ne ispod 2027", which the record of it spells out: „Zato 23.11.2026 izbor nudi samo 2027, a od
 * 1.1.2027. nudi 2027 i 2028, i dalje se pomera sam svake godine." So the floor is put on each of the two
 * answers, and through 2026 the two are one.
 *
 * <p><b>The route says the same thing</b> (`SeasonClock.aLeagueMayBeMadeFor`, PDL P15a, 22.09.2026: „ruta
 * sprovodi isto što i forma"), and the day is the portal's own, the day in Belgrade (`clock/useClock.ts`).
 *
 * @param today yyyy-mm-dd, the shape the portal's clock hands every screen
 */
export function seasonsALeagueMayBeMadeFor(today: string): number[] {
  const year = Number(today.slice(0, 4))

  return [...new Set([Math.max(FIRST_SEASON, year), Math.max(FIRST_SEASON, year + 1)])]
}

/**
 * The choices of the box „Sezona" on the form of a competition, oldest first.
 *
 * <p><b>And the season the competition already holds, where it is not among them.</b> A control cannot hold a
 * value it does not offer: a `<select>` whose value names no option shows the first one, so a competition of a
 * season that has gone by would be drawn as this year's while the form kept and sent back its own. The shape
 * `admin/AdminTeams.tsx` gives the organiser of a team, for the same reason. The route lets a competition keep
 * its season (`LeagueWriteApi.whatIsWrongWith` asks only a season that is being MOVED).
 *
 * @param held the season of the competition being changed, as the form holds it, and empty for a new one
 */
export function seasonChoices(today: string, held: string): FieldOption[] {
  const offered = seasonsALeagueMayBeMadeFor(today).map(String)
  const all = held === '' || offered.includes(held) ? offered : [held, ...offered]

  return all.toSorted((one, other) => Number(one) - Number(other)).map((one) => ({ value: one, labelKey: one }))
}
