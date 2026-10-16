import { useSession } from './useSession'

/**
 * WHETHER THE PORTAL DOES NOT YET KNOW WHO IS READING, which is a different question from
 * whether anybody is.
 *
 * <p><b>The fault this answers.</b> At the first paint of every visit the session names nobody,
 * and it is the same nobody whether the reader is a visitor or a member whose cookie `GET /api/me`
 * has not yet been asked about (`session/useTheServersSession.ts`). The portal drew that nobody as
 * a visitor: a member opening a screen of his own met „Za ovo treba prijava" for as long as the
 * answer took, the header offered him „Prijavi se" and „Učlani se", and a past event told him the
 * comments are for members. Each was true of a visitor and none was true of him (owner,
 * 10.10.2026, PDL P26: „Dok server ne kaže ko čita: dugmad u zaglavlju nevidljiva, rečenica o
 * komentarima ide u isti posao, pad mreže isto kao posetiocu").
 *
 * <p><b>It is true only while BOTH hold, and neither alone is the question.</b> The session names
 * nobody, AND the server has not said it is done (`theServerHasAnswered`, which is true for every
 * outcome of the request and not only the ones that sign somebody in). Asked of the first alone it
 * is „nobody is signed in" and stays true for a visitor for good, so a visitor would wait for ever
 * on the answer he already has. Asked of the second alone it is true for a member who has just
 * signed in through the form, whom the session already names and who must not be made to wait.
 *
 * <p><b>A dead server ends it like any other answer</b> (`theServerAnswered` is called on a 401, a
 * host that is not there, a body of the wrong shape, and by the bound a socket that never answers
 * is given), so the reader a failed request leaves is drawn as the visitor, exactly as he was
 * before this existed.
 */
export function useServerIsStillBeingAsked(): boolean {
  const { signedIn, theServerHasAnswered } = useSession()

  return signedIn === null && !theServerHasAnswered
}
