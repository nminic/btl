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

            <button type="submit" className="button button--primary" disabled={chosen === ''}>
              {t('signIn.submit')}
            </button>
          </form>
        )}
      </Resource>
    </div>
  )
}
