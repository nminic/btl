import { useEffect, useState } from 'react'
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
 * **Two things hold it open and they are counted apart.** A pointer resting on
 * it and a keyboard standing on it are two different reasons, and one going away
 * must not close what the other is still holding: written as one flag, taking
 * the mouse away closed a box the focus was keeping open. WCAG 2.2 SC 1.4.13
 * asks for exactly that pair, and for a third thing besides: Escape closes it
 * without moving either of them, so the answer is a third piece of state that
 * outranks both and is forgotten the next time either arrives.
 *
 * **It opens in the flow, between the label and the field.** Laid over what
 * comes after it, a rule left open by a finger swallowed the first press on
 * whatever it covered, and a pointer could never reach the words to read them to
 * the end: the way down crossed the control, which is outside this and closed it
 * on the way. Opening in the flow, the pointer moves straight from the letter
 * into the words, and nothing is covered.
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
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  /* Put away by Escape, and only until it is asked for again. */
  const [dismissed, setDismissed] = useState(false)
  const open = (hovered || focused) && !dismissed

  useEffect(() => {
    if (!open) {
      return
    }

    /* On the document, because the press that has to close this is usually
       nowhere near it: a pointer resting on the letter while the fingers are
       typing into the field beside it leaves the keyboard somewhere else
       entirely, and a handler on the button never hears it. The portal's menus
       answer Escape the same way (app/Dropdown.tsx).
     *
       On the way down and not on the way back up. Two things follow from that,
       and both are the point. Every hint that is open hears the press, so one
       Escape puts away all of them rather than whichever one happens to hold the
       keyboard; and the press is stopped before it reaches anything the form is
       standing in, so a sheet is not closed by the same press that closed a
       tooltip, which was the reason the button used to answer this itself. */
    function onKeyDown(pressed: KeyboardEvent) {
      if (pressed.key === 'Escape') {
        pressed.stopPropagation()
        setDismissed(true)
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  /**
   * Whether the pointer went somewhere that is still **this** hint.
   *
   * The letter and the words are two elements, so a pointer travelling from one
   * to the other leaves the first: asked only about the element it left, the box
   * closed under the pointer on its way into the words, and they could never be
   * read to the end (WCAG 2.2 SC 1.4.13, hoverable). Asked about the hint they
   * both stand in, the journey stays inside.
   *
   * This one and not any one. Asked about hints in general it was true of the
   * neighbour's as well, and two fields do stand side by side in a row: the
   * pointer swept from the open words of one straight into the letter of the
   * other, sixteen pixels away, and the first stayed open with nothing left
   * holding it.
   */
  function stillHere(leaving: Element, going: EventTarget | null): boolean {
    return going instanceof Element && going.closest('.hint') === leaving.closest('.hint')
  }

  return (
    <span className={open ? 'hint hint--open' : 'hint'}>
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
        /* A press asks for it and does not put it away, because a press is also
           an arrival: a toggle here fought the focus the same press brings, and
           the pair ended where they started. */
        onClick={() => setDismissed(false)}
        onFocus={() => {
          setFocused(true)
          setDismissed(false)
        }}
        onBlur={() => setFocused(false)}
        onMouseOver={(coming) => {
          setHovered(true)

          /* And what Escape put away comes back only on a new arrival. The
             press leaves the pointer where it is, and the pointer moving inside
             the button it is already on is not an arrival: `mouseover` bubbles
             out of the letter drawn inside it, so a hair of movement over
             twenty four pixels brought back what had just been put away. */
          if (!stillHere(coming.currentTarget, coming.relatedTarget)) {
            setDismissed(false)
          }
        }}
        onMouseOut={(going) => {
          if (!stillHere(going.currentTarget, going.relatedTarget)) {
            setHovered(false)
          }
        }}
      >
        {/* A letter to look at and not a word to read: what a screen reader is
            given is the name above, and a control whose visible text is „i"
            while its name is „Objašnjenje" cannot be spoken to (WCAG 2.2
            SC 2.5.3). Hidden from the tree, the two no longer disagree.
         *
            Out of the dictionary all the same, short as it is: it is a letter
            somebody reads, and the other language may not spell it „i". */}
        <span aria-hidden="true">{t('form.explainMark')}</span>
      </button>

      {/* Not `role="tooltip"`: this is read through `aria-describedby` on the
          field, which is where a rule belongs, and a second announcement of the
          same words as the button's own description would be the rule said
          twice.

          It holds itself open under the pointer, so the words can be read to the
          end and taken (SC 1.4.13 asks that hovered content be hoverable). */}
      <span
        className="hint__text"
        id={id}
        onMouseOver={() => setHovered(true)}
        onMouseOut={(going) => {
          if (!stillHere(going.currentTarget, going.relatedTarget)) {
            setHovered(false)
          }
        }}
      >
        {text}
      </span>
    </span>
  )
}
