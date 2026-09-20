import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useFilterParams } from '../../app/useFilterParams'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from './askTheServer'
import { WHEN_CONFIRMING_AN_ADDRESS } from './refusals'
import { ServerSaid } from './ServerSaid'
import '../member/Member.css'

/**
 * WHERE THE OTHER LINK OUT OF A MESSAGE IS SPENT: THE ONE THAT ONLY SAYS THE ADDRESS
 * IS REALLY YOURS.
 *
 * <p>PDL, owner, 31.07.2026: „Potvrda adrese elektronske pošte je prva, i uslov za sve
 * ostalo." Registration writes the account and leaves the column empty on purpose;
 * this is the screen at the other end of the link that fills it in.
 *
 * <p><b>WHY THIS IS A SECOND SCREEN AND NOT THE SAME ONE, MEASURED RATHER THAN
 * ASSUMED.</b> Three things in the server say so, and any one of them alone would:
 *
 * <ul>
 * <li><b>The server writes the address of the screen, and it writes two.</b>
 * `WhatTheMessageSays.Message` gives `CONFIRM_THE_ADDRESS` the path `/potvrda-adrese`
 * and `SET_A_NEW_PASSWORD` the path `/nova-lozinka`. Those are not ours to merge:
 * every message already posted carries one of them.
 * <li><b>The two links are drawn from different tables</b>, `email_verification_token`
 * and `password_reset_token`, and each route looks its own token up in its own. A
 * screen that guessed would send half its readers' tokens to a route that has never
 * heard of them and tell them their link was no good.
 * <li><b>They ask for different things.</b> `/api/email-confirmation` takes a token and
 * nothing else; there is no password to type here, and a form asking for one would be
 * asking for something the route would throw away.
 * </ul>
 *
 * <p><b>What the two DO share is one line, and it runs the other way.</b> Spending a
 * password link on an account that never had a password confirms its address in the
 * same statement (`PasswordResetApi`, owner's decision of 19.09.2026). So an invited
 * moderator never needs this screen - he is confirmed by setting his password - and
 * this screen exists for the reader who registered, which is the road that mints the
 * other token.
 *
 * <p><b>Nothing is typed here, so nothing is pressed.</b> The reader has already done
 * the only thing this screen needs by opening the link, and a button saying "yes,
 * really" would be the portal asking him to confirm his confirmation.
 */

export function ConfirmAddress() {
  const { locale, t } = useI18n()
  const [params] = useFilterParams()
  const token = params.get('token') ?? ''
  const [answer, setAnswer] = useState<Answer | null>(null)
  /**
   * That the link has been spent already, which is not the same question as whether
   * an answer has come back.
   *
   * React runs an effect twice under `StrictMode`, which `main.tsx` puts the whole
   * portal in, and the state above is still empty when the second run starts. Without
   * this the portal asks the server twice for every reader. It is harmless at the far
   * end - a second confirmation of an address already confirmed is answered 204 by
   * `EmailConfirmation.decide` - and it is still two requests where the reader made
   * one, and the habit is the thing: the route beside this one spends a link.
   */
  const spent = useRef(false)

  useEffect(() => {
    if (token === '' || spent.current) {
      return
    }

    spent.current = true

    void askTheServer('/api/email-confirmation', { token }).then(setAnswer)
  }, [token])

  const refusal = answer !== null && answer.got !== 'done' ? answer : null

  if (token === '') {
    return (
      <div className="member">
        <h1>{t('confirmAddress.title')}</h1>
        <p className="member__note">{t('confirmAddress.noToken')}</p>
      </div>
    )
  }

  if (answer !== null && answer.got === 'done') {
    return (
      <div className="member">
        <h1>{t('confirmAddress.title')}</h1>
        <p className="member__note" role="status">
          {t('confirmAddress.done')}
        </p>
        <p>
          <Link to={`/${locale}/prijava`}>{t('server.signIn')}</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="member">
      <h1>{t('confirmAddress.title')}</h1>
      {refusal === null ? (
        <p className="member__note" role="status">
          {t('confirmAddress.working')}
        </p>
      ) : (
        <ServerSaid answer={refusal} refusals={WHEN_CONFIRMING_AN_ADDRESS} />
      )}
    </div>
  )
}
