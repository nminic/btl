/**
 * WHERE THE SIGN IN PAGE SENDS A READER BACK TO: the address he came from, and only where it is an address of
 * this portal.
 *
 * <p>Owner, 07.11.2026 (PDL, „Prijava vraća čitaoca na adresu sa koje je došao”), chosen between offered
 * outcomes with the recommendation: „Prijava vraća čitaoca na adresu sa koje je došao, ali samo na adrese
 * portala (bez preusmerenja na tuđe sajtove). Važi za svaku stranu koja traži prijavu.” And, the same day:
 * „Povratak posle prijave važi za strane koje kažu „Za ovo treba prijava”; dugme „Prijava” u zaglavlju i
 * dalje vodi na „Moj profil”.” So the address is put down by the one screen that says that sentence
 * (`SignedOut.tsx`), and nobody else.
 *
 * <p><b>Carried in the state of the navigation and not in a query</b>, the shape `pages/teamDeleted.ts` has:
 * it belongs to that one arrival at the sign in page, and a link somebody else wrote cannot put anything
 * there. It is still asked of by shape and checked as though it could, because `location.state` is
 * `unknown` and any screen may have put anything in it.
 */
const BACK = 'signInBack'

/** The state the link to the sign in page carries: the address of the screen that asked for a sign in. */
export function cameFrom(address: string): { [BACK]: string } {
  return { [BACK]: address }
}

/**
 * The address to go back to, or null where there is none to trust: nothing was carried, it is not a path
 * of this portal, or it is the sign in page itself.
 *
 * <p><b>Asked of the parser and not of a pattern</b>, the way `data/outsideLink.ts` asks a browser's own
 * reading of an address: the one question is what a browser would open, and `//zlo.example`, `/\zlo` and
 * a tab or a newline in the middle are each read by the parser as another host, which a pattern written
 * for the first of them misses for the rest. So the address must start with one slash, be read against
 * the portal's own origin, and come out ON that origin.
 *
 * <p><b>And what is handed back is asked the same question again</b>, because it is not the text that was
 * read. It is the path, the query and the part after `#` the parser made of it, never the whole address, so
 * nothing of a host is copied over; but the parser has by then also resolved the dotted segments, and
 * `/.//zlo.example` is read on the portal and comes out as the path `//zlo.example`, which the router hands
 * to the browser as another host (security review of PR 703). So the path handed back is refused where it
 * begins with two slashes (the shape) and where it does not stay on the portal when it is read again (the
 * property). Each refuses every such input on its own; the two stand together on purpose.
 */
export function backAfterSignIn(state: unknown, origin: string): string | null {
  const said: unknown = state === null ? undefined : Reflect.get(Object(state), BACK)

  if (typeof said !== 'string' || !said.startsWith('/')) {
    return null
  }

  let read: URL

  try {
    read = new URL(said, origin)
  } catch {
    /* An address a browser refuses, `//[` with a bracket nobody closed among them: nothing to go back to. */
    return null
  }

  if (read.origin !== origin || THE_SIGN_IN_PAGE.test(read.pathname)) {
    return null
  }

  const back = `${read.pathname}${read.search}${read.hash}`

  return back.startsWith('//') || new URL(back, origin).origin !== origin ? null : back
}

/** The sign in page in any language, where going back would only draw the form again. */
const THE_SIGN_IN_PAGE = /^\/[^/]+\/prijava\/?$/
