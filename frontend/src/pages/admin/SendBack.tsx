import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

/**
 * The reason a thing is being sent back, on every queue there is.
 *
 * The rule is one rule and it holds everywhere: approving explains itself, and
 * sending back does not. A member who gets a refusal with no reason writes back
 * to ask, so the reason is not politeness but the cheaper of the two paths. The
 * button stays disabled until something is written, which is why the reason
 * cannot be forgotten rather than merely asked for.
 */
export function SendBack({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [note, setNote] = useState('')

  return (
    <div className="review__reason" role="group" aria-label={t('review.sendBack')}>
      <label className="rankings__field rankings__field--wide">
        <span>{t('review.reason')}</span>
        <input
          type="text"
          value={note}
          placeholder={t('review.reasonPlaceholder')}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="member__links">
        <button
          type="button"
          className="button button--primary"
          disabled={note === ''}
          onClick={() => onConfirm(note)}
        >
          {t('review.confirmSendBack')}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          {t('review.cancel')}
        </button>
      </div>
    </div>
  )
}
