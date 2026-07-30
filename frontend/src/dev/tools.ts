/**
 * Whether the development controls are drawn: the role switch, and the switch
 * that moves the day the portal thinks it is.
 *
 * Both exist for the same reason. The flows have to be walked and approved
 * before there is any authentication to reach them with, and half of what the
 * portal does depends on the date: registration opens on 1 October, the price
 * changes three times, renewal only opens inside its window, the calendar opens
 * on the first month still ahead. None of that can be looked at on the day it is
 * being built without moving the clock.
 *
 * That is useful in local development and on QA, which is behind a password and
 * is never indexed, and it must never appear in production. There the role
 * switch would let any visitor draw themselves an administration menu, and the
 * date would let them read a portal that says things which are not yet true.
 *
 * QA is a production build, so `DEV` is false there. The QA image is therefore
 * built with VITE_DEV_TOOLS=1 (deploy/compose.qa.yml); production sets nothing.
 *
 * The value has to be exactly `1`. Not "true", not "yes": anything else leaves
 * the controls off, which is the safe way round to be wrong but is a confusing
 * hour on QA if nobody says so.
 */
export function devToolsEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === '1'
}
