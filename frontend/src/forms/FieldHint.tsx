import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import './FieldHint.css'

/**
 * The rule a field carries, asked for rather than printed under it.
 *
 * Every field that carries a rule still carries it (PDL P8), and until
 * 11.08.2026 every one of them printed it as a line of grey text. On the
 * registration form that is fourteen fields and fourteen paragraphs, and the
 * form reads as a page of instructions with boxes between them. The owner asked
 * for the rule to move into a tooltip: „Svuda ćemo koristiti tooltip".
 *
 * **What is hidden is the sight of it and nothing else.** The text stays in the
 * document, and the field still names it in `aria-describedby`, so a screen
 * reader reads the label and then the rule exactly as before. A tooltip that
 * takes the rule out of the accessibility tree would be a rule that only sighted
 * people have (WCAG 2.2 SC 1.3.1), and this one is often the difference between
 * a form that can be filled in and one that cannot.
 *
 * It opens three ways, because three kinds of people reach it: the pointer
 * hovers it (CSS), the keyboard focuses it (CSS), and a finger presses it
 * (this state, since a telephone has no hover). Escape closes it, and it can be
 * left open while the field beside it is typed into: SC 1.4.13 asks that content
 * on hover be dismissable and not disappear the moment the pointer moves.
 */
export function FieldHint({
  id,
  text,
  of,
}: {
  id: string
  text: string
  /** The id of the label this explains, for the button's description. */
  of: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <span className={open ? 'hint hint--open' : 'hint'}>
      <button
        type="button"
        className="hint__ask"
        /* „Objašnjenje", and which field it explains comes from its
           description rather than from its name.
         *
           The obvious way round is to put the field in the name:
           „Objašnjenje: Pol". Then the name of this button holds the name of the
           field, and every way of finding a control by its name finds two, from
           a screen reader's list of form controls to a test. So the name says
           what the button does, and the description says what it is about, which
           is what a description is for. */
        aria-label={t('form.explain')}
        aria-describedby={of}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(pressed) => {
          if (pressed.key === 'Escape') {
            /* And no further: a form inside a sheet would otherwise close the
               sheet with the same press that closed this. */
            pressed.stopPropagation()
            setOpen(false)
          }
        }}
      >
        {'i'}
      </button>

      {/* Not `role="tooltip"`: this is read through `aria-describedby` on the
          field, which is where a rule belongs, and a second announcement of the
          same words as the button's own description would be the rule said
          twice. */}
      <span className="hint__text" id={id}>
        {text}
      </span>
    </span>
  )
}
