import { useCallback, type RefObject } from 'react'
import { useBlocker } from 'react-router'

/**
 * THE ROUTER, TOLD TO REFUSE EVERY NAVIGATION FOR AS LONG AS A SAVE IS OUT.
 *
 * <p>Owner, 04.10.2026, chosen between offered outcomes (PDL, P6, „Dok čuvanje događaja traje"; the
 * wording was offered to him and the choice is his): while the save of an event lasts, the form cannot be
 * left in any way, and the links and the browser's Back wait for the save to end. The button is
 * `EntityEditor`'s own (`holdsWhileSaving`); this is everything else.
 *
 * <p><b>The router and not the links.</b> A form that is left by a link, by the language menu, by the
 * browser's Back or Forward, by a change of the address or by a `<Navigate>` inside the screen is left by
 * a navigation the router sees, whichever component asked for it, so one refusal here covers every road
 * there is today and every one that is drawn tomorrow. Told off one link at a time, the thirty the shell
 * draws for an administrator would be thirty places to forget one (measured, `leavingWhileSaving.test.tsx`:
 * every link the page draws, the language menu, Back and Forward are refused while a save is out).
 *
 * <p><b>It reads the ref and not a state</b> (`EntityEditor`'s `asking`, the same one that refuses a second
 * press): a state is true only after the render the press causes, and a navigation that comes in the same
 * tick as the press would find the router open. The refusal therefore begins in the very tick the press
 * does and ends in the very tick its last answer comes, whatever the answer is.
 *
 * <p><b>What it does not refuse, written down and not guarded.</b> Signing out and, on QA, changing the role
 * are not navigations but changes of what the portal knows about the reader, and the door
 * (`Guard`) then takes the whole screen off; the owner chose that they go on working while a save is out
 * (04.10.2026): whoever signs out in the middle of a save is not told what was saved, and the answer that
 * comes late is written into a screen that is gone. Refreshing the page, closing the tab and leaving the
 * portal are the browser's to allow (derived from the precedent of 02.10.2026, not the owner's word). A
 * change of the address's hash alone is not a way out of a form, and the router could not take it back
 * anyway.
 *
 * <p><b>Nothing else on the portal may call `useBlocker`.</b> A router keeps one blocker at a time and
 * answers to the last that was given, so a second one anywhere would silently replace this.
 */
export function BlocksLeaving({ out }: { out: RefObject<boolean> }) {
  const whileOut = useCallback(() => out.current, [out])

  useBlocker(whileOut)

  return null
}
