import { nextMemberNumber } from '../../data/memberNumber'
import type { Competitor } from '../../data/types'
import type { SessionValue } from '../../session/context'
import { MEMBERS, recordsOf } from './entityForms'

/* Where a member number can already be spoken for, all of it in one place.
 *
 * `data/memberNumber.ts` knows the format and the rule: six digits, one past the
 * highest ever handed out. This module knows the harder half, which is what
 * "handed out" means on a portal where a number is given on two screens at once.
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
export type NumberSources = Pick<SessionValue, 'edits' | 'creations' | 'decisions' | 'deletions'>

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
  { edits, creations, decisions, deletions }: NumberSources,
): string[] {
  /* Read through the overlay, and then the deleted put back.
 
     A deleted member is gone from every screen, but their number is not free
     (PDL P8, 31.07.2026): deleting removes the tie between the number and the
     person, and the number stays spent, because it stands in old results, old
     tables and a printed card. Reading only the overlay handed the highest
     number straight back to the next member to join, which is the one thing the
     rule exists to prevent. */
  const listed = recordsOf(MEMBERS, competitors, { edits, creations, deletions }).map((one) =>
    String(one.memberNumber),
  )
  const deleted = deletions[MEMBERS.id] ?? []

  /* Only activations carry one. A refusal hands out nothing, and the other seven
     queues have no numbers to hand out at all, so both leave it empty. */
  const activated = Object.values(decisions)
    .map((one) => one.memberNumber)
    .filter((one) => one !== '')

  return [...listed, ...deleted, ...activated]
}

/** The number the next member gets, against everything that is spoken for. */
export function handOutMemberNumber(
  competitors: Competitor[],
  sources: NumberSources,
): string {
  return nextMemberNumber(takenMemberNumbers(competitors, sources))
}

/**
 * A number for each of several at once, paired with what it was given to.
 *
 * Here rather than as a loop around `handOutMemberNumber`, because such a loop
 * quietly hands out one number as many times as it runs. What is spoken for is
 * read off the session as the caller's render sees it, and the session does not
 * change while a loop runs: twenty activations in a loop are twenty members
 * answering to 000032, which is the exact fault this module exists to make
 * impossible. A caller cannot walk into it without coming through here.
 *
 * Paired rather than returned as a bare list, so nothing at the other end has to
 * line two lists up by counting. Lining them up by counting is how a number ends
 * up against the wrong person, which is the same fault wearing different
 * clothes.
 */
export function handOutMemberNumbersFor(
  competitors: Competitor[],
  sources: NumberSources,
  ids: string[],
): { id: string; memberNumber: string }[] {
  const taken = takenMemberNumbers(competitors, sources)

  return ids.map((id) => {
    const memberNumber = nextMemberNumber(taken)
    taken.push(memberNumber)

    return { id, memberNumber }
  })
}
