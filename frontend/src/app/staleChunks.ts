/**
 * A PIECE OF THE PORTAL THAT IS NO LONGER ON THE SERVER, and the one reload that fetches the new one.
 *
 * <p>Since the portal is loaded screen by screen (`app/screens.tsx`), a tab opened before a deploy still
 * holds the old list of pieces, each named by a digest of its contents, and the deploy has replaced them:
 * the first screen that tab opens afterwards asks for a file that is not there. Vite says so with the
 * event `vite:preloadError` and, unless somebody answers it, the screen fails. The answer is the page read
 * again, which brings the new list (the coordinator's decision of 22.11.2026, reported to the owner).
 *
 * <p><b>Once, and never in a circle, and remembered by the browser rather than by a store of ours.</b> A
 * page that the browser itself says was loaded by a reload (`PerformanceNavigationTiming.type`) is not read
 * again: a piece that is missing right after a fresh read is not a stale tab, and reloading for it for
 * ever would be a page that never stops loading. Where the browser does not say how the page was loaded,
 * nothing is read again either, for the same reason.
 *
 * <p><b>Why not a mark in `sessionStorage`, which the coordinator offered as an example.</b> Every store the
 * portal writes in the browser is named in the privacy policy, and `pages/writtenPages.test.tsx` holds the
 * code to that text; a new store would need a sentence in a legal document, and those are written in the
 * owner's words only. The browser's own answer needs neither. What it costs: a reader who has reloaded the
 * page by hand and then meets a deploy in the same page is shown the screen's failure instead of a fresh
 * page, and reloads once more himself.
 */

/** As much of the window as this needs, so a case can hand it a page of its own. */
export type APage = {
  addEventListener: (type: string, listener: (event: Event) => void) => void
  location: { reload: () => void }
  performance: { getEntriesByType: (type: string) => readonly unknown[] }
}

/** Whether the browser says this page was loaded by a reload, or cannot say how it was loaded. */
function notToBeReadAgain(page: APage): boolean {
  const how: unknown = Reflect.get(Object(page.performance.getEntriesByType('navigation')[0]), 'type')

  return typeof how !== 'string' || how === 'reload'
}

/** Reads the page again, once, when Vite says a piece of the portal could not be loaded. */
export function reloadOnceWhenAPieceIsGone(page: APage): void {
  page.addEventListener('vite:preloadError', (event) => {
    if (notToBeReadAgain(page)) {
      return
    }

    event.preventDefault()
    page.location.reload()
  })
}
