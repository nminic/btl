import { useSearchParams } from 'react-router'

export const ALL_SEASONS = 'sve'

/**
 * Which season the profile is being read in, from the address.
 *
 * All of them by default on a profile (owner, 31.07.2026): a profile is
 * somebody's whole running life and the question it answers first is what they
 * have done, not what they have done since January; a profile that opens on the
 * running season is empty for the first weeks of every year.
 *
 * The teams ask for the running season instead, and for them "all of them" is
 * not an option at all: a team is a thing of one season, its members change, and
 * a standing summed over every season since 2027 would be a list of who has been
 * around longest. They hand in the year, and a year handed in also closes the
 * door on `sve` arriving through the address.
 *
 * The choice travels between the two parts of the profile because it lives in
 * the address and `PartsNav` carries the query on every link.
 *
 * Anything that is not a year at all falls back. The comparison is on the string
 * the option carries, so `02010` is not quietly taken for 2010.
 */
export function useSeason(fallback: string = ALL_SEASONS): string {
  const [params] = useSearchParams()
  const asked = params.get('sezona')

  if ((asked === ALL_SEASONS && fallback === ALL_SEASONS) || (asked !== null && /^\d{4}$/.test(asked))) {
    return asked
  }

  return fallback
}

/**
 * The seasons a profile offers: the ones this person raced, the running one, and
 * whatever the address named.
 *
 * The running one is always there even when they have nothing in it, because it
 * is the default and a select cannot open on an option it does not have. A
 * season named in a shared link is there for the same reason: the link has to
 * show what it was sent to show, and an empty table under the right year says
 * something true.
 */
export function seasonOptions(raced: number[], season: string, today: string): number[] {
  const years = new Set(raced)

  years.add(Number(today.slice(0, 4)))

  if (season !== ALL_SEASONS) {
    years.add(Number(season))
  }

  return [...years].sort((left, right) => right - left)
}
