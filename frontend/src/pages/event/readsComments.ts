import { isActiveMemberOrAdministration } from '../../roles/activeMemberOrAdministration'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'

/**
 * Whether whoever is at the keyboard reads the comments on an event.
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
 * **A YES OR A NO SINCE 16.10.2026, AND NOT A STATE.** This was a `ResourceState` until that day,
 * because the answer needed the list of members: whether a fee is standing was asked of the list
 * the server serves (`where c.active`), the list is on its way for a moment or does not come, and
 * a boolean has no place for either. The owner gave the fact one home on the screen, the
 * session's (ADL, 16.10.2026, „Činjenica „član je aktivan" dobija jedan dom na ekranu"; the
 * sentence is the record's and not his own words), and the session has the answer in hand as soon
 * as `GET /api/me` has come back, so there is nothing left to wait for here. Until it has, the
 * reader is nobody and the answer is no, which is what it already was for a visitor and for
 * somebody with no number.
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
export function useReadsComments(): boolean {
  const { role } = useRole()
  const { signedIn } = useSession()

  return isActiveMemberOrAdministration(role, signedIn)
}
