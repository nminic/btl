import { useState } from 'react'
import { Link } from 'react-router'
import { useFilterParams } from '../../app/useFilterParams'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from './askTheServer'
import { SHORTEST_PASSWORD } from './passwordRule'
import { WHEN_SETTING_A_PASSWORD } from './refusals'
import { ServerSaid } from './ServerSaid'
import '../member/Member.css'

/**
 * WHERE A LINK OUT OF A MESSAGE IS SPENT ON A NEW PASSWORD.
 *
 * <p>PDL, owner: „Zaboravljena lozinka ide standardnim postupkom: link na mejl, pa
 * unos nove lozinke i ponavljanje u novom prozoru. Prijava bez lozinke se ne uvodi."
 * This is that window, and the two fields are that sentence.
 *
 * **The address is not ours to choose.** `WhatTheMessageSays.Message` builds the link
 * the server posts, and it writes `/nova-lozinka?token=…` - for a forgotten password
 * and, since 18.09.2026, for a moderator's invitation, which is the same road with
 * another occasion behind it (owner, PDL P28a). The mail carries no language in the
 * address; `LocaleLayout` sends anything that is not a language on to `/sr` with the
 * query intact, which is how `/nova-lozinka?token=…` arrives here at all.
 *
 * **Three of these screens are the same screen, and the portal must not say which.**
 * A forgotten password, an honorary member's account that never had one (V18), and an
 * invited moderator all land here holding the same kind of link. Nothing here asks
 * which, because the server does not tell it and a guess would be wrong for two
 * readers out of three.
 *
 * **NOTHING JUDGES THE PASSWORD HERE**, and `passwordRule.ts` says at length why: the
 * rule is the server's, the answer comes back named, and each of its three names has
 * its own sentence below. The number in one of those sentences is a copy of
 * `PasswordPolicy.SHORTEST` and is held to it by a test.
 *
 * **What it does refuse to do is send nothing anywhere.** An address with no token on
 * it is not a link somebody was sent, so there is nothing to spend and the form is not
 * drawn: that is a fact about the address, not a second opinion about the token, and
 * the server remains the only thing that judges a token that is really there.
 */

export function NewPassword() {
  const { locale, t } = useI18n()
  /* Through `useFilterParams`, which is the only door to the address bar on this
     portal (`app/filterParams.test.ts` refuses `useSearchParams` anywhere else), and
     the same way `Registration.tsx` reads the referral code it is opened with. */
  const [params] = useFilterParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)

  /* Worked out before the two returns below rather than beside the sentence it
     draws, so the one thing the screen has to say about the answer is decided once:
     everything that is not "done" is something the reader is owed a sentence about. */
  const refusal = answer !== null && answer.got !== 'done' ? answer : null

  async function send(): Promise<void> {
    setAsking(true)
    /* Both fields travel as they were typed. The second is NOT the first sent twice:
       whether they agree is the server's question, and a screen that answered it by
       sending one value twice would make every mismatch a success. */
    setAnswer(
      await askTheServer('/api/password-reset', {
        token,
        password,
        passwordRepeat: repeated,
      }),
    )
    setAsking(false)
  }

  const wayToSignIn = (
    <p>
      <Link to={`/${locale}/prijava`}>{t('server.signIn')}</Link>
    </p>
  )

  if (token === '') {
    return (
      <div className="member">
        <h1>{t('newPassword.title')}</h1>
        <p className="member__note">{t('newPassword.noToken')}</p>
        {wayToSignIn}
      </div>
    )
  }

  if (answer !== null && answer.got === 'done') {
    /* The form is gone with this, and so is everything typed into it: React unmounts
       the two controls, which is the only copy of the password the browser held. */
    return (
      <div className="member">
        <h1>{t('newPassword.title')}</h1>
        <p className="member__note" role="status">
          {t('newPassword.done')}
        </p>
        {wayToSignIn}
      </div>
    )
  }

  return (
    <div className="member">
      <h1>{t('newPassword.title')}</h1>
      <p className="member__note">{t('newPassword.intro')}</p>

      <form
        className="member__form"
        onSubmit={(event) => {
          event.preventDefault()

          /* A second press while the first is still out would spend the link twice,
             and the second answer would tell this reader his own link is no good. */
          if (!asking) {
            void send()
          }
        }}
      >
        {/* The rule every field on the portal keeps since 12.08.2026: a star, one
            line saying what the star means, and `aria-required` on the control
            itself (forms/AskedLabel.tsx). */}
        <RequiredNote />

        <div className="rankings__field">
          <AskedLabel id="new-password">{t('newPassword.password')}</AskedLabel>
          {/* AND NOTHING BESIDE IT SAYING HOW LONG A PASSWORD HAS TO BE, which is a
              decision of the owner's and not an omission. On 31.08.2026 he read a
              numbered list of all sixty one rules the portal wrote beside its fields,
              named seven to keep and said „sve ostalo treba obrisati"; the password
              field of the registration form is one of the fifty four, and carries no
              `hintKey` to this day. PDL of 28.07.2026 („Pravila jačine stoje uz polje
              kao infotip") is the older sentence and that decision is the newer one.
              `forms/fieldHint.test.tsx` is what holds it, and an eighth rule is his to
              ask for rather than ours to add while writing a screen.

              What the reader gets instead is the server's own refusal, in words and
              with the number in them, the moment it refuses - which is the half
              `PasswordReset.decide` says out loud on purpose. */}
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-required="true"
          />
        </div>

        <div className="rankings__field">
          <AskedLabel id="new-password-repeat">{t('newPassword.passwordRepeat')}</AskedLabel>
          <input
            id="new-password-repeat"
            type="password"
            autoComplete="new-password"
            value={repeated}
            onChange={(event) => setRepeated(event.target.value)}
            aria-required="true"
          />
        </div>

        {/* Told off, not switched off, as everywhere else on the portal: `disabled`
            takes the button out of the tab order and takes the reason with it. */}
        <button type="submit" className="button button--primary" aria-disabled={asking}>
          {asking ? t('newPassword.sending') : t('newPassword.submit')}
        </button>
      </form>

      {refusal !== null && (
        <ServerSaid
          answer={refusal}
          refusals={WHEN_SETTING_A_PASSWORD}
          params={{ count: SHORTEST_PASSWORD }}
        />
      )}
    </div>
  )
}
