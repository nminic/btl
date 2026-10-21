import { clearResourceCache, type ResourceName } from '../../data/client'

/**
 * THE CACHED ANSWERS THAT SAY SOMETHING DIFFERENT ONCE A MEMBER'S `active` HAS MOVED (PENDING 29656,
 * and the two that were left after it), held ONCE for every place on the moderator's side that moves it.
 *
 * <p><b>Three places move the flag and they used to keep three lists.</b> `AdminMembers#seasonChanged`
 * (a cancellation, a change of basis, a grant, a payment over an exemption), `AdminMembers#paymentRecorded`
 * (a payment on a row with no season on sale) and `Payments#onActivated` (an activation, through either
 * of its doors) all end with a member whose fee stands or no longer does. PR 605 added `attendance` and
 * `comments` to the first and to nothing else, and the other two went on leaving five names behind
 * (`attendance`, `comments`, `pairs`, `teams`, `results`): a payment can make a lapsed member active,
 * and an activation draws a number and sets the flag, so the member belongs on the public list, in his
 * team's roster, in his pair, on the list of who is going and under his own comments, while the cache
 * this visit holds still says he does not.
 *
 * <p><b>One list, so that the three cannot drift.</b> The names are the ones `rowMembership.test.tsx`
 * reads out of the backend's own SQL (every cached name whose route has a line of SQL naming `active`),
 * plus `payments` and `members`, which are the screens the write itself is made on. That floor
 * (`namesThatReadTheFlag`, now in `test/readsTheFlag.ts` and unchanged) holds THIS list to the backend and
 * drives all three paths through it; it stays what it was, a regular expression over source text, and
 * misses what it missed (a line of SQL that is not a string literal of its own, a view or a function in
 * the database). The one name it finds and this list leaves out is `me/applications`, for the reason
 * written there.
 *
 * <p><b>Not here:</b> the inbox, which depends on whose row it is and is asked for by each path on its
 * own terms; and `deleteOne`, which removes the member rather than moves a flag and drops `verification`
 * as well.
 */
export const WHAT_READS_OR_SHOWS_ACTIVE = [
  'payments',
  'members',
  'competitors',
  'results',
  'teams',
  'pairs',
  'attendance',
  'comments',
] as const satisfies readonly ResourceName[]

/** Drops every answer in {@link WHAT_READS_OR_SHOWS_ACTIVE}, the same eight whatever moved the flag. */
export function dropWhatActiveMoves(): void {
  for (const name of WHAT_READS_OR_SHOWS_ACTIVE) {
    clearResourceCache(name)
  }
}
