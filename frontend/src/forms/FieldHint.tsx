import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import './FieldHint.css'

/**
 * The rule a field carries, asked for rather than printed under it.
 *
 * Every field that carries a rule still carries it (PDL P8), and until
 * 11.08.2026 every one of them printed it as a line of grey text. On the
 * registration form that is a dozen fields and a dozen paragraphs, and the form
 * reads as a page of instructions with boxes between them. The owner asked for
 * the rule to move into a tooltip: „Svuda ćemo koristiti tooltip".
 *
 * **What is hidden is the sight of it and nothing else.** The text stays in the
 * document, and the field still names it in `aria-describedby`, so a screen
 * reader reads the label and then the rule exactly as before. A tooltip that
 * took the rule out of the accessibility tree would be a rule that only sighted
 * people have (WCAG 2.2 SC 1.3.1), and this one is often the difference between
 * a form that can be filled in and one that cannot.
 *
 * **Whether it is on screen is one piece of state, and nothing else.** It was
 * three: state for the press, `:hover` for the pointer and `:focus-visible` for
 * the keyboard, each able to show it and only the first able to hide it. Escape
 * then closed a tooltip that a hover was still holding open, and SC 1.4.13 asks
 * that content on hover or focus can be dismissed without moving the pointer or
 * the focus away. One piece of state, opened by all three and closed by Escape,
 * is what makes that true.
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
    <span
      className={open ? 'hint hint--open' : 'hint'}
      /* The pointer opens it and taking the pointer away closes it, which is
         what a tooltip is. Held on the wrapper rather than on the button, so
         that reaching for the words does not close them on the way: the wrapper
         holds both, and SC 1.4.13 asks that hovered content stay long enough to
         be read. */
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="hint__ask"
        /* „Objašnjenje", and which field it explains comes from its description
           rather than from its name.
         *
           The obvious way round is to put the field in the name: „Objašnjenje:
           Pol". Then the name of this button holds the name of the field, and
           every way of finding a control by its name finds two, from a screen
           reader's list of form controls to a test. So the name says what the
           button does, and the description says what it is about, which is what
           a description is for. */
        aria-label={t('form.explain')}
        aria-describedby={of}
        aria-expanded={open}
        aria-controls={id}
        /* A press opens it and does not close it, because a press is also an
           arrival: toggling here fought the focus that the same press brings,
           and the pair ended where they started. What closes it is Escape, or
           leaving it. */
        onClick={() => setOpen(true)}
        /* The keyboard opens it by arriving, the way the pointer does, and
           Escape closes it without going anywhere. */
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(pressed) => {
          if (pressed.key === 'Escape') {
            /* And no further: a form inside a sheet would otherwise close the
               sheet with the same press that closed this. */
            pressed.stopPropagation()
            setOpen(false)
          }
        }}
      >
        {/* A letter to look at and not a word to read: what a screen reader is
            given is the name above, and a control whose visible text is „i"
            while its name is „Objašnjenje" cannot be spoken to (WCAG 2.2
            SC 2.5.3). Hidden from the tree, the two no longer disagree. */}
        <span aria-hidden="true">{'i'}</span>
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
