import { useCallback, useRef, useState } from 'react'
import { whoTheServerSaysIAm } from '../../session/theServer'
import { useSession } from '../../session/useSession'
import type { Answer } from '../account/askTheServer'
import { letInBy, theServerWasAskedToLetMeIn } from './fromTheBalance'

/**
 * What the last press came to.
 *
 * <p>`in` names the season the SERVER let him in for, off its answer and never off the screen's clock
 * (PDL, 25.10.2026: „Rečenica posle uspeha imenuje sezonu koju je server stvarno aktivirao"): a press a
 * second after midnight on 15 October buys the season the server sells at that second, whatever the
 * panel was drawn for. `unread` is an answer that said it was done and could not be read, which is said
 * by the state the page then draws and by no sentence of its own. `newNumber` is the number he was given,
 * only where he had none before the press (owner, 25.10.2026: „Tvoj članski broj je {broj}." „kad je
 * broj tek dodeljen").
 */
export type LettingIn =
  | { got: 'in'; season: number; newNumber: string | null }
  | { got: 'unread' }
  | { got: 'not'; answer: Exclude<Answer, { got: 'done' }> }

/**
 * THE BUTTON THAT LETS HIM IN ON HIS BALANCE, AND WHAT STANDS AFTER IT.
 *
 * <p><b>The shape is `Membership.leaveTheTeam`'s, step for step, and for its reasons</b>: the press is
 * held in a REF, so a second press that arrives before the render the state would cause meets the same
 * answer (the review of PR 411 measured the state alone letting a second request out); it closes in a
 * `finally`; and what stands afterwards is ASKED, not worked out, because the facts this screen draws -
 * the season he holds, its basis, his number and whether he has paid - come off `GET /api/me` through
 * the session, and nothing the route answered writes them.
 *
 * <p><b>ASKED AGAIN AFTER EVERY ANSWER THE SERVER GAVE ABOUT HIM, a refusal included.</b> Each of the
 * three refusals is a fact that changed under the screen: he holds the season after all, he owes nothing
 * for it, or his balance no longer reaches the fee. So the session is asked who he is, and `readAgain`
 * moves, which the screen uses to read what he owes and his balance once more: after the third refusal
 * that is what puts the slip for the rest under the sentence that says it is there. A request that got
 * no answer at all asks nothing again, because nothing is known to have changed.
 */
export function useLetMeIn(): {
  letMeIn: (hadNoNumber: boolean) => Promise<void>
  sending: boolean
  outcome: LettingIn | null
  readAgain: number
} {
  const { theServerSignedMeIn } = useSession()
  const outstanding = useRef(false)
  const [sending, setSending] = useState(false)
  const [outcome, setOutcome] = useState<LettingIn | null>(null)
  const [readAgain, setReadAgain] = useState(0)

  const letMeIn = useCallback(
    async (hadNoNumber: boolean) => {
      if (outstanding.current) {
        return
      }

      outstanding.current = true
      setSending(true)
      setOutcome(null)

      try {
        const answer = await theServerWasAskedToLetMeIn()

        if (answer.got === 'done' || answer.got === 'refused') {
          const who = await whoTheServerSaysIAm()

          if (who !== null) {
            theServerSignedMeIn(who)
          }

          setReadAgain((was) => was + 1)
        }

        if (answer.got !== 'done') {
          setOutcome({ got: 'not', answer })

          return
        }

        const made = letInBy(answer.body)

        setOutcome(
          made === null
            ? { got: 'unread' }
            : { got: 'in', season: made.season, newNumber: hadNoNumber ? made.memberNumber : null },
        )
      } finally {
        outstanding.current = false
        setSending(false)
      }
    },
    [theServerSignedMeIn],
  )

  return { letMeIn, sending, outcome, readAgain }
}
