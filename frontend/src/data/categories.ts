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
 * `F R` (owner, 11.08.2026). The letter in front is the one the language uses,
 * so the code itself reads `M R` and `Ž R` while there is only Serbian; the
 * English `F` arrives with the English dictionary, the same way `Ž25-39` will. In Serbian the word carries the gender on its own,
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
 * The category code shown on a profile and in the tables.
 *
 * A member in their first season carries that category instead of their age
 * band, and leaves it permanently once they pass the points threshold. Leaving
 * is one way only: a bad season never puts anybody back.
 */
export function categoryCodeFor(gender: Gender, band: AgeBand, firstSeason: boolean): string {
  return firstSeason ? `${genderMark(gender)} ${FIRST_SEASON_BAND}` : `${genderMark(gender)}${band}`
}

/* **Where the band itself comes from, and why it is not worked out here**
   (13.09.2026).
 *
 * This file used to carry `ageBandFor(birthYear, season)`: the age reached during
 * the calendar year rather than the age on the day, so somebody turning 40 in
 * November is in the 40-54 band from 1 January (PDL P7, changed from the 2017
 * rulebook where the band moved on the birthday itself and took that season's
 * points with it).
 *
 * The arithmetic is unchanged and it is still the rule. What changed is that the
 * portal no longer holds the number to do it with: a year of birth is the short
 * form of a date of birth, Član 74 says that is never shown, and everything on a
 * member's record is served publicly out of `public/mock` (ADL A8). So the band
 * is worked out where the data is made and arrives already worked out, and the
 * function that needed a year is gone rather than left standing with nothing to
 * call it — a signature asking for a year of birth is an instruction to the next
 * reader to put one back on the record.
 *
 * What stays here is the vocabulary: `AGE_BANDS` is the whole list of bands, and
 * it is what a served band is held to (`data/servedAge.test.ts`). The rule that
 * turns a date into one of them belongs with whoever still has the date, which is
 * the backend.
 */

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
  /* **A bare mark of a gender was answered here until 07.09.2026, and is not any more.**
     It was the standing of a competition that produced one: the grid drew two blocks, one
     per gender, and each block carried its mark as a heading, so this function had to know
     that „M" means „Muškarci". On 07.09.2026 the owner replaced the two blocks with a
     control beside the heading („Žene ne treba da budu ispod muškaraca, nego da postoji
     filter gore desno"), the headings went with them, and nothing on the portal hands a
     bare mark to this function any more: every code that reaches it is an age band or the
     band of a first season (`categoryCodeFor`). The words themselves did not move — the
     control says „Muškarci" and „Žene" out of `rankings.men` and `rankings.women`, which is
     where they always came from. */

  if (!code.endsWith(` ${FIRST_SEASON_BAND}`)) {
    return code
  }

  return t(code.startsWith('M') ? 'category.rookieMale' : 'category.rookieFemale')
}
