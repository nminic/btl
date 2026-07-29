import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { combinePair, useCompetitors, useEvents } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { countsFor, QUEUES } from './queues'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/** Everything waiting for a moderator or the superadmin, as one list (PDL
 *  P28a). The queues themselves are in queues.ts. */
export function Verification() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const { submissions } = useSession()
  /* Only the two the counts are read from. Waiting on the results file as well
   * would hold this screen up, and turn it into an error message, over data no
   * queue on it shows: what is waiting comes from the session. */
  const state = combinePair(useCompetitors(), useEvents())

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  const pending = submissions.filter((one) => one.status === 'pending').length

  return (
    <div className="member">
      <h1>{t('verification.title')}</h1>
      <p className="member__note">{t('verification.intro')}</p>

      <Resource state={state}>
        {([competitors, events]) => {
          const counts = countsFor(pending, competitors, events)

          return (
            <ul className="queues">
              {QUEUES.map((queue) => {
                const count = counts[queue.id]
                const label = (
                  <>
                    <span className="queues__name">{t(queue.labelKey)}</span>
                    <span
                      className={count > 0 ? 'queues__count queues__count--waiting' : 'queues__count'}
                    >
                      {formatNumber(count, locale)}
                    </span>
                    <span className="queues__source">{t(queue.sourceKey)}</span>
                  </>
                )

                return (
                  <li key={queue.id} className="queues__item">
                    {queue.path === undefined ? (
                      <div className="queues__row queues__row--flat">
                        {label}
                        <span className="queues__soon">{t('verification.soon')}</span>
                      </div>
                    ) : (
                      <Link className="queues__row" to={`/${locale}/${queue.path}`}>
                        {label}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )
        }}
      </Resource>
    </div>
  )
}
