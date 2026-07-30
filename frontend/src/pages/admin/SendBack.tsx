import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

/**
 * The reason a thing is being sent back, on every queue there is.
 *
 * The rule is one rule and it holds everywhere: approving explains itself, and
 * sending back does not. A member who gets a refusal with no reason writes back
 * to ask, so the reason is not politeness but the cheaper of the two paths. The
 * button stays disabled until something is written, which is why the reason
 * cannot be forgotten rather than merely asked for.
 *
 * What counts as written is the same everywhere: the text with the spaces taken
 * off it, exactly as the forms decide it (src/forms/validate.ts). A reason of
 * three spaces is no reason, and it would have satisfied a plain comparison
 * against the empty string.
 */
export function SendBack({
  subject,
  onConfirm,
  onCancel,
}: {
  /**
   * What is being sent back, named. Handed in where the box stands away from
   * the thing it decides, which is any screen that is a table: a reason box
   * under twenty rows says nothing about whose membership is being refused.
   * Left out where the box sits inside the card it belongs to.
   */
  subject?: string
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [note, setNote] = useState('')
  const field = useRef<HTMLInputElement>(null)

  /* The box has just appeared, usually in place of the button that opened it,
   * so the focus has to come along. Without it the focus stays on an element
   * that has left the page, and the next Tab starts the page from the top. The
   * panels in the header do the same thing the other way round
   * (src/app/Dropdown.tsx). */
  useEffect(() => {
    field.current?.focus()
  }, [])

  const about = subject === undefined ? undefined : t('review.sendBackNamed', { name: subject })

  return (
    <div className="review__reason" role="group" aria-label={about ?? t('review.sendBack')}>
      {about !== undefined && <p className="review__about">{about}</p>}

      <label className="rankings__field rankings__field--wide">
        <span>{t('review.reason')}</span>
        <input
          ref={field}
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
          disabled={note.trim() === ''}
          onClick={() => onConfirm(note.trim())}
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
