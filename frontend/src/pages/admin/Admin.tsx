import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { combineResources, useCompetitors, useEvents, useResults } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

const SCREENS = [
  { path: 'administracija/verifikacija', key: 'nav.verification' },
  { path: 'administracija/entiteti', key: 'nav.entities' },
  { path: 'administracija/znacke', key: 'admin.badges' },
]

export function Admin() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const { submissions } = useSession()
  const state = combineResources(useCompetitors(), useEvents(), useResults())

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  const waiting = submissions.filter((one) => one.status === 'pending').length

  return (
    <div className="member">
      <h1>{t('admin.title')}</h1>

      <Resource state={state}>
        {([competitors, events, results]) => (
          <>
            <dl className="admin__counts">
              <div>
                <dt>{t('admin.waiting')}</dt>
                <dd>{formatNumber(waiting, locale)}</dd>
              </div>
              <div>
                <dt>{t('admin.members')}</dt>
                <dd>{formatNumber(competitors.length, locale)}</dd>
              </div>
              <div>
                <dt>{t('admin.events')}</dt>
                <dd>{formatNumber(events.length, locale)}</dd>
              </div>
              <div>
                <dt>{t('admin.results')}</dt>
                <dd>{formatNumber(results.length, locale)}</dd>
              </div>
            </dl>

            <div className="member__links">
              {SCREENS.map((screen) => (
                <Link
                  key={screen.path}
                  className="button button--secondary"
                  to={`/${locale}/${screen.path}`}
                >
                  {t(screen.key)}
                </Link>
              ))}
            </div>
          </>
        )}
      </Resource>
    </div>
  )
}
