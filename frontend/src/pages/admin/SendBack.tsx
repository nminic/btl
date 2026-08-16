import { useEffect, useId, useRef, useState } from 'react'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'

/**
 * What is written down when something is handed back, on every queue that hands
 * anything back at all.
 *
 * The rule is one rule and it holds everywhere it applies: approving explains
 * itself, and handing work back does not. A member who gets a refusal with no
 * reason writes back to ask, so the reason is not politeness but the cheaper of
 * the two paths. The button refuses until something is written, which is why the
 * reason cannot be forgotten rather than merely asked for. It refuses without
 * going dead: `disabled` would take it out of the tab order and take the
 * explanation with it, so it carries `aria-disabled` and points at a line saying
 * what it is waiting for, exactly as the rest of the portal does.
 *
 * What counts as written is the same everywhere: the text with the spaces taken
 * off it, exactly as the forms decide it (src/forms/validate.ts). A reason of
 * three spaces is no reason, and it would have satisfied a plain comparison
 * against the empty string.
 */

export function SendBack({
  /* The promise is true of every caller again, since the owner had the message
     sent from all queues (15.08.2026). It was briefly the other way: the words
     said the reason is written down and reaches nobody, because on five queues
     out of six that was the truth. */
  placeholderKey = 'review.reasonPlaceholder',
  subject,
  optional = false,
  explain = true,
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
   * What is being decided, named.
   *
   * On a screen that is a table the box stands away from the row it belongs to,
   * and a reason box under twenty rows says nothing about whose membership is
   * being refused. Inside a card it is not needed for that, and it is asked for
   * all the same: the name of the box is where the decision says which one it
   * is, and a deletion whose box is called "Odbij" is the one word the queue of
   * comments must not use (queues.ts).
   */
  subject: string
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
  /** Whether this box says what the star means. False where whoever draws it
   *  already draws that line for a block of fields beside this one, so one
   *  screen carries one legend and not two. */
  explain?: boolean
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
  /** Nothing to send back with: the button, the reason beside it and the refusal
   *  on the press all have to agree about it, so it is worked out once. */
  const missing = !optional && note.trim() === ''
  /* Its own ids per instance: five queues share this box and two of them draw it
     inside a table, where a fixed id would be repeated down the rows. Today
     exactly one box is open at a time, so nothing collides; the comment used to
     say this while the field beside it still carried a written id, which is an
     argument that reads as done and is half done. */
  const own = useId()
  const waitsId = `${own}-waits`
  const fieldId = `${own}-reason`

  /* The box has just appeared, usually in place of the button that opened it,
   * so the focus has to come along. Without it the focus stays on an element
   * that has left the page, and the next Tab starts the page from the top. The
   * panels in the header do the same thing the other way round
   * (src/app/Dropdown.tsx). */
  useEffect(() => {
    field.current?.focus()
  }, [])

  const about = t(aboutKey, { name: subject })

  return (
    <div className="review__reason" role="group" aria-label={about}>
      <p className="review__about">{about}</p>

      {/* The same rule as every other field on the portal: a star where it has
          to be written, and nothing where it may be left empty
          (forms/AskedLabel.tsx). Five queues send back through this one box, so
          the rule reaching it reaches all five.

          And the line explaining the star stands with the star, appearing and
          going away with it. Drawn instead by the screen around this box, on a
          guess at whether a star is on it, it was drawn where a note may be left
          empty and no star is, and left standing over a queue that had emptied.
          A guess at what is on the screen is what keeps being wrong; the star
          itself is not a guess. */}
      {explain && !optional && <RequiredNote />}

      <div className="rankings__field rankings__field--wide">
        <AskedLabel id={fieldId} asked={!optional}>
          {t(labelKey)}
        </AskedLabel>
        <input
          id={fieldId}
          ref={field}
          type="text"
          value={note}
          aria-required={optional ? undefined : true}
          placeholder={t(placeholderKey)}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="member__links">
        {/* Told off, not switched off, as everywhere else on the portal
            (RateEvent, PendingQueue, Pager, GoingToEvent, SignIn): `disabled`
            takes the control out of the tab order and takes the reason with it.
            This box is shared by five verification queues, so it is the widest
            single place the rule was still broken. */}
        <button
          type="button"
          className="button button--primary"
          aria-disabled={missing}
          aria-describedby={missing ? waitsId : undefined}
          onClick={() => {
            /* Reachable means pressable, so the refusal lives here too. */
            if (missing) {
              return
            }

            onConfirm(note.trim())
          }}
        >
          {t(confirmKey)}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          {t('review.cancel')}
        </button>
      </div>

      {/* Why it will not go yet, said where it can be read. Drawn only while it
          is true, the same as on the rating card: this whole box arrives on a
          press, so nothing rests on the region being announced as it appears. */}
      {missing && (
        <p id={waitsId} className="rate__hint" role="status">
          {t('review.reasonNeeded')}
        </p>
      )}
    </div>
  )
}
