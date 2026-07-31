import { useSearchParams } from 'react-router'
import { useToday } from '../../clock/useClock'

export const ALL_SEASONS = 'sve'

/**
 * Which season the profile is being read in, from the address.
 *
 * The running one by default (owner, 31.07.2026), taken from the one clock the
 * portal reads. It used to open on the newest season the person had raced, which
 * meant two people's profiles opened on two different years and neither of them
 * on the year the reader is living in.
 *
 * Anything that is not a year at all falls back. The comparison is on the string
 * the option carries, so `02010` is not quietly taken for 2010.
 */
export function useSeason(): string {
  const [params] = useSearchParams()
  const today = useToday()
  const asked = params.get('sezona')

  if (asked === ALL_SEASONS || (asked !== null && /^\d{4}$/.test(asked))) {
    return asked
  }

  return today.slice(0, 4)
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
