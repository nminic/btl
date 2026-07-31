import { useEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router'

/**
 * Puts the reader at the top of a new screen, and puts the keyboard there too.
 *
 * A browser does both of these by itself when it loads a page. A single page
 * application does neither, and this one did neither: opening a competitor from
 * the foot of a long table left the reader looking at the middle of that
 * person's profile, which reads as a fault in the portal rather than as a page
 * that happens to be shorter. `ScrollRestoration` in the shell answers the
 * scroll, and going back still lands where it left.
 *
 * The keyboard is the other half. After a navigation the focus sits on `body`,
 * so a screen reader carries on reading from the top of the document while the
 * eye is somewhere else, and the first Tab goes to the skip link rather than
 * into the screen just opened. Focus moves to the main landmark instead, which
 * is why it takes `tabIndex={-1}`.
 *
 * Only the path counts. A filter that writes itself into the query is not a new
 * screen, and stealing focus every time somebody picks a season would be worse
 * than the fault this fixes.
 */
export function useNewScreen(main: RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation()
  /* The path this ran for last, rather than a flag saying it has run.
   *
   * A flag does not survive StrictMode, which runs every effect twice in
   * development: the second run found the flag already set and took the focus on
   * the very first load of the page, which is the one moment it must not. Then
   * the tests said one thing, because they mount no StrictMode, and the
   * development server said another, and neither of them was production.
   *
   * Holding the path makes the guard idempotent: run it as many times as you
   * like for the same screen and nothing happens twice. */
  const came = useRef(pathname)

  useEffect(() => {
    /* Not on the screen the page loaded with. The browser has its own idea of
       where the focus belongs there, and taking it away announces a screen the
       reader never asked to be taken to. */
    if (came.current === pathname) {
      return
    }

    came.current = pathname
    /* Without this the focus can undo the scroll that ScrollRestoration has just
       put back, by pulling the landmark into view. */
    main.current?.focus({ preventScroll: true })
  }, [pathname, main])
}
