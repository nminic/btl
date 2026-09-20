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
 * with his account menu on it and „Za ovo treba prijava" behind every link in that menu,
 * because `GET /api/me` carries no member number and nothing else sets one. Measured on
 * all five addresses behind the picture.
 *
 * <p><b>There are three answers and not two, and the third is not a waiting room.</b> A
 * signed in account with no competitor record is a permanent state and not a moment on
 * the way to being a member: a moderator and a superadmin have no competitor record at
 * all, by the owner's decision of 14.09.2026 („Jedan nalog je tacno jedan clan", PDL
 * P21) and by what {@code MeApi} says about the empty link. Today every signed in member
 * is in it too, because `/api/me` does not yet carry the number, and that half of it goes
 * away on its own when the answer grows one. The half that belongs to administration
 * never does, which is why this has a sentence of its own rather than a spinner.
 *
 * <p><b>What it must NOT say is that nobody is signed in</b>, which is what those eleven
 * screens said. Somebody is: the cookie is in the browser, the header knows their number
 * and the server will answer every request they make. Sending them to the sign in form
 * is the portal arguing with them.
 *
 * <p><b>Where the floor is.</b> `pages/member/oneQuestion.test.tsx` walks every address
 * in `ACCOUNT_ROUTES` against a server that says somebody is signed in, and fails on any
 * of them that answers with the sign in. The list is the router's own, so a sixth screen
 * of the member area is measured the day its address is added rather than the day
 * somebody remembers it.
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
