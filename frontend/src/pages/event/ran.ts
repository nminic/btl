import type { Race, Result } from '../../data/types'

/**
 * Whether a member has a result on this event.
 *
 * Which is who may rate it (owner, 11.08.2026): a rating is experience of a
 * race and not an opinion about it, and a result is the record that somebody
 * was there. An intention to come is a statement, which is why it does not
 * count.
 *
 * Read through the races, because a result belongs to a race and a race belongs
 * to an event. Written here rather than in either screen, because both ask it:
 * the row of buttons that offers the rating, and the rating form itself, which
 * has to ask again since an address can be typed.
 */
export function ran(
  results: Result[],
  races: Race[],
  eventId: string,
  memberNumber: string,
): boolean {
  const mine = races.filter((race) => race.eventId === eventId)

  return results.some(
    (one) => one.memberNumber === memberNumber && mine.some((race) => race.id === one.raceId),
  )
}
