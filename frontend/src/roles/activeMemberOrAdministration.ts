import type { Competitor } from '../data/types'
import { isStaff, type Role } from './context'

/**
 * AN ACTIVE MEMBER, OR THE ADMINISTRATION: WHO THE SCREEN DRAWS WHAT THE LEAGUE KEEPS FOR ITS
 * OWN, ASKED IN ONE PLACE.
 *
 * <p>The owner chose it on 03.10.2026, between offered outcomes, for the list of who is going
 * to an event: „Najavu dolaska daju i spisak najavljenih vide aktivni članovi (važeća
 * članarina), a spisak vidi i administracija; isto kao za skriven profil (P23, odeljak 18)." The
 * same reader is therefore asked about by the hidden profile as well, and this module is where
 * both screens read the question from. Only the list of who is going asks it today
 * (`event/GoingToEvent.tsx`); the hidden profile is its own increment.
 *
 * <p><b>The server decides, and this is the screen's copy of the decision.</b>
 * `ActiveMemberOrAdministration.java` answers it on every request and refuses anybody else 404,
 * so what is asked here is only whether to draw a part of a page or to leave it out, never
 * whether somebody may have it.
 */

/**
 * WHETHER THIS MEMBER NUMBER BELONGS TO A MEMBER WHOSE FEE IS STANDING, READ OFF THE LIST THE
 * SERVER SERVES.
 *
 * <p>`/api/competitors` ends `where c.active` (owner, 13.09.2026: a member whose fee has lapsed
 * is not on that list at all), so „he is on it" is „he is active", answered by the very flag the
 * server reads, `competitor.active`. `GET /api/me` does not carry the flag, which is why it is
 * asked of the list and not of the session.
 *
 * <p><b>What that costs, said rather than left to be found:</b> the list is read once per visit
 * and nothing drops it when the reader renews his own fee, so a member who becomes active during
 * a visit is drawn as active from the next reload on. The server meanwhile already lets him act.
 *
 * @param memberNumber whose number, or nothing for somebody with none (a moderator who does not
 *   race, or somebody who registered and has never paid): nothing matches no row of the list
 * @param served `/api/competitors` as it was answered
 */
export function isActiveMember(memberNumber: string | null, served: readonly Competitor[]): boolean {
  return served.some((one) => one.memberNumber === memberNumber)
}

/**
 * Whether this reader is a member whose fee is standing, or the administration.
 *
 * <p>The administration is `isStaff` (`roles/context.ts`): a moderator, ticked or not, and the
 * superadmin, which is the owner's own list - „administracija (moderatori i superadmin)", PDL
 * section 18, supplemented on 03.10.2026. The server reads the same people off `role.rights_mode`.
 */
export function isActiveMemberOrAdministration(
  role: Role,
  memberNumber: string | null,
  served: readonly Competitor[],
): boolean {
  return isStaff(role) || isActiveMember(memberNumber, served)
}
