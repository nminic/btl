import { Link } from 'react-router'
import { dataOr, failed } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { usePending } from './pending'
import { countsFor, QUEUES } from './queues'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/**
 * Everything waiting for a moderator or the superadmin, as one list (PDL P28a).
 * Every row leads to the screen where the work is done, and the number on it
 * comes from countsFor, which is also what the navigation counts with.
 *
 * The file is read for what it is worth rather than waited for, exactly as the
 * header reads it (src/app/Shell.tsx). A failure used to take the whole screen
 * down, including the row of results, which is counted from the session and does
 * not depend on the file at all. What a failure must not do is pass silently, so
 * it is said out loud instead.
 */
export function Verification() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const { submissions, decisions } = useSession()
  const items = usePending()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  const counts = countsFor({
    pendingResults: submissions.filter((one) => one.status === 'pending').length,
    items: dataOr(items, []),
    decisions,
  })

  return (
    <div className="member">
      <h1>{t('verification.title')}</h1>
      <p className="member__note">{t('verification.intro')}</p>

      {/* Said out loud, in the same words a broken screen uses, because a number
          that is quietly short is worse than an error: a moderator reads a queue
          of zero as a queue of nothing.

          Only for the source the numbers actually depend on. The file of members
          was handed in here too, long after anything counted from it, so a broken
          competitors.json raised the alarm over eight numbers that were all
          correct. An alarm that goes off when nothing is wrong is how a moderator
          learns to ignore it. */}
      {failed(items) && (
        <p className="resource-state" role="alert">
          {t('verification.shortCount')}
        </p>
      )}

      <ul className="queues">
        {QUEUES.map((queue) => {
          const count = counts[queue.id]

          return (
            <li key={queue.id} className="queues__item">
              <Link className="queues__row" to={`/${locale}/${queue.path}`}>
                <span className="queues__name">{t(queue.labelKey)}</span>
                <span
                  className={count > 0 ? 'queues__count queues__count--waiting' : 'queues__count'}
                >
                  {formatNumber(count, locale)}
                </span>
                <span className="queues__source">{t(queue.sourceKey)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
