import { useState } from 'react'

/**
 * A REFUSAL BESIDE ONE ROW, WHICH STANDS UNTIL THE NEXT ACTION ON THAT ROW SUCCEEDS (PENDING 29660,
 * review of PR 579, 19.10.2026, measured).
 *
 * <p><b>The fault.</b> `RowMembership` and `RowPayment`, the two components a row was drawn with until
 * 22.10.2026 (`MemberRow.tsx` is one since), each held the sentence of the last refusal they met, and
 * each cleared it only on THEIR OWN next success. A cancellation refused with „pa
 * ništa nije urađeno” and then a payment over the exemption that went through left both on the row:
 * „Osnov članstva je promenjen.” in the live region and, beside the buttons, a sentence saying that
 * nothing had been done. The two components are siblings, so neither can see the other's state.
 *
 * <p><b>The screen counts, the row reads the count.</b> `AdminMembers` knows when an action on a row
 * went through, whichever of the five controls on it sent it, and hands every row component the
 * number of successes that row has had this visit. A refusal is held for as long as that number is
 * the one it was met under: when the number moves, the refusal goes, in the same render and before
 * anything is drawn from it. The count is a list of member numbers filtered by this row's own, so
 * the success of one row moves the number of that row alone and the refusal beside every other row
 * stays where it is.
 *
 * <p><b>The adjustment is made in the render and not in an effect</b>, which is the pattern React
 * documents for state that follows a prop: an effect would draw one frame of the old sentence beside
 * the new message. <b>And the setter does not close over the count</b>, which is why it is the
 * state's own: a refusal that arrives after another action's success is a refusal of an action that
 * did not go through, and it is shown. A setter that stamped the refusal with the count of the render
 * that sent the request would hide it on arrival.
 *
 * @param settled how many actions on this row have succeeded this visit
 * @return the refusal to draw, and the way to hold a new one
 */
export function useRowRefusal<T>(settled: number): readonly [T | null, (refusal: T | null) => void] {
  const [refusal, setRefusal] = useState<T | null>(null)
  const [seen, setSeen] = useState(settled)

  if (seen !== settled) {
    setSeen(settled)
    setRefusal(null)
  }

  return [refusal, setRefusal]
}
