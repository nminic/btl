import { useSyncExternalStore } from 'react'

/**
 * WHERE THE HEADER TAKES THE SHAPE OF A TELEPHONE (owner, 16.11.2026, PDL „Pravilnik prelazi u podnožje,
 * a Timovi postaju treća kartica BTL tabela”, answer 3, chosen with my recommendation: „Desktop oblik,
 * reči u drugom redu, važi od 700 px naviše”). Under it the first row holds the mark and the language
 * and the second row is one cell per entry; from it up the header is the one it always was.
 *
 * In `em` and not in `px`, because this changes the shape and does not take anything away (ADL A7,
 * 13.08.2026, „Prelomne tačke idu u `em` tamo gde menjaju oblik"), so at 200% text a window of 1280px is
 * read as one of 640 and gets the telephone's row. 43.74875em is 699.98px at the browser's own 16px, the
 * width already on the closed list of the portal (`styles/scale.test.ts`), written the way the sheets
 * write the lower half of 700 (`max-width: 699.98px`).
 *
 * WHY THE QUESTION IS ASKED HERE AND NOT ONLY IN A STYLESHEET. On a telephone the envelope and the
 * picture stand in the second row, after the words, and on a desktop in the first, after the language.
 * A stylesheet can move a box and cannot move it in the document, so one document for both would give
 * one of the two widths a focus that jumps: from the language down to the end of the second row and
 * back to its start, or on a desktop from the words back up to the envelope (WCAG 2.2 SC 2.4.3). So the
 * shell draws each in the order it is read at that width, and this is the one place the width is
 * named: the stylesheet asks for the shape by its class (`shell__header--phone`), never by a width of
 * its own, so the two cannot disagree about where the telephone ends.
 */
export const PHONE_HEADER = '(max-width: 43.74875em)'

function subscribe(changed: () => void): () => void {
  const query = window.matchMedia(PHONE_HEADER)

  query.addEventListener('change', changed)

  return () => query.removeEventListener('change', changed)
}

function isPhone(): boolean {
  return window.matchMedia(PHONE_HEADER).matches
}

/**
 * Whether the header is drawn in the shape of a telephone, asked before the first paint, so nothing is
 * drawn in one shape and moved into the other a moment later. It follows the window as it is turned or
 * resized.
 */
export function usePhoneHeader(): boolean {
  return useSyncExternalStore(subscribe, isPhone)
}
