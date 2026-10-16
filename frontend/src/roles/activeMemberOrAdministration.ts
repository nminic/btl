import type { SignedIn } from '../session/context'
import { isStaff, type Role } from './context'

/**
 * AN ACTIVE MEMBER, OR THE ADMINISTRATION: WHO THE SCREEN DRAWS WHAT THE LEAGUE KEEPS FOR ITS
 * OWN, ASKED IN ONE PLACE.
 *
 * <p>The owner chose it on 03.10.2026, between offered outcomes, for the list of who is going
 * to an event, and PDL records the choice as „Najavu dolaska daju i spisak najavljenih vide
 * aktivni članovi (važeća članarina), a spisak vidi i administracija; isto kao za skriven profil
 * (P23, odeljak 18)." (the record's sentence, not his own words). The same reader is therefore
 * asked about by the hidden profile as well, and this module is where every screen reads the
 * question from: the list of who is going (`event/GoingToEvent.tsx`), the comments under an event
 * (`event/readsComments.ts`) and the hidden profile (`pages/profile/visible.ts`, through the two
 * profile pages and `pages/profile/useProfileLink.ts`).
 *
 * <p><b>The server decides, and this is the screen's copy of the decision.</b>
 * `ActiveMemberOrAdministration.java` answers it on every request and refuses anybody else 404,
 * so what is asked here is only whether to draw a part of a page or to leave it out, never
 * whether somebody may have it.
 *
 * <p><b>ONE HOME FOR THE FACT „THE READER IS ACTIVE", AND IT IS THE SESSION'S</b> (ADL, 16.10.2026,
 * „Činjenica „član je aktivan" dobija jedan dom na ekranu"; the sentence is the record's and not
 * the owner's own words). Until that day this module asked the list the server serves for the
 * reader's own number, while the payment page and the settings asked the session's flag for the
 * very same fact (`signedIn.feeStands`, which `GET /api/me` carries as `active` since
 * 11.10.2026). Two doors read one column; they said one thing only as long as nothing made the
 * list and the answer about the caller differ for the length of a visit, and a list read once
 * per visit and never dropped does exactly that when the reader renews his fee.
 *
 * <p><b>THE QUESTION IS ABOUT THE READER AND NEVER ABOUT ANYBODY ELSE, and that is what lets the
 * session answer it.</b> The session knows who is reading and nothing about the member whose page
 * is on the screen. Measured 16.10.2026: every call of this module in `src` passes the reader
 * (`CompetitorProfile`, `CompetitorAwards`, `useProfileLink`, `GoingToEvent`, `readsComments`), and
 * `visible.ts` only mentions it in prose. A question about ANOTHER member - is the person whose
 * profile this is active - stays on the public list, which carries him exactly when he is
 * (`/api/competitors` ends `where c.active`), and is asked there (`profile/visible.ts`,
 * `profileFor`). This module takes the session's object and not a member number, so a call site
 * cannot hand it somebody else's number: the compiler says so.
 */

/**
 * WHETHER THE READER IS A MEMBER WHOSE FEE IS STANDING, read off the session.
 *
 * <p>Somebody who is not a member at all (nobody signed in, an account the league keeps no record
 * of, somebody who registered and has not paid) is not active; a member is as the flag says
 * (`session/context.ts`, first arm of `SignedIn`). **The flag reads „stands" where the answer did
 * not say** (an older server, a word that is neither a yes nor a no), because the session acts on
 * it only to take something away; here that means a screen may draw a part the server then
 * refuses, never that a part is withheld from somebody it was owed. The server stays the
 * authority either way.
 *
 * @param signedIn who is reading, as the session works it out, or nothing for nobody
 */
export function isActiveMember(signedIn: SignedIn | null): boolean {
  return signedIn?.as === 'member' && signedIn.feeStands
}

/**
 * Whether this reader is a member whose fee is standing, or the administration.
 *
 * <p>The administration is `isStaff` (`roles/context.ts`): a moderator, ticked or not, and the
 * superadmin, which is the list PDL section 18 gives, supplemented on 03.10.2026: „administracija
 * (moderatori i superadmin)". The server reads the same people off `role.rights_mode`.
 */
export function isActiveMemberOrAdministration(role: Role, signedIn: SignedIn | null): boolean {
  return isStaff(role) || isActiveMember(signedIn)
}
