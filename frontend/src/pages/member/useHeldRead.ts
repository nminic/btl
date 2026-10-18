import { useCallback, useEffect, useState } from 'react'
import type { ResourceState } from '../../data/useResource'

/**
 * WHAT THE SERVER HEARD WHEN IT WAS ASKED FOR SOMETHING OF THE CALLER'S OWN, and for whom.
 *
 * <p>The key is part of what is held, and it is what makes the hook safe to keep mounted across a
 * change of reader: an answer is used only for the reader it was asked under. A `data` of `null`
 * is a read that did not give anything the screen can be drawn from - the server could not be
 * reached, or answered nobody, or answered something the portal cannot believe. The screen says
 * the same thing for all of them, and so does this.
 */
type Heard<T> = { asked: number | string; data: T | null }

/**
 * ONE READ OF SOMETHING THAT IS THE CALLER'S OWN, held for the reader it was asked for.
 *
 * <p>Written once for the two screens that ask the server for a thing of his own on every visit and
 * believe the answer only for the reader it was asked under: his data (`useMyData`) and his pictures
 * (`useMyPictures`). They were one copy until 18.10.2026, when the second arrived, and two copies of
 * "an answer is believed for the reader it was asked for and no other" are two places for that rule to
 * drift. It is a resource in the portal's own sense, so the screen goes through `components/Resource.tsx`
 * and the three things that must be said are said the way every other read says them.
 *
 * <p>The read is dropped, not cached: what is drawn is what the server said a moment ago, and the
 * screen that uses it does not outlive the visit that asked. **That is the point, for the fault of
 * 18.10.2026**: a value the member saved must come back from the server on the next visit, and a
 * cache is the one thing that could hand him the old one.
 *
 * @param read   the reader, which must be the same function on every render
 * @param asked  whose this is: the account of a reader who has no number, and the number of a member
 * @param failed what the error says, for whoever reads the console
 */
export function useHeldRead<T>(
  read: () => Promise<T | null>,
  asked: number | string,
  failed: string,
): ResourceState<T> {
  const [heard, setHeard] = useState<Heard<T> | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [reading, setReading] = useState(false)

  useEffect(() => {
    let stillHere = true

    void read().then((said) => {
      /* Dropped where the screen has gone or the reader has changed, for the reason every read
         on this side drops it (`member/useMyCategory.ts`). */
      if (!stillHere) {
        return
      }

      setHeard({ asked, data: said })
      setReading(false)
    })

    return () => {
      stillHere = false
    }
  }, [read, asked, attempt])

  const readAgain = useCallback(() => {
    setReading(true)
    setAttempt((one) => one + 1)
  }, [])

  if (heard === null || heard.asked !== asked) {
    return { status: 'loading' }
  }

  if (heard.data === null) {
    return { status: 'error', error: new Error(failed), readAgain, reading }
  }

  return { status: 'ready', data: heard.data }
}
