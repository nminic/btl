import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'

/** Every member screen ends here when nobody is signed in. */
export function SignedOut() {
  const { locale, t } = useI18n()

  return (
    <div className="member">
      <h1>{t('signIn.needed')}</h1>
      <p className="member__note">{t('signIn.neededText')}</p>
      <Link className="button button--primary" to={`/${locale}/prijava`}>
        {t('nav.login')}
      </Link>
    </div>
  )
}
