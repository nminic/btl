import { useCallback, useEffect, useState } from 'react'
import { clearResourceCache } from '../../data/client'
import { recordKey } from '../../session/context'
import { useSession } from '../../session/useSession'
import { MEMBERS } from '../admin/entityForms'
import type { Answer } from '../account/askTheServer'
import {
  categoryIn,
  tellTheServerMyCategory,
  whatCategoryTheServerSaysIChose,
  type MyCategory,
} from './myCategory'

/**
 * WHAT THE SCREEN NEEDS TO DRAW THE BOX, AND WHAT HAPPENS WHEN SOMEBODY TICKS IT.
 *
 * `standing` is null until the read comes back and stays null where there is nothing to
 * draw - see `whatCategoryTheServerSaysIChose` for why every failure is one outcome. So
 * the screen's condition is `standing !== null`, and nothing about the fee, the calendar
 * or a sum of points is asked on this side at all.
 *
 * **`refusal` is the reason a 409 carried**, which is the whole point of not swallowing
 * it: a member whose deadline passed between drawing the box and pressing it is told so
 * (`theChoiceIsShut`) instead of watching a control do nothing, which PDL.md:1659 calls
 * worse than no control.
 *
 * <p><b>`failure` is every OTHER answer that was not „done", whole</b>, so the screen can say it the way
 * every other screen of the portal does (`ServerSaid`). Owner, 25.10.2026 (`btl-produkt/PDL.md`, „Poruka
 * o probnoj šifri na svakom ekranu koji upisuje: odgovori od 25.10.2026"): the choice of category says
 * every failure - the site locked, a session that ran out, an error of the server, an answer that never
 * came - and not the lock alone. Until then all four were dropped here, and the radio went back to what it
 * was with nothing said, which on a locked site is the very answer the owner decided must be told
 * (ADL, 22.10.2026, „portal to kaže i nudi novu karticu"). The refusal keeps its own sentence, as before.
 */
export type TheCategoryIChoose = {
  standing: MyCategory | null
  choosing: boolean
  refusal: string | null
  failure: Exclude<Answer, { got: 'done' } | { got: 'refused' }> | null
  choose: (firstSeason: boolean) => Promise<void>
}

export function useMyCategory(): TheCategoryIChoose {
  const [standing, setStanding] = useState<MyCategory | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [failure, setFailure] = useState<TheCategoryIChoose['failure']>(null)
  const { memberNumber, editRecord } = useSession()

  useEffect(() => {
    let stillHere = true

    void whatCategoryTheServerSaysIChose().then((said) => {
      /* Dropped where the screen has gone, because setting state on a screen nobody is
         looking at is a warning in the console and a promise nobody awaited. The same
         shape every other read on this side uses. */
      if (stillHere) {
        setStanding(said)
      }
    })

    return () => {
      stillHere = false
    }
  }, [])

  const choose = useCallback(async (firstSeason: boolean): Promise<void> => {
    setChoosing(true)
    setRefusal(null)
    setFailure(null)

    const answered = await tellTheServerMyCategory(firstSeason)

    /* WHAT STANDS AFTERWARDS IS WHAT THE ROUTE ANSWERED, not what was sent. Two of the
       five fields are derived on the server - the right and the category it makes - so a
       screen folding in `{ firstSeason }` alone would leave the member reading the
       category he had before he chose. The route answers the whole state for exactly
       this reason, and `categoryIn` narrows it here the same way the read does. */
    if (answered.got === 'done') {
      const said = categoryIn(answered.body)

      if (said !== null) {
        setStanding(said)

        /* AND EVERY OTHER SCREEN OF THIS VISIT SAYS IT TOO, AT ONCE AND IN BOTH DIRECTIONS
           (PDL P7, owner, 18.10.2026, „Izbor kategorije se vidi odmah i svuda, u oba smera":
           „baš svuda svuda da ostane. Ako vratim na starosnu, treba svuda da se promeni
           ponovo"). Measured on QA before this: the choice was written, and the profile, the
           card, the team and the table went on drawing the list this visit had fetched before
           it, because `data/client.ts` asks for a resource once per visit.

           Two writes and both are needed, which is `ProfileVisibility.tsx`'s own pair: the
           overlay for a screen already holding the list, the dropped cache for the next one to
           read the row. The value is the WISH as the route answered it, because the WISH is
           what `/api/competitors` serves on every row (`beginner`) and what the screens
           make the category of - the right is not on that list, and a beginner's right cannot
           close for 2027 (`BestOfficialSeason` reads the seasons strictly before it). Written
           as the word the overlay keeps (`forms/records.ts`, `like`).

           Nothing for a reader with no member number: he is on no list, so there is no row of
           his for a screen to draw. */
        if (memberNumber !== null) {
          editRecord(recordKey(MEMBERS.id, memberNumber), {
            beginner: String(said.firstSeason),
          })
        }

        clearResourceCache('competitors')
      }
    }

    if (answered.got === 'refused') {
      setRefusal(answered.reason)
    } else if (answered.got !== 'done') {
      setFailure(answered)
    }

    setChoosing(false)
  }, [memberNumber, editRecord])

  return { standing, choosing, refusal, failure, choose }
}
