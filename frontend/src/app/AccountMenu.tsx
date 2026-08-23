import { Link } from 'react-router'
import { useCompetitors } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { Dropdown } from './Dropdown'
import { monogramFor } from './monogram'
import { ACCOUNT_ROUTES } from './routes'

/* The picture, and behind it everything that belongs to one person: the member
 * area, settings, and signing out. The cog that used to sit beside it is gone;
 * a second door to the same room is one more thing in a header that already has
 * enough (PDL P28a).
 *
 * The shell only renders this when somebody is signed in. */
export function AccountMenu({ memberNumber }: { memberNumber: string }) {
  const { locale, t } = useI18n()
  const { signOut } = useSession()
  const competitors = useCompetitors()

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
          {/* Everything but what has a shorter way in of its own (routes.ts).
              Filtered here rather than dropped there, because that same list is
              what the router is built from. */}
          {ACCOUNT_ROUTES.filter((route) => route.notInMenu !== true).map((route) => (
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
