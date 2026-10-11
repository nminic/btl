import { useCallback, useEffect, useState } from 'react'
import type { ResourceState } from '../../data/useResource'
import { whatTheServerSaysOfMyData, type MyData } from '../../session/theServer'

/**
 * WHAT THE SERVER HEARD WHEN IT WAS ASKED FOR THE CALLER'S OWN DATA, and for whom.
 *
 * <p>The account is part of what is held, and it is what makes the hook safe to keep mounted
 * across a change of reader: an answer is used only for the account it was asked under. A
 * `data` of `null` is a read that did not give a record the screen can be drawn from - the
 * server could not be reached, or answered nobody, or answered a record the portal cannot
 * believe. The screen says the same thing for all of them, and so does this.
 */
type Heard = { asked: number; data: MyData | null }

/**
 * THE DATA A MEMBER'S OWN SETTINGS SCREEN IS DRAWN FROM WHEN THE PUBLIC LIST DOES NOT CARRY HIM
 * AND HE HAS NO PROFILE: somebody who registered and has not paid.
 *
 * <p>PDL P8, the entry „Šta sme neplaćen član" (10.10.2026, chosen by the owner between offered
 * outcomes; the sentence is the record's): such a person may change „svoje podatke za
 * evidenciju i majicu". The settings screen draws those from a record of the public list
 * (`/api/competitors`), which ends `where c.active` and has no row for him, and from nothing
 * else - so he has to be read off the one answer that has a row for him, which is `GET /api/me`
 * (`session/theServer.ts#whatTheServerSaysOfMyData`). This is `profile/useHisOwnRecord.ts`
 * for a person with no number, and it is built the same way for the same reasons.
 *
 * <p><b>It is a resource in the portal's own sense and not a state of its own</b>, so the screen
 * goes through `components/Resource.tsx` and the three things that must be said are said the way
 * every other read says them: a loading indicator while it is on its way, „Podaci se ne mogu
 * učitati." with „Pokušaj ponovo" when it could not be had, and nothing else. No new words.
 *
 * <p><b>An answer is believed for the account it was asked under and no other.</b> The reader can
 * change inside one visit (a shared laptop at a race is the ordinary case), and the answer that
 * arrives for the first one must not be drawn as the second: it is dropped when it comes back
 * late, and a held answer for another account reads as „not here yet". The server is asked who
 * the cookie names and it is the cookie that decides; the account is only what the answer is held
 * against.
 *
 * <p>The read is dropped, not cached: what is drawn is what the server said a moment ago, and the
 * one screen that uses it does not outlive the visit that asked.
 *
 * @param asked the account of the reader, which is whose data this is
 */
export function useMyData(asked: number): ResourceState<MyData> {
  const [heard, setHeard] = useState<Heard | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [reading, setReading] = useState(false)

  useEffect(() => {
    let stillHere = true

    void whatTheServerSaysOfMyData().then((said) => {
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
  }, [asked, attempt])

  const readAgain = useCallback(() => {
    setReading(true)
    setAttempt((one) => one + 1)
  }, [])

  if (heard === null || heard.asked !== asked) {
    return { status: 'loading' }
  }

  if (heard.data === null) {
    return {
      status: 'error',
      error: new Error('His own data could not be read'),
      readAgain,
      reading,
    }
  }

  return { status: 'ready', data: heard.data }
}
