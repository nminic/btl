import { useState } from 'react'
import { Link } from 'react-router'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from './askTheServer'
import { ServerSaid } from './ServerSaid'
import '../member/Member.css'

/**
 * WHERE SOMEBODY WHO CANNOT GET IN ASKS FOR THE MESSAGE THAT LETS HIM.
 *
 * <p>PDL, owner: „Zaboravljena lozinka ide standardnim postupkom: link na mejl, pa
 * unos nove lozinke i ponavljanje u novom prozoru." `NewPassword` has been the second
 * half of that sentence since it was written; this is the first, and until today there
 * was none - `POST /api/password-reset/request` stood on the server with nothing in
 * `frontend/src` calling it, so the only way to the far end was a link out of a message
 * nobody could ask for.
 *
 * <p><b>THE PORTAL HAD ALREADY PROMISED THIS SCREEN BY NAME, IN MESSAGES IT HAD
 * POSTED.</b> `backend/src/main/resources/mail/sr.properties` ends the invitation of a
 * member who has no password yet with „Ako veza istekne, zatražite novu sa strane za
 * prijavu, na „Zaboravljena lozinka"", and two sentences on screen say the same -
 * `newPassword.linkIsNotValid` and `confirmAddress.linkIsNotValid` both read „Zatraži
 * novu sa strane za prijavu." So the entry point is not a choice made here: it is on
 * the sign in page and it is called what the message says it is called.
 * `forgottenPassword.test.tsx` reads that name out of the properties file rather than
 * repeating it, because the two halves are in two repositories' worth of file and a
 * guard that stated the name twice would be holding nothing.
 *
 * <p><b>THE ANSWER NEVER SAYS WHETHER THE ADDRESS BELONGS TO ANYBODY, AND THAT IS THE
 * ROUTE'S OWN DECISION RATHER THAN THIS SCREEN'S CAUTION.</b> `PasswordResetApi` says
 * so in its own words - „REQUESTING A RESET NEVER SAYS WHETHER THE ADDRESS BELONGS TO
 * ANYBODY... no decision of the owner's covers this question either, both are asked of
 * him together" - and it answers 204 whether the address is somebody's or nobody's.
 * There is therefore nothing for this screen to tell apart even if it wanted to, and
 * the sentence it draws says exactly that much: if there was something to do, it is
 * done.
 *
 * <p><b>That is a DIFFERENT answer from registration's, and the difference is written
 * down rather than left to look like an oversight.</b> The owner decided on 08.09.2026
 * that „Registracija na već zauzetu adresu kaže da je zauzeta", weighed against the
 * price he was shown and took - anybody can then test whether an address belongs to a
 * member. `EmailConfirmationApi` is where the portal explains why asking for a link
 * again is not that question: mistyping an address here „loses nothing but a moment,
 * since nothing was ever promised at the address that was actually typed", so absent a
 * decision the route falls back to `SignIn`'s „every no is the same no". A screen that
 * named the two cases apart would be undoing that in the one place the server cannot
 * see, and it could not do it honestly anyway - the server tells it nothing to name.
 *
 * <p><b>The address IS ours to name, unlike the other two in this folder.</b>
 * `WhatTheMessageSays.Message` hangs `/nova-lozinka` and `/potvrda-adrese` on the
 * portal's own address and posts them, so those two are fixed by every message already
 * sent; nothing is ever posted that points here. It is in `UNLISTED_ROUTES` all the
 * same and for the same reason as `prijava`: it is reached from a link on a screen
 * rather than from the navigation.
 *
 * <p><b>Open to whoever opens it, signed in or not.</b> `ApiSecurity` lists
 * `/api/password-reset/request` under `permitAll`, and neither `NewPassword`,
 * `ConfirmAddress` nor `SignIn` carries a guard of its own. A member who is signed in
 * and asks for a link is a member who wants one; the route mints it against the address
 * he typed and never against the session, which is the one thing this screen must not
 * get wrong and the one `forgottenPassword.test.tsx` measures by signing somebody in
 * and typing somebody else's address.
 *
 * <p><b>NOTHING JUDGES THE ADDRESS HERE</b>, the same way `NewPassword` judges no
 * password: what an address may look like is `WhatAnAddressLooksLike` on the server and
 * a second copy of it on a screen would be a second home for a rule that has one. The
 * empty field is refused, and that is a fact about the form rather than an opinion
 * about the address - it is the guard `SignIn` puts on its own two fields, for the
 * reason stated there: pressing with nothing typed spends a round trip on a refusal the
 * screen could see coming.
 */
export function ForgottenPassword() {
  const { locale, t } = useI18n()
  const [email, setEmail] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)

  /** Nothing typed yet, worked out once because the button, the reason beside it and
   *  the submit handler all have to agree about it - the shape `SignIn` uses. */
  const nothingTyped = email === ''

  /* Everything that is not „done" is something the reader is owed a sentence about,
     decided once above the two returns as `NewPassword` decides it. */
  const refusal = answer !== null && answer.got !== 'done' ? answer : null

  async function send(): Promise<void> {
    setAsking(true)
    /* THE ADDRESS AS IT WAS TYPED, and it is the only thing that goes. Not the one on
       the session: a member signed in on one account may be asking for another, and the
       route looks up whatever it is handed. Reading the session here would send a link
       to the wrong mailbox and tell the reader it went to his. */
    setAnswer(await askTheServer('/api/password-reset/request', { email }))
    setAsking(false)
  }

  const wayToSignIn = (
    <p>
      <Link to={`/${locale}/prijava`}>{t('server.signIn')}</Link>
    </p>
  )

  if (answer !== null && answer.got === 'done') {
    /* The form goes with it. There is nothing left to do here and a field still
       standing invites the reader to ask again over a message already on its way. */
    return (
      <div className="member">
        <h1>{t('forgottenPassword.title')}</h1>
        <p className="member__note" role="status">
          {t('forgottenPassword.done')}
        </p>
        {wayToSignIn}
      </div>
    )
  }

  return (
    <div className="member">
      <h1>{t('forgottenPassword.title')}</h1>
      <p className="member__note">{t('forgottenPassword.intro')}</p>

      <form
        className="member__form"
        onSubmit={(event) => {
          event.preventDefault()

          /* A second press while the first is still out would ask for a second link
             and retire nothing, so the reader would get two messages for one press. */
          if (nothingTyped || asking) {
            return
          }

          void send()
        }}
      >
        {/* The rule every field on the portal keeps since 12.08.2026: a star, one line
            saying what the star means, and `aria-required` on the control itself
            (forms/AskedLabel.tsx). */}
        <RequiredNote />

        <div className="rankings__field">
          <AskedLabel id="forgotten-password-email">{t('forgottenPassword.email')}</AskedLabel>
          <input
            id="forgotten-password-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-required="true"
          />
        </div>

        {/* Told off, not switched off, as everywhere else on the portal: `disabled`
            takes the button out of the tab order and takes the reason with it. */}
        <button
          type="submit"
          className="button button--primary"
          aria-disabled={nothingTyped || asking}
          aria-describedby={nothingTyped ? 'forgotten-password-waits' : undefined}
        >
          {asking ? t('forgottenPassword.sending') : t('forgottenPassword.submit')}
        </button>

        {nothingTyped && (
          <p id="forgotten-password-waits" className="rate__hint" role="status">
            {t('forgottenPassword.needsAddress')}
          </p>
        )}
      </form>

      {/* The map of named refusals is empty because this route names none: it answers
          204 and nothing else, and declares no reason constant for `refusals.test.ts`
          to read. The same shape, and for the same reason, as `SignIn`'s own call. */}
      {refusal !== null && <ServerSaid answer={refusal} refusals={{}} />}
    </div>
  )
}
