import { useI18n } from '../../i18n/useI18n'
import type { Answer } from '../account/askTheServer'
import { whatABareNumberSays } from '../account/serverWords'

/**
 * WHAT THE SERVER SAID WHEN IT WOULD NOT RECORD THE DECISION.
 *
 * <p><b>Its own module since R1 of the results flows</b>, because two screens draw it: the queue
 * of cards and the table of results (`ReviewQueue.tsx`) speak to the same route, and one of them
 * keeping a copy would be a second home for every sentence below.
 *
 * <p><b>A refusal is drawn WORD FOR WORD as it came back, and never looked up.</b>
 * `VerificationWriteApi` refuses with a Serbian sentence rather than with a code: its
 * `no(HttpStatus, String)` puts the constant into the body, and those constants are „O
 * stavci je već odlučeno.", „Stavku trenutno drži drugi moderator.", „Odluka o ovom redu
 * još nije uvedena." and the rest beside them. There is nothing to map, so nothing is mapped; the
 * reason is the answer (`admin/verificationWrites.ts` says the whole of why, and why
 * `pages/account/ServerSaid.tsx` is neither reused nor touched for it).
 *
 * <p><b>The other three shapes have no words of their own on the wire, so they take the
 * portal's.</b> Those sentences are not copied here: `server.rejected` and `server.nothing` are
 * the same two keys every other screen that speaks to the server draws, and which of
 * `server.wrong` and `server.malformed` a bare number gets is chosen where every other screen
 * has it chosen, `whatABareNumberSays` (`pages/account/serverWords.ts`), so the dictionary stays
 * the one home for the words and that function the one home for the choice. `server.wrong` is
 * what carries 401 and 404 - a moderator who is not signed in any more, and one whose local table
 * of rights says he may decide this queue while the route says the address is not there (ADL A8:
 * „neprijavljen dobija 401, a prijavljen kome pravo nedostaje dobija 404", never 403). And
 * `server.malformed` is a 400 that named no reason: `VerificationWriteApi` has three explicit
 * 400s and each carries a sentence (`THE_FORM_IS_NOT_COMPLETE`, `A_REFUSAL_NEEDS_A_REASON`,
 * `AN_AMENDMENT_GOES_WITH_AN_APPROVED_RUN`), so a bare one came from Spring before the route
 * ran, and what it could not read is what the portal sent.
 *
 * <p>`role="alert"` rather than the `role="status"` of `Refused` beside it on the queue of
 * cards (`PendingQueue.tsx`), and the difference is the difference between the two: that line
 * explains a button before it is pressed and changes while a name is typed, this one answers
 * a press that has already happened. An answer nobody is told about is a moderator watching a card stay where it
 * was with no idea why (WCAG 2.2 SC 4.1.3).
 */
export function WhatTheServerSaid({ answer }: { answer: Exclude<Answer, { got: 'done' }> }) {
  const { t } = useI18n()

  const said = (): string => {
    if (answer.got === 'refused') {
      return answer.reason
    }

    if (answer.got === 'rejected') {
      return t('server.rejected')
    }

    if (answer.got === 'wrong') {
      return t(whatABareNumberSays(answer.status), { status: answer.status })
    }

    return t('server.nothing')
  }

  return (
    <p className="field__error" role="alert">
      {said()}
    </p>
  )
}
