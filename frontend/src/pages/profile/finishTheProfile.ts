import { createContext, useContext, useEffect, useState } from 'react'
import { whatTheServerSaysOfMyHavingWords, whatTheServerSaysOfMyPictures } from '../../session/theServer'

/**
 * HOW MANY TIMES, IN THIS VISIT, THE PICTURE OR THE WORDS ABOUT HIMSELF HAVE BEEN SENT, and the way to say
 * one more.
 *
 * <p>The boxes stand on „Moji podaci" and the name of the entry that leads there stands in the menu behind
 * the account picture (owner, 07.11.2026, PDL „Član svojim podacima pristupa iz glavnog menija”): two parts
 * of the portal that do not hold each other. A box that has just been sent says so here, and the menu asks
 * the server again, so the name follows what the server now holds rather than what a box believes it sent.
 * The count is held by the shell (`app/Shell.tsx`), which draws both.
 *
 * <p>The default is a count that never moves, which is a box drawn where no shell is around it.
 */
/** Where the boxes of the picture and the words stand on a page, as the part of an address after `#`. */
export const THE_PICTURE_AND_THE_WORDS = 'slika'

export type BoxesSent ={ times: number; sent: () => void }

export const BoxesSentContext = createContext<BoxesSent>({ times: 0, sent: () => undefined })

/** What a box calls once the server has taken what it sent. */
export function useTellTheHeadABoxWasSent(): () => void {
  return useContext(BoxesSentContext).sent
}

/**
 * WHETHER HIS PROFILE IS FINISHED: a picture and words about himself, each either standing on the profile
 * or waiting for a moderator. Null while that is not known, and null where the server could not be read.
 *
 * <p>Owner, 07.11.2026: „Stavka menija se zove „Dopuni podatke” (vlasnikove reči) dok član nema i sliku i
 * tekst o sebi, a posle toga „Moji podaci”; poslato a neodobreno se računa kao namešteno, kao do sada."
 * And from 06.11.2026, which the decision of 07.11.2026 keeps: „vraćena slika ili tekst vraćaju ime".
 * The third needs no case of its own here: what a moderator hands back stops waiting, so a member whose
 * only picture was handed back has none, and one who had a picture standing before keeps it.
 *
 * <p>Asked of the reader's OWN routes, `GET /api/me/photo` and `GET /api/me`, which is why it is called
 * only where the reader is a member whose fee stands (`app/AccountMenu.tsx`). `again` is how many times the
 * menu has been opened, and NOTHING IS ASKED WHILE IT IS NOUGHT: the menu is drawn on every screen, and a
 * member who never opens it costs the server no request for a name nobody reads. From the first opening on
 * it is asked each time the menu is opened, so a picture a moderator handed back in the meantime gives the
 * name back, and whenever a box says it has sent something ({@link BoxesSentContext}). While it is asked
 * again the last answer stands, so the name does not blink for the length of a request. The price, known:
 * at the first opening of a visit the entry reads „Moji podaci" until the answer arrives, a fraction of a
 * second, and only then „Dopuni podatke" where his profile lacks something.
 *
 * <p>One member's: the caller keys it by his number, so a reader who changes in one visit starts from
 * nothing rather than from the last man's answer.
 */
export function useHisProfileIsFinished(memberNumber: string, again: number): boolean | null {
  const { times } = useContext(BoxesSentContext)
  const [finished, setFinished] = useState<boolean | null>(null)

  useEffect(() => {
    if (again === 0) {
      return undefined
    }

    let stillHere = true

    void Promise.all([whatTheServerSaysOfMyPictures(), whatTheServerSaysOfMyHavingWords()]).then(
      ([pictures, words]) => {
        /* Dropped where the menu has gone, for the reason every read on this side drops it
           (`member/useHeldRead.ts`); and an answer that could not be read changes nothing, so a fault never
           names the entry „Dopuni podatke" for a member who has finished his profile. */
        if (stillHere && pictures !== null && words !== null) {
          setFinished((pictures.waiting !== null || pictures.standing !== null) && words)
        }
      },
    )

    return () => {
      stillHere = false
    }
  }, [memberNumber, times, again])

  return finished
}
