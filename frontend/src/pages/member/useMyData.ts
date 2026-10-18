import { whatTheServerSaysOfMyData, type MyData } from '../../session/theServer'
import type { ResourceState } from '../../data/useResource'
import { useHeldRead } from './useHeldRead'

/**
 * THE DATA A MEMBER'S OWN SETTINGS SCREEN IS DRAWN FROM: for somebody who registered and has not
 * paid, whom the public list does not carry, and **since 18.10.2026 for a member whose fee stands
 * too**, because that list cannot carry his postal address and his telephone and a panel drawn from
 * it opened both boxes empty after every refresh.
 *
 * <p>PDL P8, the entry „Šta sme neplaćen član" (10.10.2026, chosen by the owner between offered
 * outcomes; the sentence is the record's): such a person may change „svoje podatke za
 * evidenciju i majicu". The settings screen draws those from a record of the public list
 * (`/api/competitors`), which ends `where c.active` and has no row for him, and from nothing
 * else - so he has to be read off the one answer that has a row for him, which is `GET /api/me`
 * (`session/theServer.ts#whatTheServerSaysOfMyData`). This is `profile/useHisOwnRecord.ts`
 * for a person with no number, and it is built the same way for the same reasons.
 *
 * <p>The read itself is `useHeldRead`'s, shared with `useMyPictures`.
 *
 * <p><b>It is a resource in the portal's own sense and not a state of its own</b>, so the screen
 * goes through `components/Resource.tsx` and the three things that must be said are said the way
 * every other read says them: a loading indicator while it is on its way, „Podaci se ne mogu
 * učitati." with „Pokušaj ponovo" when it could not be had, and nothing else. No new words.
 *
 * <p><b>An answer is believed for the account it was asked under and no other.</b> The reader can
 * change inside one visit (a shared laptop at a race is the ordinary case), and the answer that
 * arrives for the first one must not be drawn as the second: it is dropped when it comes back
 * late, and a held answer for another account reads as „not here yet". The server is asked who
 * the cookie names and it is the cookie that decides; the account is only what the answer is held
 * against.
 *
 * <p>The read is dropped, not cached: what is drawn is what the server said a moment ago, and the
 * one screen that uses it does not outlive the visit that asked.
 *
 * @param asked whose data this is: the account of a reader who has no number, and the number of a
 *              member. Only what the answer is held against - the cookie decides whose record comes
 *              back - so the two kinds of key never meet inside one visit's hook
 */
export function useMyData(asked: number | string): ResourceState<MyData> {
  return useHeldRead(whatTheServerSaysOfMyData, asked, 'His own data could not be read')
}
