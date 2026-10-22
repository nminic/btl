import type { ResourceState } from '../../data/useResource'
import { whatMyBalanceIs, type MyBalance } from './myBalance'
import { useHeldRead } from './useHeldRead'

/**
 * WHAT THE BOOK SAYS THIS MEMBER HAS, as the server says it when the screen is drawn.
 *
 * <p>Read on every visit and never cached, so that what an administrator did to the book since the
 * last look (an activation that paid a referral, a booking that spent some) is what the next visit
 * draws. That is also why this needs nothing from the screens that move the money: none of them has
 * to know this one exists, and none can leave it stale, because the screen that shows it is not
 * mounted while they work. The count of referrals this replaces was held by the session for the
 * length of the visit, which is the stale figure of 22.10.2026.
 *
 * <p>The read itself is `useHeldRead`'s, and an answer is believed for the reader it was asked
 * under and for no other. A screen that draws a figure only from a `ready` state and nothing for
 * the other two is drawing „no figure" for a read that did not give one, which is the decision
 * `myBalance.ts` states.
 *
 * @param asked whose balance this is: the number of a member, and the account of a reader who has
 *              none. Only what the answer is held against - the cookie decides whose book is read
 */
export function useMyBalance(asked: number | string): ResourceState<MyBalance> {
  return useHeldRead(whatMyBalanceIs, asked, 'His own balance could not be read')
}
