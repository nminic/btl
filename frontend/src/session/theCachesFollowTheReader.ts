import { useRef } from 'react'
import { clearResourceCache, type ResourceName } from '../data/client'

/**
 * THE NAMES WHOSE ANSWER DEPENDS ON WHO IS ASKING, and that nothing else drops when the
 * person asking changes.
 *
 * <p><b>Five names, and the other three that depend on the reader are not here on purpose.</b>
 * The backend answers eight cached names by asking the caller: seven take the principal
 * (`CompetitorApi`, `TeamApi`, `AttendanceApi`, `CommentApi`, `InboxApi`, `MyApplicationsApi`
 * and `MyResultSubmissionsApi`), and one asks the session through `WhatHeMayDo` instead of
 * taking a parameter (`VerificationApi`), which is why a floor that looked at the parameter
 * alone left it off this list until PENDING 28771. Which routes those are,
 * `session/everyNameThatDependsOnTheReader.test.ts` reads out of the Java source rather than
 * taking from this sentence. `inbox`, `me/applications` and `me/result-submissions` are dropped
 * by their own hooks, keyed by the member number the screen hands them (`data/useResource.ts`,
 * `theInboxNowBelongsTo`, `theWaitingNowBelongsTo` and `theSubmissionsNowBelongTo`). The five
 * here are not asked for a member number by anybody: `competitors` and `teams` are read by
 * twenty-two components and by a visitor too, `attendance` and `comments` are read by the
 * event's page for whoever is signed in, and `verification` is read by the header of every
 * screen (`app/Shell.tsx`, `useWaiting`).
 *
 * <p><b>`verification` answers by shape, and by the RIGHTS of whoever asks (PENDING 28771).</b>
 * `VerificationApi.verification` serves the queues the caller may work in and no others
 * (`WhatHeMayDo.whichOf`), so one address answers a moderator of the teams queue and a
 * moderator of the payments queue two different lists, and a member who may work in none is
 * refused 404 (a failure is never cached, `data/client.ts`). The list one moderator was
 * answered, kept in the visit after he has signed out, is a list the next moderator would
 * draw: the count over every screen of the portal (`useWaiting`) and the queue itself, with
 * the name and the member number of everybody who is waiting in it.
 *
 * <p><b>What they answer differently, and to whom.</b> PDL, section 16 (owner, 27.09.2026):
 * a member who hides his profile loses his team, his picture and his biography to a reader
 * who may not read a hidden profile (a visitor, and since 03.10.2026 a free account and a member
 * whose fee has lapsed), and his team names him instead (`Team.alsoInTheTeam`). So the SAME address
 * answers a visitor, an active member and the administration in three shapes, and the two
 * halves of one screen (the roster, the head count, the sum of a team, the control a founder
 * sees) are put together out of both names.
 *
 * <p><b>`attendance` answers by refusing rather than by shape, since 03.10.2026.</b> Who is going
 * to an event is served to an active member and to the administration and refused 404 to anybody
 * else signed in (the owner's choice that day, in the words PDL records it in: „spisak
 * najavljenih vide aktivni članovi (važeća članarina), a spisak vidi i administracija"). A failure is never cached (`data/client.ts`), so what this
 * drop protects is the other direction: a list a member was answered, kept in this visit after
 * he has signed out, where the next reader's screens would find it without the server having
 * been asked.
 *
 * <p><b>`comments` answers the same way, since 03.10.2026, and for the same reason.</b> Every
 * comment of every event is served to an active member and to the administration and refused
 * 404 to anybody else signed in (PDL P6, 03.10.2026, „Komentare vide aktivni članovi i
 * administracija, isto kao najava dolaska"; the record's sentence, not the owner's words), and a
 * visitor is refused 401 by the chain. Before that day any account that was signed in was served
 * the whole list, so the answer was one thing for everybody who got it and nothing here had to
 * drop it. Now a list a member was answered, kept in this visit after he has signed out, is a list
 * a free account would find on the next screen without the server having been asked, with the
 * name and the member number of every author in it.
 */
export const ANSWERED_TO_THE_READER = [
  'competitors',
  'teams',
  'attendance',
  'comments',
  'verification',
] as const satisfies readonly ResourceName[]

/**
 * WHO IS ASKING, as one word, or nobody.
 *
 * <p>The same two facts `signedIn` is worked out from (`SessionProvider`) and in the same
 * order: the member number wins where both are set, because it names a person in the league
 * and the account only names a row of `account`. A MODERATOR AND A SUPERADMIN HAVE NO MEMBER
 * NUMBER (PDL P21) and are readers all the same - the administration is answered a shape of
 * its own - so reading the member number alone would not see one sign in behind a visitor.
 *
 * <p>`null` is nobody, and it is a reader like any other: somebody who signs out is
 * somebody the next screen is answered differently for.
 */
export function readerOf(memberNumber: string | null, account: number | null): string | null {
  if (memberNumber !== null) {
    return `member ${memberNumber}`
  }

  return account === null ? null : `account ${String(account)}`
}

/**
 * THE CACHES OF {@link ANSWERED_TO_THE_READER} ARE DROPPED THE MOMENT THE READER CHANGES.
 *
 * <p><b>The fault, measured on 02.10.2026.</b> The cache is keyed by address and nobody is in
 * the key (`data/client.ts`), which is safe for as long as a visit is one person, and a visit
 * is not: signing in and signing out happen IN PLACE, and not one of the callers reloads
 * anything. A visitor who opened the front page (which reads `competitors` and not `teams`),
 * signed in and went to the table of teams drew `competitors` as the visitor was answered
 * and `teams` as the member was. The team of a member who hides his profile came out with 10
 * points and one member instead of 17 and two, a second team took the first place, the
 * member himself read „Bez tima" on his own profile, and the founder of that team had no
 * „Izmeni" on its page. Signing in straight from the address bar gave every one of those
 * right, which is the whole of why nothing had shown it.
 *
 * <p><b>Called from the provider's own body, while it renders, and that is the whole of the
 * mechanism.</b> The provider renders before every screen under it, so a screen that mounts
 * in the render a sign in causes reads a cache that is already empty. An effect would run
 * AFTER the screens' own (a child's effect runs before its parent's), and a screen that had
 * already put the old answer into its own state would never hear about it. This is
 * `theInboxNowBelongsTo`'s shape, and it is called from here and not from `data/useResource.ts`
 * because nobody hands these two a reader: there is nothing for a hook to be passed.
 *
 * <p><b>The reader is worked out from the session's state and never from a call.</b> Four
 * places write that state (`SignIn`, `useTheServersSession`, `Membership` and the menu that
 * signs out), and a drop written beside each of them is a drop a fifth can forget. Derived,
 * it cannot be: whoever changes who is signed in has changed the reader.
 *
 * <p><b>The first answer of a visit only registers the reader, and drops nothing.</b> Until
 * the server has answered, and until somebody has been named, nobody is known to be asking.
 * A member who comes back tomorrow already holds a cookie, so everything the first screen has
 * asked for was answered in HIS shape; dropping it when `GET /api/me` says who he is would
 * send the next screen back for `competitors` and `teams` a second time, on every visit of
 * every returning member. The one thing that is a CHANGE is the one that happens after the
 * reader was known, and that is a sign in or a sign out.
 *
 * <p><b>But a sign in that lands BEFORE the first answer is a change, and it drops (PENDING
 * 28766).</b> The visit above begins with nobody known, and the screens under it may already
 * have asked: a visitor opens the front page, the answer to `GET /api/me` is slow or never
 * comes, and he signs in. Registered without a drop, `competitors` and `teams` stay as the
 * visitor was answered them and the first screen he opens as a member draws them. What tells
 * the two apart is that the render in which somebody is named, and the server has not
 * answered, came AFTER a render in which nobody was named and it had not answered either: a
 * returning member is named by the same render that carries the answer (`useTheServersSession`
 * calls both together), and a case rendered as a member names him in the very first render, so
 * neither has such a render behind it and both still only register.
 *
 * <p><b>A ref of the provider and not a variable of the module</b>, so that a visit is the
 * only thing that carries a reader forward: a case that ended as one member does not start the
 * next as him, and a stale reader here could only drop a cache the next case had just filled.
 * Dropping is idempotent, so a render that React repeats or throws away costs at most one more
 * request and never a wrong answer.
 *
 * <p><b>What it does NOT do, written here and not left to be found.</b>
 * <ul>
 * <li>A screen that is open when the reader changes keeps what it read, which is what every
 * screen does after a write that clears these two names as well (nine of them do). `useResource`
 * reads the cache when it mounts and nothing listens to it afterwards, and a notification to
 * every mounted reader was refused for its blast radius (`HowToRead.revision`). The only reader
 * that is mounted for a whole visit, the header's `AccountMenu`, exists only while somebody is
 * signed in, so it mounts fresh at a sign in and goes at a sign out.</li>
 * <li>Signing out does not wait for the server. `AccountMenu` sends the request and forgets at
 * once, on purpose: the portal forgets even where the request never arrives. A screen that
 * mounts in the same beat - `admin/Guard.tsx` sends a moderator who signed out from an
 * administrative screen to the front page at once - asks with the cookie it still holds, and if
 * that request reaches the server before the session row is deleted (`SignOutApi`) it is
 * answered as the member and fills the cache again. Reasoned from those two files; not measured
 * against a real server.</li>
 * <li>An answer already on its way when the reader changes reaches the screen that asked for
 * it and nothing else (review of PR 618): `loadResource` writes what arrived into the cache, and
 * tells the readers that show a failure of the address, only while its promise is still the one
 * the visit holds, and `clearResourceCache` has thrown that promise away. A read of the same
 * address started after the drop is not undone by an older one that fails late either: a promise
 * removes only its own entry. What is left is the first item, a screen that is open and keeps
 * what it read.</li>
 * </ul>
 *
 * @param reader who is asking, from {@link readerOf}
 * @param theServerHasAnswered whether `GET /api/me` has come back. Not the same as somebody
 * being signed in: the four ways to be nobody all end the first and none of them the second.
 */
export function useTheCachesFollowTheReader(reader: string | null, theServerHasAnswered: boolean): void {
  /* Three states and not two: `undefined` is „nobody has said yet", `null` is nobody, and a
     word is somebody. Folding the first into the second is the shape that drops everything a
     returning member's first screen asked for. */
  const answeredFor = useRef<string | null | undefined>(undefined)
  /* Whether a render has already seen the visit with nobody named and no answer yet, which is
     the only thing that makes „somebody is named and the server has not answered" a sign in and
     not the way a visit began (28766). */
  const sawNobodyBeforeTheAnswer = useRef(false)

  if (answeredFor.current === undefined) {
    /* Nobody has been registered yet, and until the server answers or somebody is named there is
       nobody to register: `null` here is „not asked yet" and not „nobody". Only this arm waits.
       Once a reader is registered, a change to `null` is a sign out and it counts at once, whether
       or not the server has answered (a case rendered as a member has a reader before it has an
       answer). */
    if (!theServerHasAnswered && reader === null) {
      sawNobodyBeforeTheAnswer.current = true

      return
    }

    answeredFor.current = reader

    /* A sign in that came before the first answer, behind a render that had nobody: whatever the
       screens asked for in between was answered to the visitor, or to the cookie, and not to him. */
    if (!theServerHasAnswered && sawNobodyBeforeTheAnswer.current) {
      dropWhatDependsOnTheReader()
    }

    return
  }

  if (answeredFor.current === reader) {
    return
  }

  answeredFor.current = reader

  dropWhatDependsOnTheReader()
}

function dropWhatDependsOnTheReader(): void {
  for (const name of ANSWERED_TO_THE_READER) {
    clearResourceCache(name)
  }
}
