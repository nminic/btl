import { createContext, useContext, useEffect, useState } from 'react'
import { whatTheServerSaysOfMyHavingWords, whatTheServerSaysOfMyPictures } from '../../session/theServer'

/**
 * HOW MANY TIMES, ON THIS CARD, THE PICTURE OR THE WORDS ABOUT HIMSELF HAVE BEEN SENT, and the way to say
 * one more.
 *
 * <p>The boxes stand at the bottom of the card „Podaci" and the name of the card stands in its head
 * (owner, 06.11.2026, PDL „Boksovi „Profilna slika" i „Tekst o sebi" prelaze sa Podešavanja"): two parts
 * of one screen that do not hold each other. A box that has just been sent says so here, and the head asks
 * the server again, so the name follows what the server now holds rather than what a box believes it sent.
 *
 * <p>The default is a count that never moves, which is every screen that draws the head and no boxes
 * („Rezultati", „Priznanja"): there the head asks the server once, when it is drawn.
 */
/** Where the boxes of the picture and the words stand on the card „Podaci", as the part of an address after `#`. */
export const THE_PICTURE_AND_THE_WORDS = 'slika'

export type BoxesSent ={ times: number; sent: () => void }

export const BoxesSentContext = createContext<BoxesSent>({ times: 0, sent: () => undefined })

/** What a box calls once the server has taken what it sent. */
export function useTellTheHeadABoxWasSent(): () => void {
  return useContext(BoxesSentContext).sent
}

type Heard = { memberNumber: string; finished: boolean }

/**
 * WHETHER HIS PROFILE IS FINISHED: a picture and words about himself, each either standing on the profile
 * or waiting for a moderator. Null while that is not known, and null where the server could not be read.
 *
 * <p>Owner, 06.11.2026: „Želim da mu se dugme Podaci zove Dovrši profil dok ne namesti i sliku i tekst.
 * Bez dodatnih podsetnika". Chosen with the recommendation the same day: „poslato a neodobreno se računa
 * kao namešteno", and „vraćena slika ili tekst vraćaju ime „Dovrši profil"". The third needs no case of its
 * own here: what a moderator hands back stops waiting, so a member whose only picture was handed back has
 * none, and one who had a picture standing before keeps it.
 *
 * <p>Asked of the reader's OWN routes, `GET /api/me/photo` and `GET /api/me`, which is why it is called
 * only where the reader is the member himself (`ProfileParts`). Asked again whenever a box says it has
 * sent something ({@link BoxesSentContext}); while it is asked again the last answer stands, so the name
 * does not blink for the length of a request.
 */
export function useHisProfileIsFinished(memberNumber: string): boolean | null {
  const { times } = useContext(BoxesSentContext)
  const [heard, setHeard] = useState<Heard | null>(null)

  useEffect(() => {
    let stillHere = true

    void Promise.all([whatTheServerSaysOfMyPictures(), whatTheServerSaysOfMyHavingWords()]).then(
      ([pictures, words]) => {
        /* Dropped where the screen has gone or the reader has changed, for the reason every read on this
           side drops it (`member/useHeldRead.ts`); and an answer that could not be read changes nothing,
           so a fault never names the card „Dovrši profil" for a member who has finished it. */
        if (!stillHere || pictures === null || words === null) {
          return
        }

        setHeard({ memberNumber, finished: (pictures.waiting !== null || pictures.standing !== null) && words })
      },
    )

    return () => {
      stillHere = false
    }
  }, [memberNumber, times])

  return heard === null || heard.memberNumber !== memberNumber ? null : heard.finished
}
