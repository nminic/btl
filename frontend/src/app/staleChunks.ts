/**
 * A PIECE OF THE PORTAL THAT IS NO LONGER ON THE SERVER, and the one reload that fetches the new one.
 *
 * <p>Since the portal is loaded screen by screen (`app/screens.tsx`), a tab opened before a deploy still
 * holds the old list of pieces, each named by a digest of its contents, and the deploy has replaced them:
 * the first screen that tab opens afterwards asks for a file that is not there. Vite says so with the
 * event `vite:preloadError` and, unless somebody answers it, the screen fails. The answer is the page read
 * again, which brings the new list (the coordinator's decision of 22.11.2026, reported to the owner).
 *
 * <p><b>Once per missing piece, and never in a circle.</b> The piece that failed is written into the
 * tab's own `sessionStorage` before the reload, and a second failure of the SAME piece is let through to
 * the screen's own failure instead of reloading again: a piece that is missing after a fresh read is not a
 * stale tab, and reloading for it for ever would be a page that never stops loading. A different piece,
 * after a later deploy, is reloaded for once in its turn. And where the tab cannot remember (storage
 * refused, a private window that throws), nothing is reloaded at all, because a reload that cannot be
 * remembered is the circle this exists to prevent.
 */

/** Where the tab remembers the last piece it was reloaded for. */
export const RELOADED_FOR = 'btl.reloadedForAMissingPiece'

/** As much of the window as this needs, so a case can hand it a page of its own. */
export type APage = {
  addEventListener: (type: string, listener: (event: Event) => void) => void
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>
  location: { reload: () => void }
}

/** Reads the page again, once per missing piece, when Vite says a piece could not be loaded. */
export function reloadOnceWhenAPieceIsGone(page: APage): void {
  page.addEventListener('vite:preloadError', (event) => {
    /* What failed, as Vite hands it over: the error of the import, whose words carry the address. */
    const missing = String(Reflect.get(event, 'payload'))

    try {
      if (page.sessionStorage.getItem(RELOADED_FOR) === missing) {
        return
      }

      page.sessionStorage.setItem(RELOADED_FOR, missing)
    } catch {
      return
    }

    event.preventDefault()
    page.location.reload()
  })
}
