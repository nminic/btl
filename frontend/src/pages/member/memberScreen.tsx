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
 * him that sentence is not quite true - he has a record, and what he has not got is a
 * number.
 *
 * <p><b>He is nonetheless in the right place, and that is a decision rather than this
 * hook's guess.</b> PDL, 19.09.2026, deriving it from what was already written rather
 * than asking again: registered and never paid „NIJE otvoreno pitanje i ne trazi trece
 * stanje", and what he may do is „vidi javne strane (kalendar, rang liste, tudje
 * profile) a ne moze nista da uradi". That is what this answer is: the public portal, and
 * one way back to it. So the screen is settled and only the SENTENCE on it is loose,
 * which is worth a word to the owner and not a fourth state.
 *
 * <p><b>AND ONE THING THIS HOOK DOES NOT DO, named so that a reader does not take its
 * silence for a rule.</b> PDL P8, owner 19.09.2026: „Zelim da od svih mesta clan kojem je
 * istekla clanarina moze da pristupa samo strani za obnovu clanarine, dok ga verifikator
 * ne odobri." This hook does not keep that, and it is written here rather than left to be
 * noticed.
 *
 * <p><b>It is not this hook's to keep, by that decision's own words</b>, which name where
 * the refusal goes: „prijava uspeva, a odbijaju vrata svake pojedinacne rute". The door of
 * each route on the server, and the sign in deliberately untouched. Measured 22.09.2026
 * that no route keeps it yet.
 *
 * <p><b>And it could not be kept here even if it were</b>, which is a fact about the
 * answer rather than an argument: `GET /api/me` answers a member whose fee has lapsed -
 * deliberately, it is half of why {@code MeApi} exists beside {@code CompetitorApi} - but
 * it does not answer WHETHER the fee is standing. `c.active` is on no component of
 * {@code MeApi.MyOwnRecord}, and the only `active` in that query counts who he brought in.
 *
 * <p>So this hook opens all eleven screens to a lapsed member and to a standing one alike,
 * and <b>it cannot tell them apart</b>.
 *
 * <p><b>THIS SAID HE „CAN NOW REACH Moja clanarina, WHICH IS THE PAGE HE RENEWS ON", AND
 * THAT WAS FALSE.</b> It was written from reasoning rather than from a measurement - the
 * hook lets him through, so I wrote that he arrives - and a review caught it. Measured
 * 25.09.2026 with the answer the real server gives him, on all eleven: five work (his
 * results, the form that sends one, his messages, one message, his settings); two refuse
 * him with a reason of their own; and „Moja clanarina" drew a heading with <b>no link and
 * no button anywhere on it</b>.
 *
 * <p><b>And the count of what is WRONG for him is one, not three, which took a second
 * measurement to say honestly.</b> Three addresses answered him with the front page, and
 * the first draft of this paragraph called all three damage. Walking the same three as an
 * ACTIVE member showed otherwise: „novi-tim" answers HIM with the front page too, so that
 * is the portal's ordinary answer to somebody who may not do the thing rather than
 * anything about a lapsed fee. What is really his alone is <b>his own profile</b>, which
 * an active member opens and he is redirected away from - and the redirect cannot be
 * anything else there, because the profile is his by definition.
 *
 * <p><b>Why that page in particular, and it is not a typo anywhere.</b> It looks the
 * caller up in `/api/competitors`, which ends `where c.active` and therefore does not
 * carry him - while `/api/me` answers him deliberately, because {@code MeApi} exists for
 * exactly this person. „Moja članarina" beside it is a fact about a DIFFERENT screen and
 * not an argument against this one: it went the same way in two fixes rather than one, a
 * way home first and then <b>the renewal itself</b> - PDL P8a moved that screen's own
 * record onto `/api/me` too, the same day, so the boundary this paragraph used to name
 * here is closed and he can renew (`Membership.tsx`; measured on `memberFlows.test.tsx`'s
 * „draws the whole renewal for the member the public list does not carry"). His own
 * profile is the one left turning him away.
 *
 * <p><b>What he had before 24.09.2026 and what he has now, counted rather than
 * summarised.</b> Before: the same sentence on all eleven, with a way home. Now, since
 * „Moja članarina" closed the gap named above (25.09.2026, PDL P8a): <b>six</b> screens
 * that really work and <b>none</b> left that merely fail to strand him, one that turns him
 * away in silence (his own profile), and four that answer him the way they answer anybody
 * not entitled to them. This paragraph has been tightened four times now, and each time by
 * a measurement rather than by rereading it - which is the whole reason the sentence at the
 * top of it was wrong in the first place.
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
