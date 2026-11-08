import { Link, useLocation } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { cameFrom } from './backAfterSignIn'

/**
 * Every member screen ends here when nobody is signed in.
 *
 * <p><b>The way to the sign in page carries the address of this screen</b>, its query and the part after
 * `#` with it, so the sign in page sends the reader back here once he is in (owner, 07.11.2026, PDL
 * „Prijava vraća čitaoca na adresu sa koje je došao”: „Povratak posle prijave važi za strane koje kažu „Za
 * ovo treba prijava”"). What the sign in page trusts of it is decided there (`backAfterSignIn.ts`).
 */
export function SignedOut() {
  const { locale, t } = useI18n()
  const { pathname, search, hash } = useLocation()

  return (
    <div className="member">
      <h1>{t('signIn.needed')}</h1>
      <p className="member__note">{t('signIn.neededText')}</p>
      <Link
        className="button button--primary"
        to={`/${locale}/prijava`}
        state={cameFrom(`${pathname}${search}${hash}`)}
      >
        {t('nav.login')}
      </Link>
    </div>
  )
}
