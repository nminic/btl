import { useState } from 'react'
import { Link } from 'react-router'
import { useFilterParams } from '../../app/useFilterParams'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { FieldHint } from '../../forms/FieldHint'
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
 * its own sentence below. The number in those sentences is a copy of
 * `PasswordPolicy.SHORTEST` and is held to it by a test.
 *
 * **But the rule IS written beside the field, and it is the eighth on the portal**
 * (owner, 20.09.2026). He had read a numbered list of all sixty one such rules on
 * 31.08.2026, kept seven and had the rest deleted, and the password field of the
 * registration form was not among the seven. This field is not that one: whoever
 * arrives here arrives from a link in a message, has no rule in front of him, and finds
 * it out only when the server refuses - by which time the box has been emptied and he
 * types the whole thing again. `forms/fieldHint.test.tsx` counts the eight, and this
 * one is counted with them because `PASSWORD_FIELD` below declares it as a `hintKey`
 * like any other.
 *
 * **What it does refuse to do is send nothing anywhere.** An address with no token on
 * it is not a link somebody was sent, so there is nothing to spend and the form is not
 * drawn: that is a fact about the address, not a second opinion about the token, and
 * the server remains the only thing that judges a token that is really there.
 */

/**
 * The field the rule stands beside, in the shape a form definition gives one.
 *
 * <p>Written out here because this screen builds its two controls by hand rather than
 * from a definition, and because the sentence takes a number: `FormRenderer` draws a
 * rule with `t(field.hintKey)` and interpolates nothing, so a rule that has to name the
 * shortest password there is could not come through it even if this screen had a
 * definition. The number itself comes from `passwordRule.ts`, which is the portal's one
 * copy of `PasswordPolicy.SHORTEST` and is held to it.
 *
 * <p><b>Declared as a `hintKey` and not typed into a `t(…)` call</b>, which is the one
 * thing that matters about the shape: `forms/fieldHint.test.tsx` counts every `hintKey`
 * the portal carries and fails when the count moves without anybody saying so. Three
 * rules outlived the deletion of 31.08.2026 precisely by being written straight into a
 * screen, where nothing counted them. This one is counted.
 *
 * <p>The three ids are the ones `FormRenderer` builds for a field of its own, spelled
 * the same way, so the rule hangs off a `.field__head` and is measured from it - a box
 * as wide as the field, which is what keeps it from opening off the edge of a telephone
 * (`forms/FieldHint.css`).
 */
const PASSWORD_FIELD = {
  id: 'new-password',
  labelId: 'new-password-label',
  hintId: 'new-password-hint',
  hintKey: 'newPassword.passwordHint',
}

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
          {/* AND THE RULE BESIDE IT, WHICH THE OWNER ASKED FOR ON 20.09.2026 as the
              eighth of the seven he kept on 31.08.2026. His reason is the one thing
              this screen has that the registration form has not: whoever is reading it
              came from a link in a message with no rule in front of him, and a password
              box empties itself on every refusal, so finding the rule out from the
              server costs him the whole thing typed again. PDL of 28.07.2026 („Pravila
              jačine stoje uz polje kao infotip") is the older sentence and says the
              same.

              A tooltip and not a paragraph, which is the shape every rule on this
              portal has had since 11.08.2026 („Svuda ćemo koristiti tooltip"), and it
              is read out with the field whether or not it is on screen: the control
              names it in `aria-describedby` (forms/FieldHint.tsx).

              The number in it is the one `PasswordPolicy.SHORTEST` keeps, through the
              one copy of it this portal has (`passwordRule.ts`), and not a second
              number written beside a field.

              The server's own refusal is still what a reader gets when it refuses, in
              words and with the number in them; the two answer different moments. */}
          <span className="field__head">
            <AskedLabel id={PASSWORD_FIELD.id}>
              {/* Named by a box of its own so the letter beside it can say which field
                  it explains without taking that field its name, exactly as
                  `FormRenderer` puts `labelId` on the label it draws. */}
              <span id={PASSWORD_FIELD.labelId}>{t('newPassword.password')}</span>
            </AskedLabel>
            <FieldHint
              id={PASSWORD_FIELD.hintId}
              text={t(PASSWORD_FIELD.hintKey, { count: SHORTEST_PASSWORD })}
              of={PASSWORD_FIELD.labelId}
            />
          </span>
          <input
            id={PASSWORD_FIELD.id}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-required="true"
            aria-describedby={PASSWORD_FIELD.hintId}
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
