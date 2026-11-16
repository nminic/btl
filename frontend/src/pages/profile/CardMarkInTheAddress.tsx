import { useEffect, useState } from 'react'
import { useFilterParams } from '../../app/useFilterParams'
import { CARD_MARK, markOf } from './cardMark'

/**
 * WRITES THE MARK OF HIS CARD INTO THE ADDRESS OF HIS OWN PROFILE, and draws nothing.
 *
 * Owner, PDL P11, 16.11.2026, point 15: the member „i dalje samo kopira link iz pregledača", and after
 * every change of his card that is a new link (`profile/cardMark.ts` says why and where the mark comes
 * from). The profile mounts this only on the member's own page at its own address
 * (`pages/CompetitorProfile.tsx`), never on another member's and never inside „moj profil", whose
 * address names no profile and so has no preview a network could keep.
 *
 * **In place, never as a new entry in the history.** The mark is not a step the member took: written
 * as one, the back button would first walk him from his profile to his profile. So it is a `replace`,
 * through `useFilterParams`, which is how every screen of the portal writes its address
 * (`app/filterParams.test.ts`) and which keeps the reader where he is on the page.
 *
 * **Everything else in the address stays as it was.** The filters of the profile (`sezona`,
 * `duzina`) are copied over with the mark, and a filter written later copies the mark over in turn
 * (`changeLength` and `SeasonPicker` both start from the address as it stands). The one control that
 * empties the address, „Poništi filtere", empties the mark too, and it is written back at once, in
 * place.
 *
 * **Asked once per member and language**, which is what the key the profile mounts it under says, so a
 * mark asked for one language is never written into the address of the other. An address that already
 * carries a mark (a link he copied before the card changed) is given the mark the server says now.
 */
export function CardMarkInTheAddress({ memberNumber, locale }: { memberNumber: string; locale: string }) {
  const [params, setParams] = useFilterParams()
  const [mark, setMark] = useState<string | null>(null)

  useEffect(() => {
    let stillHere = true

    void markOf(memberNumber, locale).then((heard) => {
      /* Dropped where the page has gone, for the reason every read on this side drops it
         (`profile/useHisOwnRecord.ts`). */
      if (stillHere) {
        setMark(heard)
      }
    })

    return () => {
      stillHere = false
    }
  }, [memberNumber, locale])

  useEffect(() => {
    if (mark === null || params.get(CARD_MARK) === mark) {
      return
    }

    const next = new URLSearchParams(params)

    next.set(CARD_MARK, mark)
    setParams(next, { replace: true })
  }, [mark, params, setParams])

  return null
}
