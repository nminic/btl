import type { Gender } from './types'

/* The competition categories, exactly as the rulebook fixes them (PDL P7).
 *
 * Four age bands per gender, and a first season category on top of them. There
 * is nothing else: no band for under eighteen, none for over sixty five, no
 * separate walkers.
 */

export const AGE_BANDS = ['24-', '25-39', '40-54', '55+'] as const

export type AgeBand = (typeof AGE_BANDS)[number]

/**
 * Marks a member who has not yet left the beginners' category.
 *
 * `R` for rookie, which is what the category is called in English: `M R` and
 * `F R` (owner, 11.08.2026). In Serbian the word carries the gender on its own,
 * so there the two are `Početnici` and `Početnice` with no letter in front of
 * them, and the code here is what the dictionary looks them up by
 * (`categoryLabel`). It was `PS`, for „Prva sezona", a name the owner dropped
 * the same day.
 */
export const FIRST_SEASON_BAND = 'R'

/** The threshold at which a first season member leaves that category for good. */
export const FIRST_SEASON_POINTS = 12

export function genderMark(gender: Gender): string {
  return gender === 'M' ? 'M' : 'Ž'
}

/**
 * The age band for a season.
 *
 * The age used is the one reached during that calendar year, not the age on the
 * day: somebody who turns 40 in November is in the 40-54 band from 1 January.
 * This changed from the 2017 rulebook, where the band changed on the birthday
 * itself and points moved category mid-season.
 */
export function ageBandFor(birthYear: number, season: number): AgeBand {
  const age = season - birthYear

  if (age <= 24) {
    return '24-'
  }

  if (age <= 39) {
    return '25-39'
  }

  return age <= 54 ? '40-54' : '55+'
}

/**
 * The category code shown on a profile and in the tables.
 *
 * A member in their first season carries that category instead of their age
 * band, and leaves it permanently once they pass the points threshold. Leaving
 * is one way only: a bad season never puts anybody back.
 */
export function categoryCodeFor(
  gender: Gender,
  birthYear: number,
  season: number,
  firstSeason: boolean,
): string {
  return firstSeason
    ? `${genderMark(gender)} ${FIRST_SEASON_BAND}`
    : `${genderMark(gender)}${ageBandFor(birthYear, season)}`
}

/** Whether the first season category is still open to somebody. */
export function firstSeasonAllowed(points: number): boolean {
  return points < FIRST_SEASON_POINTS
}

/**
 * What a category is called on the screen, out of the code the league keeps it
 * under.
 *
 * The age bands are the same word in every language, so they are shown as they
 * are: `M40-54`. The beginners' category is not, and that is the whole reason
 * this exists: in Serbian it is `Početnici` and `Početnice`, one word each and
 * no letter of gender in front, because the word already says it; in English it
 * is `M R` and `F R`, because `rookie` does not (owner, 11.08.2026).
 *
 * The code stays what it was in every other respect: it is what a filter, an
 * address and a saved choice are written with, and none of those may change
 * with the language.
 */
export function categoryLabel(code: string, t: (key: string) => string): string {
  if (!code.endsWith(` ${FIRST_SEASON_BAND}`)) {
    return code
  }

  return t(code.startsWith('M') ? 'category.rookieMale' : 'category.rookieFemale')
}
