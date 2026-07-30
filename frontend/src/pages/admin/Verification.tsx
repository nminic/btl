import { useI18n } from '../../i18n/useI18n'
import { QUEUES } from './queues'
import '../member/Member.css'
import './Verification.css'

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
 *
 * The alarm that used to stand here went with the numbers. It says that a source
 * has failed and some of them may be short, and it belongs beside them; left
 * here it would be an alarm about numbers that are on the other eight screens
 * (SectionNav).
 */
export function Verification() {
  const { t } = useI18n()

  return (
    <div className="member">
      <h1>{t('verification.title')}</h1>
      <p className="member__note">{t('verification.intro')}</p>

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
