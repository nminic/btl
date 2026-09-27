import { useCallback, useEffect, useState } from 'react'
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
 */
export type TheCategoryIChoose = {
  standing: MyCategory | null
  choosing: boolean
  refusal: string | null
  choose: (firstSeason: boolean) => Promise<void>
}

export function useMyCategory(): TheCategoryIChoose {
  const [standing, setStanding] = useState<MyCategory | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

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
      }
    }

    if (answered.got === 'refused') {
      setRefusal(answered.reason)
    }

    setChoosing(false)
  }, [])

  return { standing, choosing, refusal, choose }
}
