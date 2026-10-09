import { useCompetitors, type ResourceState } from '../../data/useResource'
import { isStaff } from '../../roles/context'
import { isActiveMemberOrAdministration } from '../../roles/activeMemberOrAdministration'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'

/**
 * Whether whoever is at the keyboard reads the comments on an event, as a state and not as a
 * yes or a no.
 *
 * Active members and the administration do (owner, 03.10.2026, in the words PDL records his
 * choice between offered outcomes in: „Komentare vide aktivni članovi i administracija, isto kao
 * najava dolaska i skriven profil od 03.10.2026; nalog bez važeće članarine ih ne vidi" - PDL P6,
 * 03.10.2026, „Komentare vide aktivni članovi i administracija, isto kao najava dolaska"; the
 * record's sentence and not his own words). Until that day it was „komentare vide samo
 * prijavljeni članovi BTL. Drugim (posetiocima) se ne prikazuju." (owner, 11.08.2026) and this
 * asked `isMember(role)`, which is anybody signed in: a free account read every comment, with the
 * name and the number of its author. A visitor, somebody who registered and never paid, a member
 * whose fee has lapsed and an account that races for nobody read nothing now.
 *
 * The question is `isActiveMemberOrAdministration` (`roles/activeMemberOrAdministration.ts`), the
 * one home of it on the screen, asked in its words and not written out a second time: the same
 * sentence in two files is two sentences the day one of them is changed. `GoingToEvent` and the
 * hidden profile ask the same thing, and the comments are the third subject of it.
 *
 * **A STATE, BECAUSE THE ANSWER NEEDS THE LIST OF MEMBERS.** Whether a fee is standing is not on
 * the session: `GET /api/me` does not carry the flag, and the list the server serves ends
 * `where c.active`, so „he is on it" is „he is active" (`isActiveMember`). That list is on its way
 * for a moment, or does not come, and a boolean has no place for either: it would answer „no" to a
 * member for as long as it takes, and say so to him in a sentence meant for somebody else. So this
 * hands the list's own state on while it is not here, and the part that asks says what a part says
 * (`components/Resource.tsx`).
 *
 * **AND THE LIST IS NOT WAITED FOR WHERE IT CANNOT CHANGE THE ANSWER.** The administration reads
 * whatever its own fee, and somebody with no number of his own (a visitor, an account that races
 * for nobody) is not on the list whatever it holds, so both are answered at once. A visitor was
 * never made to wait for a list on this screen and still is not: that sentence is on the page in
 * the first paint.
 *
 * Written once and read by both screens that show a comment or what the comments add up to,
 * since one of them hiding and the other not is the sort of pair that drifts. **Neither asks the
 * server for what this says they will not draw** (`EventComments.tsx`, `OverallMark.tsx`): the
 * server refuses 404 to anybody else signed in (`CommentApi`), and a request that can only fail is
 * a request that was not worth sending.
 *
 * **This is a screen and not a lock.** The server decides on every request; what is decided here
 * is whether to draw a part of a page, and it is the screen's copy of a decision the server keeps.
 */
export function useReadsComments(): ResourceState<boolean> {
  const { role } = useRole()
  const { memberNumber } = useSession()
  const served = useCompetitors()

  if (isStaff(role) || memberNumber === null) {
    /* The list is no part of this answer, so none is passed: the administration is a yes
       whatever it holds, and nobody with no number is a yes whatever it holds. */
    return { status: 'ready', data: isActiveMemberOrAdministration(role, memberNumber, []) }
  }

  if (served.status !== 'ready') {
    return served
  }

  return { status: 'ready', data: isActiveMemberOrAdministration(role, memberNumber, served.data) }
}
