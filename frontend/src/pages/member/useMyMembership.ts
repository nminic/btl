import { useCallback } from 'react'
import { methodFor, type PaymentMethod } from '../../data/paymentQr'
import type { ResourceState } from '../../data/useResource'
import { whatIOwe, type MyMembership } from './myMembership'
import { useHeldRead } from './useHeldRead'

/**
 * Whether an answer is one this panel can draw from: about the season it sells, and asking for its
 * money in a way he pays. A membership that already stands asks for nothing, so its money is not
 * looked at, and neither is the money of nought to transfer.
 */
function aboutThisPanel(said: MyMembership, season: number, ways: readonly string[]): boolean {
  if (said.season !== season) {
    return false
  }

  if (said.alreadyAMember || said.toTransfer.amount <= 0) {
    return true
  }

  const way = methodFor(said.toTransfer.currency)

  return way !== null && ways.includes(way)
}

/**
 * What he sends for the season on sale, held as a read of its own, keyed by whose read it is: the
 * same shape `useMyBalance` has beside it, for the reason `useHeldRead` gives.
 *
 * <p><b>AN ANSWER ABOUT ANOTHER SEASON, OR IN MONEY THAT IS NOT HIS WAY TO PAY, IS A READ THAT DID
 * NOT ANSWER</b> (PDL, decision of 25.10.2026, „ista rečenica kao kad iznos ne stigne"): the panel
 * says the sentence it says when the amount does not arrive, with the same „Pokušaj ponovo". So it is
 * turned into the `null` `useHeldRead` already keeps for „answered something the portal cannot
 * believe", which is what carries the way to ask again; deciding it on the screen instead would leave
 * a ready answer with no such way. The season and the ways to pay are part of the key, so an answer
 * believed for one season is never drawn for another while it is asked again.
 */
export function useMyMembership(
  asked: number | string,
  season: number,
  methods: readonly PaymentMethod[],
): ResourceState<MyMembership> {
  /* One string and not the array, because the caller hands in a new array on every render and the
     read must stay the same function while nothing it depends on has moved. */
  const ways = methods.join(' ')
  const read = useCallback(async () => {
    const said = await whatIOwe()

    return said !== null && aboutThisPanel(said, season, ways.split(' ')) ? said : null
  }, [season, ways])

  return useHeldRead(read, `${String(asked)} ${String(season)} ${ways}`, 'What he owes could not be read')
}
