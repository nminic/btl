import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { CompetitorProfile } from '../CompetitorProfile'
import { SignedOut } from './SignedOut'
import './Member.css'

/* The same profile everyone else sees, with the things only its owner can do
 * underneath it. A signed-in member sees no different front page and no
 * different profile; the difference is what sits below (PDL P14). */
export function MyProfile() {
  const { locale, t } = useI18n()
  const { memberNumber, signOut } = useSession()

  if (memberNumber === null) {
    return <SignedOut />
  }

  return (
    <div className="member">
      <CompetitorProfile memberNumber={memberNumber} />

      <section className="member__panel" aria-labelledby="my-actions">
        <h2 className="profile__section" id="my-actions">
          {t('myProfile.actions')}
        </h2>
        <div className="member__links">
          <Link className="button button--secondary" to={`/${locale}/moji-rezultati`}>
            {t('nav.myResults')}
          </Link>
          <Link className="button button--secondary" to={`/${locale}/moja-clanarina`}>
            {t('nav.membership')}
          </Link>
          <Link className="button button--secondary" to={`/${locale}/poruke`}>
            {t('nav.messages')}
          </Link>
          {/* Notifications and the theme moved to their own screen behind the
              cog in the header (PDL P28a). */}
          <Link className="button button--secondary" to={`/${locale}/podesavanja`}>
            {t('nav.settings')}
          </Link>
          <button type="button" className="button button--secondary" onClick={signOut}>
            {t('myProfile.signOut')}
          </button>
        </div>
      </section>
    </div>
  )
}
