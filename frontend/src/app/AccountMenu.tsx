import { Link } from 'react-router'
import { useCompetitors } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { Dropdown } from './Dropdown'
import { SignInIcon } from './icons'
import { monogramFor } from './monogram'
import { ACCOUNT_ROUTES } from './routes'

/* The picture and, next to it, the cog (PDL P28a). The picture opens the member
 * area; the cog goes straight to settings, because a setting you have to hunt
 * for through a menu is a setting nobody changes.
 *
 * A visitor gets the sign-in symbol in place of both. */
export function AccountMenu() {
  const { locale, t } = useI18n()
  const { memberNumber, signOut } = useSession()
  const competitors = useCompetitors()

  if (memberNumber === null) {
    return (
      <Link className="icon-link" to={`/${locale}/prijava`} aria-label={t('shell.signIn')}>
        <SignInIcon className="icon-link__glyph" />
      </Link>
    )
  }

  const member =
    competitors.status === 'ready'
      ? competitors.data.find((one) => one.memberNumber === memberNumber)
      : undefined

  return (
    <Dropdown
      id="account-menu"
      className="account"
      label={t('shell.openAccount')}
      trigger={<span className="account__monogram">{monogramFor(member, memberNumber)}</span>}
    >
      {(close) => (
        <>
          <p className="account__who">
            {member === undefined ? memberNumber : `${member.firstName} ${member.lastName}`}
          </p>
          {ACCOUNT_ROUTES.map((route) => (
            <Link
              key={route.path}
              className="account__link"
              to={`/${locale}/${route.path}`}
              onClick={close}
            >
              {t(route.labelKey)}
            </Link>
          ))}
          <button
            type="button"
            className="account__link account__link--button"
            onClick={() => {
              close()
              signOut()
            }}
          >
            {t('myProfile.signOut')}
          </button>
        </>
      )}
    </Dropdown>
  )
}
