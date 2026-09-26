import { useEffect, useRef, useState } from 'react'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { SHORTEST_PASSWORD } from '../account/passwordRule'
import { ServerSaid } from '../account/ServerSaid'
import { WHEN_CHANGING_MY_PASSWORD } from './myAccount'

/**
 * CHANGING A PASSWORD FROM INSIDE, WHICH IS A DIFFERENT ERRAND FROM SETTING ONE FROM A LINK.
 *
 * <p>PDL P28b, 5, owner 24.09.2026: „Promena lozinke dok je clan prijavljen trazi staru
 * lozinku i odjavljuje sve ostale sesije. Razlog: ako se lozinka menja zbog sumnje da je
 * neko zna, promena bez odjave ne resava nista."
 *
 * <p><b>Both halves of that sentence are a thing on this screen, and the second one is told
 * BEFORE the button rather than after it.</b> That is the owner's own emphasis - „to se kaze
 * coveku pre nego sto potvrdi, ne posle" - and it is the whole reason the warning is a
 * paragraph the submit button names in {@code aria-describedby} rather than a line in the
 * confirmation. Somebody signed in on a telephone he is about to be signed out of should
 * find that out while he can still decide, and a reader who cannot see the screen should
 * meet it as part of the button rather than as a paragraph he may have walked past.
 *
 * <p><b>NOTHING HERE JUDGES THE PASSWORD</b>, which is the division `NewPassword.tsx` keeps
 * and gives its reasons for at length: the rule is {@code PasswordPolicy}'s, the answer comes
 * back named, and each of the three names has its own sentence. The one number this portal
 * has for the length (`pages/account/passwordRule.ts`, held to the server) goes into the
 * refusal that is about length, so a reader who meets it is told how long rather than told to
 * guess again.
 *
 * <p><b>There is no rule written beside the field here, and that is a decision not to make
 * one.</b> The owner read all sixty one such rules on 31.08.2026, kept seven, and added the
 * eighth to the password on the link screen on 20.09.2026 with a reason that was about THAT
 * screen: whoever arrives there came out of a message with nothing in front of him. Whether
 * this screen is the ninth is his to say, and `forms/fieldHint.test.tsx` counts them
 * precisely so that nobody adds one quietly.
 *
 * <p><b>Nothing typed here is written anywhere but into the body of one request</b>, which
 * is the rule `askTheServer` states and `newPassword.test.tsx` holds by sweeping every place
 * a value could land. The three controls are the only copy the browser has of any of them,
 * and a save unmounts all three.
 */
export function ChangePassword() {
  const { t } = useI18n()
  const [old, setOld] = useState('')
  const [fresh, setFresh] = useState('')
  const [repeated, setRepeated] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  const done = answer !== null && answer.got === 'done'
  const refusal = answer !== null && answer.got !== 'done' ? answer : null
  /* Nothing to send while any of the three is empty. The server says the same thing and is
     still what decides; this only keeps a member from spending a request on a form he can
     see is not filled in. Whether the two new ones AGREE is deliberately not asked here:
     that is the server's question, and a screen that answered it would have to hold a second
     copy of what „the same" means. */
  const nothing = old === '' || fresh === '' || repeated === ''

  /* Said out loud, because the form is replaced by a sentence somewhere else on the screen
     (WCAG 2.2 SC 4.1.3, and the order of focus in 2.4.3). */
  useEffect(() => {
    if (done) {
      said.current?.focus()
    }
  }, [done])

  async function send(): Promise<void> {
    setAsking(true)

    /* All three travel as they were typed. The repeat is NOT the new one sent twice: whether
       they agree is the server's question, and a screen that sent one value twice would make
       every mismatch a success. */
    setAnswer(
      await askTheServer(
        '/api/me/password',
        { oldPassword: old, password: fresh, passwordRepeat: repeated },
        'PUT',
      ),
    )
    setAsking(false)
  }

  if (done) {
    /* The form is gone with this, and so is everything typed into it: React unmounts the
       three controls, which is the only copy of any of them the browser held. */
    return (
      <section className="member__panel" aria-labelledby="account-password">
        <h2 className="profile__section" id="account-password">
          {t('account.passwordTitle')}
        </h2>
        <p className="member__note" ref={said} tabIndex={-1} role="status">
          {t('account.passwordDone')}
        </p>
      </section>
    )
  }

  return (
    <section className="member__panel" aria-labelledby="account-password">
      <h2 className="profile__section" id="account-password">
        {t('account.passwordTitle')}
      </h2>

      <RequiredNote />

      <form
        className="member__form"
        onSubmit={(event) => {
          event.preventDefault()

          if (!asking && !nothing) {
            void send()
          }
        }}
      >
        <div className="rankings__field">
          <AskedLabel id="account-old-password">{t('account.oldPassword')}</AskedLabel>
          <input
            id="account-old-password"
            type="password"
            autoComplete="current-password"
            value={old}
            aria-required="true"
            onChange={(event) => {
              setAnswer(null)
              setOld(event.target.value)
            }}
          />
        </div>

        <div className="rankings__field">
          <AskedLabel id="account-new-password">{t('account.newPassword')}</AskedLabel>
          <input
            id="account-new-password"
            type="password"
            autoComplete="new-password"
            value={fresh}
            aria-required="true"
            onChange={(event) => {
              setAnswer(null)
              setFresh(event.target.value)
            }}
          />
        </div>

        <div className="rankings__field">
          <AskedLabel id="account-repeat-password">{t('account.repeatPassword')}</AskedLabel>
          <input
            id="account-repeat-password"
            type="password"
            autoComplete="new-password"
            value={repeated}
            aria-required="true"
            onChange={(event) => {
              setAnswer(null)
              setRepeated(event.target.value)
            }}
          />
        </div>

        {/* BEFORE THE BUTTON, AND NAMED BY IT. The owner asked for exactly this order on
            24.09.2026. Standing after the button it would be a thing a reader meets once the
            decision is made, and a reader using a screen reader would meet it only by going
            looking for it. */}
        <p className="member__note" id="account-password-warning">
          {t('account.passwordSignsOthersOut')}
        </p>

        <p className="member__actions">
          <button
            type="submit"
            className="button button--primary"
            aria-disabled={nothing || asking}
            aria-describedby={
              nothing
                ? 'account-password-warning account-password-waits'
                : 'account-password-warning'
            }
          >
            {t('account.passwordSubmit')}
          </button>
        </p>

        {nothing && (
          <p id="account-password-waits" className="rate__hint" role="status">
            {t('account.passwordFillFirst')}
          </p>
        )}
      </form>

      {refusal !== null && (
        <ServerSaid
          answer={refusal}
          refusals={WHEN_CHANGING_MY_PASSWORD}
          params={{ count: SHORTEST_PASSWORD }}
        />
      )}
    </section>
  )
}
