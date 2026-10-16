import type { ReactElement } from 'react'
import { Loader } from '../../components/Loader'
import { useServerIsStillBeingAsked } from '../../session/useServerIsStillBeingAsked'
import { useSession } from '../../session/useSession'
import { NotAMemberYet } from './NotAMemberYet'
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
 * <p><b>AND UNTIL 11.10.2026 SOMEBODY WHO HAD REGISTERED AND NOT PAID WAS IN THE THIRD ANSWER
 * AS WELL, which was the same fault one door along, and it is the reason this hook has a
 * fourth answer.</b> The third was „the session names no member", and there were three ways to
 * be there: an account that races for nobody, which is administration and is permanent; a
 * server saying something this portal does not know, which must land somewhere and lands
 * here; and <b>somebody who has registered and has not been given a number</b> (ADL A44,
 * owner 11.09.2026: „Osoba je `competitor` od registracije, a clan postaje kad dobije
 * broj"). The third of those was told „uz ovaj nalog ne stoji takmicarski zapis", which was
 * not true of him - he has a record, and what he has not got is a number. This file said it
 * was „worth a word to the owner and not a fourth state", on the strength of PDL 19.09.2026
 * („NIJE otvoreno pitanje i ne trazi trece stanje"). **That entry was about what he may DO,
 * and the owner chose what he may do on 10.10.2026 (PDL P8, the entry „Šta sme neplaćen
 * član", chosen between offered outcomes; the sentence is the record's and not his own
 * words): „Sme: izbor kategorije i plaćanje, lozinku, adresu pošte i svoje podatke za
 * evidenciju i majicu. Ne sme ništa što ga čini vidljivim ili ga uključuje u ligu".** What he is
 * TOLD was a separate matter and it was a fault: the agent working on P8U found on 10.10.2026,
 * and it was checked in the code, that a member who had registered met „Ovaj deo je za
 * takmicare" on all eleven screens, „Moja clanarina" among them, and was shown a payment slip
 * nowhere. Registration hands out no number (30.07.2026), and on QA the owner was the only
 * competitor, so from 15.10.2026 every new member is this member.
 *
 * <p><b>SO THERE ARE FOUR ANSWERS, and the hook is the only place that tells them apart:</b>
 * nobody signed in; a member (whose fee stands or has lapsed, a flag on the answer); somebody
 * who has registered and has not paid; and an account with no record. Two screens are drawn
 * for the third of them instead of telling him, and say so by asking
 * {@link useScreenForTheUnpaidToo}: „Moja clanarina", where he pays and chooses his category, and
 * the settings, where he changes his data and his password. The other nine ask
 * {@link useMemberScreen} and are told, by {@link NotAMemberYet}, that the rest opens when his
 * fee is recorded and where to go to pay it.
 *
 * <p><b>The member whose fee has LAPSED is a member here, not a fifth answer, and that is
 * deliberate.</b> PDL P8, 11.10.2026 (the addition to „Šta sme neplaćen član", the owner's choice
 * between offered outcomes): that list of what an unpaid member may do holds for somebody who
 * never paid and not for somebody whose fee has lapsed, who „dopire samo do obnove i svog
 * profila" - the record's words, and the data and the password of such a member are answered 404
 * while his choice of category, his payment and his own profile stay open. What differs for him
 * is therefore two forms of the settings screen, not the screen: he has a number, so every screen
 * asked by {@link useMemberScreen} draws for him exactly as it did, and the flag on the member
 * answer is what the settings read.
 *
 * <p><b>WHAT THIS HOOK DID NOT SAY IS KEPT BY THE DOORS OF THE SERVER, and that is a decision
 * of the owner's rather than this hook's omission.</b> PDL P8, owner 19.09.2026: „Zelim da od
 * svih mesta clan kojem je istekla clanarina moze da pristupa samo strani za obnovu clanarine,
 * dok ga verifikator ne odobri." — and the same decision names where the refusal goes:
 * „prijava uspeva, a odbijaju vrata svake pojedinacne rute". The door of each route on the
 * server, and the sign in deliberately untouched. **This said, until 11.10.2026, that „no route
 * keeps it yet" (measured 22.09.2026), and it is corrected rather than deleted because a
 * sentence saying a rule is kept nowhere is an invitation to keep it here.** The doors of the
 * writes are closed by P8U (PR 522): the writes that are an act of his own in the league are
 * answered 404 to somebody who has not paid and to a member whose fee has lapsed, with the number
 * and the bytes an account with no member is answered, and the author of that change measured it
 * route by route. What this hook does is therefore not enforcement and must not become it: a
 * refusal drawn here is a second home for a rule whose home is the route, and the screens ask the
 * server and say what it answered.
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
 * anything about a lapsed fee. What was really his alone was <b>his own profile</b>, which
 * an active member opened and he was redirected away from.
 *
 * <p><b>THIS SAID THE REDIRECT „CANNOT BE ANYTHING ELSE THERE, BECAUSE THE PROFILE IS HIS BY
 * DEFINITION", AND THAT WAS THE OPPOSITE OF WHAT THE OWNER DECIDED.</b> PDL P8, 25.09.2026,
 * „Treba da moze da otvori svoj profil dokle god postoji": the redirect belongs to a profile
 * nobody may reach, and a member's own is not one, so it is exactly what the redirect cannot
 * be there. Corrected rather than deleted, because a sentence saying a redirect cannot be
 * anything else is an instruction to the next reader to put it back. Since 10.10.2026 his own
 * profile opens, drawn from his own record (`pages/profile/visible.ts`, `his`).
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
 * profile was the one left turning him away until 10.10.2026.
 *
 * <p><b>What he had before 24.09.2026 and what he had on 10.10.2026, counted rather than
 * summarised - and NOT counted again since the doors of the writes closed.</b> Before: the
 * same sentence on all eleven, with a way home. On 10.10.2026, once his own profile opened
 * (PDL P8a): <b>seven</b> screens that really work, his own profile among them, <b>none</b>
 * left that merely fail to strand him or turn him away in silence, and four that answer him the
 * way they answer anybody not entitled to them. It was six, one and four from 25.09.2026 until
 * that day. That count was taken while every write still accepted him, so it says what the
 * SCREENS do and not what the server then does with a press; it has not been taken again, and a
 * reader who needs it should measure rather than add. This paragraph has been tightened five
 * times now, and each time by a measurement rather than by rereading it - which is the whole
 * reason the sentence at the top of it was wrong in the first place.
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
 * graph instead - which modules of the portal name `SignedOut`, `NotRacing` and
 * `NotAMemberYet` - and requires the answer to be this file and nothing else.
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

/**
 * The same question for the two screens that are drawn for somebody who has not paid: who is
 * reading, and in which of the four ways.
 *
 * <p>`standing` is the whole answer and the rest follows from it, so a screen that reads the
 * number off a `neverPaid` or the account off a member does not compile: a member has a number,
 * somebody who has not paid has an account and no number, and nobody else has either to draw
 * from. `instead` is what to draw for the fourth way and for nobody signed in, exactly as in
 * {@link MemberScreen}.
 */
export type ScreenForTheUnpaidToo =
  /** A member, and whether his fee stands. A flag and not two kinds of person, for the reason
   *  written on {@link useMemberScreen}. */
  | { standing: 'standing' | 'lapsed'; memberNumber: string; instead: null }
  /** Somebody who registered and has not paid: a record, no number. His account is the key
   *  the screen asks the server for his data under (`pages/member/useMyData.ts`). */
  | { standing: 'neverPaid'; memberNumber: null; account: number; instead: null }
  /** Nobody signed in, or an account the league keeps no record of. */
  | { standing: null; memberNumber: null; instead: ReactElement }

/**
 * THE QUESTION ASKED BY THE TWO SCREENS THAT ARE OPEN TO SOMEBODY WHO HAS NOT PAID, and it is
 * the only place that tells the four apart.
 *
 * <p>Everything {@link useMemberScreen} answers is worked out from this, so the two cannot
 * disagree about who is a member: that one folds the unpaid into „draw the sentence", this one
 * hands him through.
 */
export function useScreenForTheUnpaidToo(): ScreenForTheUnpaidToo {
  /* THE SAME FIELD THE HEADER READS, AND DELIBERATELY NOT THE MEMBER NUMBER BESIDE IT.
     `signedIn` is worked out from the only facts there are and cannot drift away
     from either (session/context.ts); the member number is one of those facts and
     answers a narrower question than the one being asked here. */
  const { signedIn } = useSession()
  const asking = useServerIsStillBeingAsked()

  if (signedIn === null) {
    /* UNTIL THE SERVER HAS SAID WHO IS READING THE SCREEN SAYS NOTHING ABOUT HIM (owner, 10.10.2026,
       PDL P26): the portal's own indicator, the one the door of administration draws for the same
       moment (`pages/admin/Guard.tsx`), and not „Za ovo treba prijava", which is a statement about
       a visitor made to a member whose cookie nobody has asked about yet. The wait ends on every
       outcome of the request (`session/useServerIsStillBeingAsked.ts`), so a visitor, and a reader a
       failed request leaves, are told the sentence they always were. */
    return {
      standing: null,
      memberNumber: null,
      instead: asking ? <Loader inline={false} /> : <SignedOut />,
    }
  }

  if (signedIn.as === 'member') {
    return {
      standing: signedIn.feeStands ? 'standing' : 'lapsed',
      memberNumber: signedIn.memberNumber,
      instead: null,
    }
  }

  return signedIn.as === 'neverPaid'
    ? { standing: 'neverPaid', memberNumber: null, account: signedIn.account, instead: null }
    : { standing: null, memberNumber: null, instead: <NotRacing /> }
}

export function useMemberScreen(): MemberScreen {
  const who = useScreenForTheUnpaidToo()

  /* THE SENTENCE FOR SOMEBODY WHO HAS NOT PAID IS DRAWN HERE AND NOWHERE ELSE, the same
     arrangement `SignedOut` and `NotRacing` have: the nine screens that ask this hook cannot
     say it for themselves, and `oneQuestion.test.tsx` requires that the only module naming
     `NotAMemberYet` is this one. */
  if (who.standing === 'neverPaid') {
    return { memberNumber: null, instead: <NotAMemberYet /> }
  }

  return who.standing === null
    ? { memberNumber: null, instead: who.instead }
    : { memberNumber: who.memberNumber, instead: null }
}
