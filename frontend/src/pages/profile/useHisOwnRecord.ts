import { useCallback, useEffect, useState } from 'react'
import type { Competitor } from '../../data/types'
import type { ResourceState } from '../../data/useResource'
import { whatTheServerSaysOfMyProfile } from '../../session/theServer'

/**
 * WHAT THE SERVER HEARD WHEN IT WAS ASKED FOR ONE MEMBER'S OWN RECORD, and for whom.
 *
 * <p>The number is part of what is held, and it is what makes the hook safe to keep mounted
 * across a change of reader: an answer is used only for the number it was asked for. A record
 * `null` is a read that did not give a record the screen can be drawn from - the server could
 * not be reached, or answered nobody, or answered somebody else, or answered a record the portal
 * cannot believe. The screen says the same thing for all four, and so does this.
 */
type Heard = { asked: string; record: Competitor | null }

/**
 * THE RECORD A MEMBER'S OWN PROFILE IS DRAWN FROM, when the public list does not carry him.
 *
 * <p>PDL P8, 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji" - and a member
 * whose fee has lapsed is on no row of `/api/competitors`, so
 * `profile/visible.ts` answers „this one is his" and the screen asks HERE for what it cannot find
 * there. The read is `GET /api/me`, once more, and only when this hook is mounted, which is
 * only for that one reader on that one page (`session/theServer.ts` says why it is read apart
 * from who he is).
 *
 * <p><b>It is a resource in the portal's own sense and not a state of its own</b>, so the screen
 * goes through `components/Resource.tsx` and the three things that must be said are said the way
 * every other read says them: a loading indicator while it is on its way, „Podaci se ne mogu
 * učitati." with „Pokušaj ponovo" when it could not be had, and nothing else. No new words, and no
 * redirect: a member who is told his record could not be read has been told the truth, and one
 * who is sent to the front page has been told nothing. `Resource` carries out the decision that a
 * failed read says so, for every screen that goes through it (see there); that this page is such
 * a screen is my reading of it.
 *
 * <p><b>An answer is believed for the number it was asked for and no other.</b> The reader can
 * change inside one visit (a shared laptop at a race is the ordinary case), and the answer that
 * arrives for the first one must not be drawn as the second: it is dropped when it comes back
 * late, and a held answer for another number reads as „not here yet". The server is asked who the
 * cookie names, and it is the cookie that decides; the number the screen asked for is only what
 * the answer is held against.
 *
 * <p>The read is dropped, not cached: a record that is drawn is one the server said a moment ago,
 * and the one page that uses it does not outlive the visit that asked.
 *
 * @param asked the member number on the page, which is also the reader's own
 */
export function useHisOwnRecord(asked: string): ResourceState<Competitor> {
  const [heard, setHeard] = useState<Heard | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [reading, setReading] = useState(false)

  useEffect(() => {
    let stillHere = true

    void whatTheServerSaysOfMyProfile().then((said) => {
      /* Dropped where the screen has gone or the reader has changed, for the reason every read on
         this side drops it (`member/useMyCategory.ts`). */
      if (!stillHere) {
        return
      }

      setHeard({ asked, record: said !== null && said.memberNumber === asked ? said : null })
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

  if (heard.record === null) {
    return {
      status: 'error',
      error: new Error('His own record could not be read'),
      readAgain,
      reading,
    }
  }

  return { status: 'ready', data: heard.record }
}
