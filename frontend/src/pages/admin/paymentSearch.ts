import type { MembershipDue } from '../../data/types'

/**
 * FINDING ONE NAMED MAN ON A LIST OF WHOEVER IS NOT A MEMBER YET.
 *
 * <p><b>Why there is a search at all, in the owner's own words (27.09.2026):</b> „Svidja mi
 * se pod 1, a da li moze postojati neki search da u tom domenu brzo pronadjem onog koga treba
 * proknjiziti (po clanskom broju, imenu ili prezimenu)?" He reads a bank statement and looks
 * for a named man; he does not page through a list. Three keys, and he named all three.
 *
 * <p><b>THE RULE LIVES IN TWO HOMES AND THIS ONE DECIDES WHAT THE MODERATOR SEES.</b>
 * `GET /api/payments` carries a `search` parameter of its own and narrows the answer server
 * side. <b>This portal never sends it.</b> The list is fetched whole and filtered here, so the
 * answer on screen is decided by this function and by nothing else.
 *
 * <p><b>Why the screen filters rather than the route, which was weighed and not assumed.</b>
 * The cache is keyed by NAME with no parameter in the key (`data/client.ts`, `loadResource`),
 * so a narrowed answer stored under `payments` would be handed straight back to the next
 * reader who asked for the whole list. Sending the parameter would therefore mean either a
 * read outside the cache - a fifth `fetch` in a portal that has exactly four, and no loading
 * or failure state of its own - or widening the one module that knows where data comes from.
 * Neither buys anything the owner asked for: the route does not page and says so in its own
 * note, and the list begins EMPTY on the first day and fills as people register themselves.
 *
 * <p><b>What that costs, said out loud rather than left for a review to find.</b> The route's
 * `search` parameter is unexercised by this portal. It is not dead on the server - it is a
 * public route with its own cases - but nothing here reaches it, so the two rules can drift
 * apart without a single thing going red. The day this portal does send it, the two have to be
 * reconciled, and the one difference measured today is the one to reconcile first: the server
 * assembles a `like` pattern, so `%` and `_` inside a term are WILDCARDS there and are plain
 * characters here. Nobody's name holds either, which is why the difference is written down
 * rather than guarded against.
 *
 * <p><b>The one thing neither home does is fold Serbian diacritics.</b> The server would want
 * `unaccent` and V1 creates no extension at all; `toLowerCase` does not strip accents either.
 * So „Cacic" finds nothing for „Čačić" on both sides, which is at least the same nothing.
 */

/**
 * Whoever the term names, or the whole list where it names nobody in particular.
 *
 * <p><b>Absent and blank are ONE answer and it is „do not narrow", never „match nothing".</b>
 * That is the route's own sentence about the same parameter (ADL A54 asks every route to say
 * which of the two meanings omission has), and the screen has to agree with it or an empty
 * search box would show an empty screen on the one day of the year the list matters most.
 *
 * <p><b>Two readings and three keys, which is not a coincidence but the reason there are only
 * two.</b> The term matches a piece of the member number, or a piece of the given name and the
 * surname joined by a space. The second of those answers „ime" and „prezime" BOTH, because
 * every piece of either name is a piece of the pair - and it also answers the way the owner
 * actually works, since a statement carries „Marko Marković" as one string and a search that
 * could not find it would be a miss on the first morning.
 *
 * <p><b>Separate readings of the two names were left out deliberately.</b> They could not
 * change an answer, for the reason just given, and a condition that cannot change an answer is
 * worse than clutter: it is a reserve that catches exactly what a mutation over the load-bearing
 * reading removes, so a list of mutations reads healthier than it is. The route measured the
 * same thing on its own side and left them out for the same reason.
 *
 * @param accounts the answer as it came, in the order the server sorted it. Never reordered
 *                 here: it is by surname then given name in the league's own alphabet, which is
 *                 how somebody looks for a name he has just read off a statement, and a screen
 *                 that sorted again would be a second home for that decision too.
 */
export function matching(accounts: MembershipDue[], term: string): MembershipDue[] {
  const looked = term.trim().toLowerCase()

  if (looked === '') {
    return accounts
  }

  return accounts.filter(
    (one) =>
      one.memberNumber.toLowerCase().includes(looked) ||
      `${one.firstName} ${one.lastName}`.toLowerCase().includes(looked),
  )
}
