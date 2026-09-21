import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { ServerSaid } from '../account/ServerSaid'
import type { Answer } from '../account/askTheServer'
import { useRole } from '../../roles/useRole'
import { signInWith, whoTheServerSaysIAm } from '../../session/theServer'
import { useSession } from '../../session/useSession'
import './Member.css'

/**
 * SIGNING IN, WHICH SINCE 20.09.2026 IS A CONVERSATION WITH THE SERVER RATHER THAN A
 * QUESTION TO THE READER.
 *
 * <p>It was a `select` of members until that day, and the note above it said so: „Do
 * tada biraš ko si i portal ti veruje na reč." Both are gone, and this paragraph is
 * here instead of that sentence because a note claiming a prototype that no longer
 * exists is an instruction to the next reader to put it back.
 *
 * <p><b>THE ROLE IS NOT SOMETHING THE READER PICKS AND NOT SOMETHING THIS FORM
 * DECIDES.</b> The form sends an address and a password; the server answers 204 and an
 * empty body; the role comes from `GET /api/me` afterwards and from nowhere else. That
 * order is the whole of the increment: a role taken off this screen would be a role the
 * person at the keyboard chose, and the administration is behind it.
 *
 * <p><b>Every refusal is one refusal, and that is the server's decision rather than
 * this screen's caution.</b> `SignIn` (backend) answers the same bare 401 to an address
 * nobody has, a wrong password, an account with no password, an address nobody has
 * confirmed and an account that is shut, and says why in its own words: told apart,
 * this form becomes a way of asking the portal who its members are. So there is nothing
 * in the answer to tell apart, and the one sentence below names both of the things it
 * can be. It carries no number of tries and no length of lock: those are
 * `SignIn.ENOUGH_MISSES_TO_LOCK` and `SignIn.LOCKED_FOR` on the server, and a copy of
 * them on a screen is a second home for a fact the server owns.
 *
 * <p><b>What this does NOT do, and it is written down rather than left to be
 * noticed.</b> There is no way to a forgotten password from here: PDL records that the
 * road exists („link na mejl, pa unos nove lozinke") and `NewPassword` is the far end
 * of it, but the screen that asks for the message to be sent is not built, so a link to
 * it would point at nothing.
 *
 * <p><b>Nothing here writes what it is given anywhere but into the body of one
 * request</b> - not to the console, not into an address, not into storage, and not into
 * anything it draws. `signIn.test.tsx` holds that by sweeping, the same way
 * `newPassword.test.tsx` does for the other screen that carries a password.
 */
export function SignIn() {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const { theServerSignedMeIn } = useSession()
  const { become } = useRole()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [asking, setAsking] = useState(false)
  /**
   * What stands between the reader and the portal, or null while nothing does.
   *
   * One state and not two, because the two would have to agree: „the server refused"
   * and „the server let me in and will not say who I am" are different sentences about
   * the same moment, and held apart they can both be on screen at once. `done` is not
   * one of them - a sign in that went through leaves this screen.
   */
  const [trouble, setTrouble] = useState<Exclude<Answer, { got: 'done' }> | 'noWho' | null>(null)
  /** Nothing typed yet: the button, the reason beside it and the refusal on submit
   *  all have to agree about it, so it is worked out once. Both fields, because the
   *  server refuses a blank one of either (`@NotBlank`) and being told so by a round
   *  trip is being told so late. */
  const nothingTyped = email === '' || password === ''

  async function send(): Promise<void> {
    setAsking(true)

    const said = await signInWith(email, password)

    if (said.got !== 'done') {
      setTrouble(said)
      setAsking(false)
      return
    }

    /* THE SECOND HALF, AND IT IS NOT OPTIONAL. 204 says the cookie is set and says
       nothing about who it belongs to. Everything the portal then draws - the
       navigation, the administration, what a moderator may open - hangs off the role,
       and this is the only place it comes from. */
    const who = await whoTheServerSaysIAm()

    if (who === null) {
      /* Signed in on the server and unknown to the portal. Said out loud rather than
         guessed at with a role: a guess here is a guess about what somebody may do.
         Its own sentence rather than one of `ServerSaid`'s four, because all four of
         those say „ništa nije promenjeno" in one way or another and here something
         did: the session is open and the cookie is in the browser. */
      setTrouble('noWho')
      setAsking(false)
      return
    }

    become(who.role)
    theServerSignedMeIn(who.account)
    navigate(`/${locale}/moj-profil`)
  }

  return (
    <div className="member">
      <h1>{t('signIn.title')}</h1>

      <form
        className="member__form"
        onSubmit={(event) => {
          event.preventDefault()

          /* Nothing typed is nothing to send. Left to an attribute alone, pressing
             this sent two empty strings and spent a round trip on a refusal the screen
             could see coming. */
          if (nothingTyped || asking) {
            return
          }

          void send()
        }}
      >
        {/* The rule every field on the portal keeps since 12.08.2026, this one
            included: a star, `aria-required`, and one line saying what the star means
            (forms/AskedLabel.tsx). */}
        <RequiredNote />

        <div className="rankings__field">
          <AskedLabel id="sign-in-email">{t('signIn.email')}</AskedLabel>
          <input
            id="sign-in-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-required="true"
          />
        </div>

        <div className="rankings__field">
          <AskedLabel id="sign-in-password">{t('signIn.password')}</AskedLabel>
          {/* No rule beside this one, and that is deliberate. The owner kept seven
              such rules on 31.08.2026 and added an eighth on 20.09.2026, beside the
              field where a NEW password is chosen; this field takes one that already
              exists, where a rule about length is advice to somebody who has nothing
              left to change. */}
          <input
            id="sign-in-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-required="true"
          />
        </div>

        {/* Told off, not switched off, as everywhere else on the portal
            (RateEvent.tsx, PendingQueue.tsx, Pager.tsx, GoingToEvent.tsx):
            `disabled` takes the button out of the tab order and takes the
            reason with it. */}
        <button
          type="submit"
          className="button button--primary"
          aria-disabled={nothingTyped || asking}
          aria-describedby={nothingTyped ? 'sign-in-waits' : undefined}
        >
          {asking ? t('signIn.sending') : t('signIn.submit')}
        </button>

        {nothingTyped && (
          <p id="sign-in-waits" className="rate__hint" role="status">
            {t('signIn.needsBoth')}
          </p>
        )}
      </form>

      {trouble === 'noWho' && (
        <p className="field__error" role="alert">
          {t('signIn.noWho')}
        </p>
      )}

      {trouble !== null &&
        trouble !== 'noWho' &&
        (trouble.got === 'wrong' && trouble.status === 401 ? (
          <p className="field__error" role="alert">
            {t('signIn.refused')}
          </p>
        ) : (
          /* Everything else is the server saying something this screen has no better
             word for, and `ServerSaid` already has the four sentences. The map of named
             refusals is empty because `SignInApi` names none: it declares no reason
             constant at all, which is what `refusals.test.ts` reads the other two
             routes' by. */
          <ServerSaid answer={trouble} refusals={{}} />
        ))}
    </div>
  )
}
