import { useRef } from 'react'
import { clearResourceCache, type ResourceName } from '../data/client'

/**
 * THE NAMES WHOSE ANSWER DEPENDS ON WHO IS ASKING, and that nothing else drops when the
 * person asking changes.
 *
 * <p><b>Three names, and the other two that depend on the reader are not here on purpose.</b>
 * The backend answers five cached names by asking the caller (`CompetitorApi`, `TeamApi`,
 * `AttendanceApi`, `InboxApi`, `MyApplicationsApi` take the principal; no other route behind a
 * cached name does, which `session/everyNameThatDependsOnTheReader.test.ts` reads out of the
 * Java source rather than taking from this sentence). `inbox` and `me/applications` are dropped
 * by their own hooks, keyed by the member number the screen hands them (`data/useResource.ts`,
 * `theInboxNowBelongsTo` and `theWaitingNowBelongsTo`). The three here are not asked for a
 * member number by anybody: `competitors` and `teams` are read by twenty-two components and by
 * a visitor too, and `attendance` is read by the event's page for whoever is signed in.
 *
 * <p><b>What they answer differently, and to whom.</b> PDL, section 16 (owner, 27.09.2026):
 * a member who hides his profile loses his team, his picture and his biography to a reader
 * with no session, and his team names him instead (`Team.alsoInTheTeam`). So the SAME address
 * answers a visitor, anybody signed in and the administration in three shapes, and the two
 * halves of one screen (the roster, the head count, the sum of a team, the control a founder
 * sees) are put together out of both names.
 *
 * <p><b>`attendance` answers by refusing rather than by shape, since 03.10.2026.</b> Who is going
 * to an event is served to an active member and to the administration and refused 404 to anybody
 * else signed in (owner, that day: „spisak najavljenih vide aktivni članovi (važeća članarina), a
 * spisak vidi i administracija"). A failure is never cached (`data/client.ts`), so what this
 * drop protects is the other direction: a list a member was answered, kept in this visit after
 * he has signed out, where the next reader's screens would find it without the server having
 * been asked.
 */
export const ANSWERED_TO_THE_READER = ['competitors', 'teams', 'attendance'] as const satisfies readonly ResourceName[]

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
 * <li>An answer already on its way when the reader changes still lands in the cache:
 * `loadResource` writes what arrived after `clearResourceCache` has thrown the promise away.
 * That needs a request in flight at exactly that moment, which a sign in (a form to fill in)
 * all but rules out and a sign out meets only by being pressed while the screen is still
 * loading. Closing it is a change to the cache every screen goes through, and it is its own
 * change.</li>
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

  if (answeredFor.current === undefined) {
    /* Nobody has been registered yet, and until the server answers or somebody is named there is
       nobody to register: `null` here is „not asked yet" and not „nobody". Only this arm waits.
       Once a reader is registered, a change to `null` is a sign out and it counts at once, whether
       or not the server has answered (a case rendered as a member has a reader before it has an
       answer). */
    if (theServerHasAnswered || reader !== null) {
      answeredFor.current = reader
    }

    return
  }

  if (answeredFor.current === reader) {
    return
  }

  answeredFor.current = reader

  for (const name of ANSWERED_TO_THE_READER) {
    clearResourceCache(name)
  }
}
