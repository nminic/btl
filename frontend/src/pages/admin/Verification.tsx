import { failed } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { usePending } from './pending'
import { QUEUES } from './queues'
import '../member/Member.css'

/**
 * What the section is, on the way into it.
 *
 * The eight queues themselves, and how much is waiting in each, are in the
 * navigation beside this and beside every screen behind it (SectionNav, owner
 * 30.07.2026). They used to be here, as a list of rows with the same numbers on
 * them, and that list was the only place on the portal that said how much was
 * left anywhere else: a moderator settling the last picture had to come back
 * here to find out what to do next.
 *
 * What is left here is the one thing a navigation cannot carry: why each queue
 * exists at all. Eight names and eight sentences, and not one number, so no
 * number on this portal is written in two places.
 */
export function Verification() {
  const { t } = useI18n()
  const items = usePending()

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

      <h2>{t('verification.whatIsWhere')}</h2>

      <dl className="queues__reasons">
        {QUEUES.map((queue) => (
          <div key={queue.id}>
            <dt>{t(queue.labelKey)}</dt>
            <dd>{t(queue.sourceKey)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
