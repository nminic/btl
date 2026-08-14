import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Resource } from '../../components/Resource'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useCompetitors } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import './Member.css'

/* A stand-in for signing in, and it says so.
 *
 * Real authentication is backend work: a password, a session cookie, and two
 * factors for the superadmin. None of that can be judged by looking at it, and
 * all of it would block every member screen behind a login that does not exist
 * yet. So the prototype asks which member you are and takes your word for it.
 */
export function SignIn() {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const { signIn } = useSession()
  const { become } = useRole()
  const [chosen, setChosen] = useState('')
  /** Nobody picked yet: the button, the reason beside it and the refusal on
   *  submit all have to agree about it, so it is worked out once. */
  const nobody = chosen === ''
  const state = useCompetitors()

  return (
    <div className="member">
      <h1>{t('signIn.title')}</h1>
      <p className="member__note">{t('signIn.prototypeNote')}</p>

      <Resource state={state}>
        {(competitors) => (
          <form
            className="member__form"
            onSubmit={(event) => {
              event.preventDefault()

              /* Nobody chosen is nobody to sign in as. Left to an attribute
                 alone, pressing this signed the session in as the empty string
                 and walked to a profile headed „Ovog profila nema.", and no test
                 in the suite fell over when the attribute was deleted, because
                 an expression in JSX is not a branch anything counts. */
              if (nobody) {
                return
              }

              signIn(chosen)
              become('competitor')
              navigate(`/${locale}/moj-profil`)
            }}
          >
            {/* The rule every field on the portal keeps since 12.08.2026, this
                one included: a star, `aria-required`, and one line saying what
                the star means (forms/AskedLabel.tsx). */}
            <RequiredNote />

            <div className="rankings__field">
              <AskedLabel id="sign-in-who">{t('signIn.whoAreYou')}</AskedLabel>
              <select
                id="sign-in-who"
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
                aria-required="true"
              >
                <option value="">{t('form.choose')}</option>
                {competitors.map((one) => (
                  <option key={one.memberNumber} value={one.memberNumber}>
                    {one.firstName} {one.lastName} ({one.memberNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Told off, not switched off, as everywhere else on the portal
                (RateEvent.tsx, PendingQueue.tsx, Pager.tsx, GoingToEvent.tsx):
                `disabled` takes the button out of the tab order and takes the
                reason with it. */}
            <button
              type="submit"
              className="button button--primary"
              aria-disabled={nobody}
              aria-describedby={nobody ? 'sign-in-waits' : undefined}
            >
              {t('signIn.submit')}
            </button>

            {nobody && (
              <p id="sign-in-waits" className="rate__hint" role="status">
                {t('signIn.needsSomebody')}
              </p>
            )}
          </form>
        )}
      </Resource>
    </div>
  )
}
