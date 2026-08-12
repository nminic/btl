import type { ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import './FormRenderer.css'

/**
 * The star beside the name of a field that has to be answered.
 *
 * Outside the `<label>` and not inside it. Inside, it joins the words the field
 * is found by: every test and every screen reader that looks for „Ime" would be
 * looking for „Ime *", and thirty seven tests said so at once.
 *
 * Owner, 12.08.2026: „Obavezna polja treba da imaju zvezdicu pored." Drawn and
 * not spoken: the same thing is said to a screen reader by `aria-required` on
 * the control, which is where a reader looks for it, and a star read out after
 * every second label is noise. What the star means is said once, over the form
 * (`RequiredNote`), which is where a legend belongs.
 *
 * The two halves are one decision and neither works alone. Written before
 * `aria-required` existed, the comment here said a reader was „already given"
 * it, and it was given nothing: the star was hidden and no control said a word
 * about being obligatory.
 */
export function RequiredMark() {
  return (
    <span className="field__required" aria-hidden="true">
      {'*'}
    </span>
  )
}

/** What the star means, said once over whatever draws one. */
export function RequiredNote() {
  const { t } = useI18n()

  return <p className="form__legend">{t('form.requiredNote')}</p>
}

/**
 * The name of a field that is not built by the renderer, with its star.
 *
 * The owner asked for the rule on 12.08.2026 to hold on „svim formama za unos i
 * verifikaciju", and eight fields on the verification screens are written by
 * hand rather than drawn from a definition: the reason a result is sent back,
 * the reason anything else is, and the three a proposed team is corrected in.
 * Written out at each of them, the rule held at one and drifted at seven, which
 * is what happened the first time.
 *
 * The label names the control by its id rather than wrapping it, because the
 * star has to stand outside the label and everything inside a label is the name
 * of the field.
 */
export function AskedLabel({
  id,
  asked = true,
  className,
  children,
}: {
  id: string
  /** False where the field may be left empty, which is one of the eight. */
  asked?: boolean
  /**
   * What the words are styled by, where the field around them does not do it.
   *
   * Five of the six places this is used sit inside `.rankings__field`, which
   * styles the name through the box around it. The sixth is a field of the
   * ordinary kind, where the weight comes from `.field__label` and nothing else,
   * and without it the name of that one field was drawn lighter than every other
   * name on the portal.
   */
  className?: string
  children: ReactNode
}) {
  return (
    <span className="asked">
      <label className={className} htmlFor={id}>
        {children}
      </label>
      {asked && <RequiredMark />}
    </span>
  )
}
