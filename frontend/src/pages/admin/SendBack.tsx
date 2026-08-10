import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

/**
 * What is written down when something is handed back, on every queue that hands
 * anything back at all.
 *
 * The rule is one rule and it holds everywhere it applies: approving explains
 * itself, and handing work back does not. A member who gets a refusal with no
 * reason writes back to ask, so the reason is not politeness but the cheaper of
 * the two paths. The button stays disabled until something is written, which is
 * why the reason cannot be forgotten rather than merely asked for.
 *
 * What counts as written is the same everywhere: the text with the spaces taken
 * off it, exactly as the forms decide it (src/forms/validate.ts). A reason of
 * three spaces is no reason, and it would have satisfied a plain comparison
 * against the empty string.
 */

export function SendBack({
  placeholderKey = 'review.reasonPlaceholder',
  subject,
  optional = false,
  confirmKey = 'review.confirmSendBack',
  labelKey = 'review.reason',
  aboutKey = 'review.sendBackNamed',
  onConfirm,
  onCancel,
}: {
  /**
   * What the empty field asks for.
   *
   * The label and the confirming button are the same words on every queue that
   * hands work back, because it is the same decision every time and a member
   * reading two names for it would be reading about two different things. What
   * differs is what the moderator is expected to put in it, and that is what the
   * empty field says. On the profile pictures the reason is the precise
   * instruction by which the member changes the picture, since that reason is
   * what reaches their inbox and what they work from (PDL P22, owner,
   * 30.07.2026).
   */
  placeholderKey?: string
  /**
   * What is being sent back, named. Handed in where the box stands away from
   * the thing it decides, which is any screen that is a table: a reason box
   * under twenty rows says nothing about whose membership is being refused.
   * Left out where the box sits inside the card it belongs to.
   */
  subject?: string
  /**
   * Whether the box may be confirmed empty.
   *
   * One case, and it is not a refusal: a deleted comment (owner, 06.08.2026).
   * The note there is not a reason given to anybody, since nothing at all is
   * sent to the member, but a trace left for whoever reads the queue next:
   * why this was taken down. A trace nobody is obliged to leave is a trace that
   * gets left, and one that is obliged is three dots typed to get past the
   * button.
   */
  optional?: boolean
  /** The words on the confirming button, where the decision is not a refusal. */
  confirmKey?: string
  /** The words over the field, where what is asked for is not a reason. */
  labelKey?: string
  /** What the box is called, where the decision it takes is not a refusal. */
  aboutKey?: string
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

  const about = subject === undefined ? undefined : t(aboutKey, { name: subject })

  return (
    <div className="review__reason" role="group" aria-label={about ?? t('review.sendBack')}>
      {about !== undefined && <p className="review__about">{about}</p>}

      <label className="rankings__field rankings__field--wide">
        <span>{t(labelKey)}</span>
        <input
          ref={field}
          type="text"
          value={note}
          placeholder={t(placeholderKey)}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="member__links">
        <button
          type="button"
          className="button button--primary"
          disabled={!optional && note.trim() === ''}
          onClick={() => onConfirm(note.trim())}
        >
          {t(confirmKey)}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          {t('review.cancel')}
        </button>
      </div>
    </div>
  )
}
