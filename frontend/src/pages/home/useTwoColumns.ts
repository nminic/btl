import { useSyncExternalStore } from 'react'
import { TWO_COLUMNS } from './rowsThatFit'

function subscribe(changed: () => void): () => void {
  const query = window.matchMedia(TWO_COLUMNS)

  query.addEventListener('change', changed)

  return () => {
    query.removeEventListener('change', changed)
  }
}

/**
 * WHETHER THE FRONT PAGE STANDS IN TWO COLUMNS, asked of the same query `Home.css` splits the page at and
 * `rowsThatFit.ts` counts races by (`TWO_COLUMNS`, held to the sheet in `homeLayoutStyle.test.ts`).
 *
 * **What it is for** (ADL A7: „Redosled vidžeta u markupu naslovne je redosled na telefonu"; owner,
 * 21.11.2026, chosen with the recommendation put to him: „Kod prati ekran"). Under the query the page is one
 * column and the widgets are written in the order they are seen, so the order of the markup, of the focus
 * and of a screen reader is the order of the eye (WCAG 2.4.3, 1.3.2) and the stylesheet moves nothing with
 * `order`. From the query up they are written as two columns. **The price, accepted:** the widgets are
 * mounted again when a window crosses the query, so a length chosen in the calendar and the turning chart go
 * back to their beginning.
 *
 * The page is drawn in the browser only (`createRoot`), so there is no server answer to give.
 */
export function useTwoColumns(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(TWO_COLUMNS).matches)
}
