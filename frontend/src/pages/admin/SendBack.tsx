import { useEffect, useId, useRef, useState } from 'react'
import { AskedLabel } from '../../forms/AskedLabel'
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
  confirmKey = 'review.confirmSendBack',
  labelKey = 'review.reason',
  aboutKey = 'review.sendBackNamed',
  onConfirm,
  onCancel,
  working = false,
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
  /*
   * `explain` STOOD HERE AND IS GONE (27.09.2026), and it is worth saying why rather than
   * leaving the next reader to reinvent it.
   *
   * It decided whether this box drew the line saying what the star means, and it was `false`
   * „where whoever draws it already draws that line for a block of fields beside this one, so
   * one screen carries one legend and not two". Every screen that still opens this box does
   * exactly that: `PendingQueue.tsx` and `ReviewQueue.tsx` both draw their own `RequiredNote`
   * over the whole screen. The one caller that did NOT was the screen of payments, which drew
   * no legend of its own - and that screen has stopped opening this box altogether, because a
   * derived list of whoever has not paid has nothing anybody sent in to hand back.
   *
   * So the `true` side of it became a branch no screen could reach, which is the one thing a
   * list of mutations cannot see and the hundred per cent threshold can: the gate fell to
   * 99.94 on branches with all 3323 cases green, and this line was the whole of it.
   *
   * WHAT COMES BACK WITH IT, if a screen ever needs it: the prop, its default, and the
   * `explain && !optional` render. Not written now, because a screen that opens this box
   * without a legend of its own does not exist and inventing the flag for it is inventing a
   * user interface for nobody.
   */
  /** The words on the confirming button, where the decision is not a refusal. */
  confirmKey?: string
  /** The words over the field, where what is asked for is not a reason. */
  labelKey?: string
  /** What the box is called, where the decision it takes is not a refusal. */
  aboutKey?: string
  onConfirm: (reason: string) => void
  onCancel: () => void
  /**
   * Whether the decision this box sent is still out with the route.
   *
   * <p><b>While it is, nothing on the box answers</b> (owner, 02.10.2026, choosing between three
   * outcomes he was priced; PDL, „Odluke iz ciscenja nalaza", first item): not the button that
   * sends it again, which would send a second decision for the same card, and not „Odustani",
   * which would close the box over a request that goes on and take the typed reason with it - a
   * refusal that arrived afterwards was then read against nothing. Both say so with
   * `aria-disabled` and are refused in their handlers as well, and the portal's own sentence for
   * a request that is out is said under them. The caller closes the box when the answer says the
   * decision was taken; a refusal leaves it open with the reason in it, as it always did.
   */
  working?: boolean
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
          aria-disabled={missing || working}
          aria-describedby={missing ? waitsId : undefined}
          onClick={() => {
            /* Reachable means pressable, so the refusal lives here too. */
            if (missing || working) {
              return
            }

            onConfirm(note.trim())
          }}
        >
          {t(confirmKey)}
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-disabled={working ? true : undefined}
          onClick={() => {
            /* PUT AWAY ONLY WHEN NOTHING IS OUT, for the reason `working` gives. */
            if (working) {
              return
            }

            onCancel()
          }}
        >
          {t('review.cancel')}
        </button>
      </div>

      {/* SAID IN WORDS, ONLY WHILE IT IS TRUE (WCAG 2.2 AA, 4.1.3), in the portal's own sentence
          for a request that is out (`results.sending` is read by two forms and four other keys
          carry the same words). It never stands beside the line under it: that one is drawn only
          while the box is empty, and a box being sent is not. */}
      {working && (
        <p className="rate__hint" role="status">
          {t('results.sending')}
        </p>
      )}

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
