import { useLayoutEffect, type RefObject } from 'react'

/**
 * THE END OF A VISIT, SAID BY THE FORM LEAVING THE SCREEN, WHICHEVER WAY IT GOES.
 *
 * <p>Drawn beside the editor of the events screen and for exactly as long as it is, so the moment
 * that screen takes the form off - the button, a link to the list, the browser's Back - is the one
 * moment a form is over. It moves a number and draws nothing; what the number is for is said where
 * it is held (`visits`, in `AdminEvents.tsx`).
 *
 * <p><b>A layout effect, so the number moves in the very commit that takes the form off.</b> The
 * cleanup of a passive effect runs a task after the commit, and an answer that came in between would
 * still find its visit open. `DeleteRecord` (`EntityEditor.tsx`) is a layout effect for the same kind
 * of reason, one component along: what must be true in the commit that changes the screen is made
 * true in it. Nothing is read off the page here, so there is nothing a layout effect could cost.
 *
 * <p>The number rides in a ref that is handed down and not in state: nothing is drawn from it, and a
 * state set while the form is being taken off would draw the screen once more for nothing.
 */
export function EndsTheVisit({ visits }: { visits: RefObject<number> }) {
  useLayoutEffect(
    () => () => {
      visits.current += 1
    },
    [visits],
  )

  return null
}
