import { nextMemberNumber } from '../../data/memberNumber'
import type { Competitor } from '../../data/types'
import type { SessionValue } from '../../session/context'
import { MEMBERS, recordsOf } from './entityForms'

/* Where a member number can already be spoken for, all of it in one place.
 *
 * `data/memberNumber.ts` knows the format and the rule: six digits, first free in
 * order. This module knows the harder half, which is what "taken" means on a
 * portal where a number is given out on two screens at once.
 *
 * It exists because it was once worked out twice. The member list handed in the
 * numbers of the members it showed; the payments queue handed in those plus the
 * numbers its own activations had given out. Activating a membership writes a
 * decision and not a member, so the member form never saw the number an
 * activation had just handed out: record a fee, get 000032, then enter a member
 * without reloading and get 000032 again. Two members answered to one number,
 * and because the overlay of changes is keyed by the number, changing the town of
 * one changed both. That is the exact fault the check for uniqueness used to
 * catch before the field left the form (PDL P8, 30.07.2026; ADL A4d).
 *
 * So the three sources are named once and nowhere else. A third screen that hands
 * out a number cannot be written without going through here, because this is the
 * only thing that knows how to answer the question.
 */

/**
 * The three places a number lives, as the session holds them.
 *
 * Handed in whole rather than one by one, so `useSession()` satisfies it as it
 * stands and a fourth source is added here rather than at every call.
 */
export type NumberSources = Pick<SessionValue, 'edits' | 'creations' | 'decisions'>

/**
 * Every member number that is spoken for: the ones in the member list as the
 * screen shows it, records entered during this visit included, and the ones the
 * activations of this visit have handed out.
 *
 * The list is the one on screen rather than the file underneath, because a
 * member entered a moment ago holds their number already even though nothing has
 * been written down anywhere.
 */
export function takenMemberNumbers(
  competitors: Competitor[],
  { edits, creations, decisions }: NumberSources,
): string[] {
  const listed = recordsOf(MEMBERS, competitors, edits, creations).map((one) =>
    String(one.memberNumber),
  )

  /* Only activations carry one. A refusal hands out nothing, and the other seven
     queues have no numbers to hand out at all, so both leave it empty. */
  const activated = Object.values(decisions)
    .map((one) => one.memberNumber)
    .filter((one) => one !== '')

  return [...listed, ...activated]
}

/** The number the next member gets, against everything that is spoken for. */
export function handOutMemberNumber(
  competitors: Competitor[],
  sources: NumberSources,
): string {
  return nextMemberNumber(takenMemberNumbers(competitors, sources))
}
