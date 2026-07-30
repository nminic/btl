import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { entitiesForRole } from './entityList'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/** One place that lists everything administration owns, so nothing hides behind
 *  a link on some other screen (PDL P28a). */
export function Entities() {
  const { locale, t } = useI18n()
  const { role } = useRole()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('entities.title')}</h1>
      <p className="member__note">{t('entities.intro')}</p>

      <div className="member__links">
        {entitiesForRole(role).map((entity) => (
          <Link
            key={entity.path}
            className="button button--secondary"
            to={`/${locale}/${entity.path}`}
          >
            {t(entity.labelKey)}
          </Link>
        ))}
      </div>
    </div>
  )
}
