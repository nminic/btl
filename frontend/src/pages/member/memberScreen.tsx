import type { ReactElement } from 'react'
import { useSession } from '../../session/useSession'
import { NotRacing } from './NotRacing'
import { SignedOut } from './SignedOut'

/**
 * THE ONE QUESTION EVERY SCREEN THAT BELONGS TO ONE PERSON ASKS, ANSWERED IN ONE PLACE.
 *
 * <p><b>Why it exists.</b> Until 20.09.2026 eleven screens asked „is anybody signed in"
 * by reading the member number, and the header asked it by reading `signedIn`
 * (session/context.ts, which says in its own words that the question „must not be asked
 * twice and get two answers"). Those were two homes for one fact and they disagreed the
 * moment a real session existed: a member who signed in against the server got a header
 * with his account menu on it and „Za ovo treba prijava" behind every link in that menu.
 * Measured on all eleven, which is five more than the menu behind the picture draws.
 *
 * <p><b>There are three answers and not two, and the third is not a waiting room.</b> A
 * signed in account with no competitor record is a permanent state and not a moment on
 * the way to being a member: a moderator and a superadmin have no competitor record at
 * all, by the owner's decision of 14.09.2026 („Jedan nalog je tacno jedan clan", PDL
 * P21) and by what {@code MeApi} says about the empty link. That is why this has a
 * sentence of its own rather than a spinner.
 *
 * <p><b>AND UNTIL 24.09.2026 EVERY SIGNED IN MEMBER WAS IN THE THIRD ANSWER TOO, which
 * is the fault this hook was built to remove arriving through the one door it does not
 * watch.</b> The hook was right and the session was empty: `GET /api/me` had carried a
 * member number since 20.09.2026 and `session/theServer.ts` read past it, so the portal
 * knew an account and no person. Said here in the old tense rather than deleted, because
 * this file promised that „that half goes away on its own when the answer grows one" -
 * the answer had already grown it, and nothing went away on its own. What closed it was
 * `theServer.ts` reading the field and `SessionProvider` writing it; a sentence waiting
 * for a day that has already come is a job nobody is doing.
 *
 * <p><b>WHAT THE THIRD ANSWER NOW HOLDS, and one of the three is a boundary rather than
 * a decision.</b> It is „the session names no member", and there are three ways to be
 * there: an account that races for nobody, which is administration and is permanent; a
 * server saying something this portal does not know, which must land somewhere and lands
 * here; and <b>somebody who has registered and has not been given a number</b> (ADL A44,
 * owner 11.09.2026: „Osoba je `competitor` od registracije, a clan postaje kad dobije
 * broj"). The third of those is told „uz ovaj nalog ne stoji takmicarski zapis", and for
 * him that sentence is not true - he has a record, and what he has not got is a number.
 * <b>No decision anywhere says what he should be shown</b>, so he is not given an
 * invented screen: the boundary is written down here and goes to the owner as a question.
 *
 * <p><b>AND ONE THING THIS HOOK DOES NOT DO, named so that a reader does not take its
 * silence for a rule.</b> PDL P8, owner 19.09.2026: „clanu kome je clanarina istekla je
 * dostupna samo strana za obnovu." This hook cannot keep that and does not pretend to.
 * `GET /api/me` answers a member whose fee has lapsed - deliberately, it is half of why
 * {@code MeApi} exists beside {@code CompetitorApi} - but it does not answer WHETHER the
 * fee is standing: `c.active` is on no component of {@code MeApi.MyOwnRecord}, and the
 * only `active` in its query counts who he brought in. So the portal cannot tell a
 * lapsed member from a standing one and opens all eleven screens to both. Measured
 * 22.09.2026 that no route on the server keeps P8 either. What this changes for such a
 * member is that he can now reach „Moja clanarina" at all, which is the page he renews
 * on and which answered him „Ovaj deo je za takmicare" until today.
 *
 * <p><b>What it must NOT say is that nobody is signed in</b>, which is what those eleven
 * screens said. Somebody is: the cookie is in the browser, the header knows their number
 * and the server will answer every request they make. Sending them to the sign in form
 * is the portal arguing with them.
 *
 * <p><b>Where the floor is, and it is not a list of addresses.</b> This file said until
 * 21.09.2026 that `ACCOUNT_ROUTES` is what the member area is made of. It is not: five of
 * these eleven screens are on that list and six are not, and a review put the old question
 * back into all six with the package staying green. „Which screens belong to one person"
 * cannot be answered by an address, so `pages/member/oneQuestion.test.tsx` asks the module
 * graph instead - which modules of the portal name `SignedOut` - and requires the answer to
 * be this file and nothing else.
 *
 * <p><b>And that catches ONE of the two ways back, which is why the walk beside it is not
 * spare.</b> A screen that writes the sentence for itself again has to name `SignedOut`, and
 * naming it is what fails there. What the module graph cannot see is a screen that keeps
 * this hook and reads the session BESIDE it: two doors to one answer, and not one new name
 * anywhere in the graph. Measured on 21.09.2026 - that mutation leaves all three of the
 * graph's cases green and is caught only by the walk, which opens every address of the member
 * area and reads what is on it. So the walk is the only thing standing between the portal and
 * the fault this file was written to remove, and „the graph already covers it" is not a reason
 * to shorten it.
 */
export type MemberScreen =
  /** Whose screen this is, for a screen that may draw itself. */
  | { memberNumber: string; instead: null }
  /** And what to draw instead, for one that may not. */
  | { memberNumber: null; instead: ReactElement }

export function useMemberScreen(): MemberScreen {
  /* THE SAME FIELD THE HEADER READS, AND DELIBERATELY NOT THE MEMBER NUMBER BESIDE IT.
     `signedIn` is worked out from the only two facts there are and cannot drift away
     from either (session/context.ts); the member number is one of those two facts and
     answers a narrower question than the one being asked here. */
  const { signedIn } = useSession()

  if (signedIn === null) {
    return { memberNumber: null, instead: <SignedOut /> }
  }

  return signedIn.as === 'member'
    ? { memberNumber: signedIn.memberNumber, instead: null }
    : { memberNumber: null, instead: <NotRacing /> }
}
