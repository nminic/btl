import { useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { hrefFor } from './commands'
import '../Prompt.css'

/** What the box for a link starts with, and what it hands back. */
export type LinkDialogProps = {
  /** The id of the editor, which the ids of the box are made from. */
  id: string
  /** What the field Ispis starts with: the selected words, or the words of the link being changed. */
  words: string
  /** What the field Link starts with: where the link being changed leads, or nothing. */
  address: string
  /** The words and where they lead, once the address is one a link may lead to. */
  onKeep: (words: string, href: string) => void
  /** Takes off the link being changed, and is there only where a link is being changed. */
  onRemove?: () => void
  onClose: () => void
}

/**
 * THE BOX FOR A LINK, with its two fields (owner, 17.10.2026, PDL „Ispravke sa ekrana 17.10.2026"):
 * „Treba da izbaci boks u koji se upišu Ispis i Link. Ispis je ono što piše, a link ono gde zapravo
 * vodi."
 *
 * **The shape of the portal's one other sheet, `components/Prompt.tsx`, and its guards with it**:
 * its stylesheet; `role="dialog"` with `aria-modal` and the heading as its name; Escape closes it and
 * is STOPPED there, so a menu left open behind it (`app/Dropdown.tsx`, `app/LanguageMenu.tsx`, both
 * on the document in the bubble phase) is not closed by the same press; Tab cannot leave it; and a
 * press outside does not close it, so a stray press on the page behind does not throw away what was
 * typed. Two things differ, each for a reason:
 *
 * - **The focus goes to the first field that is empty**, and not to the heading. The heading of the
 *   prompt takes the focus so that a reader hears a question before an answer can be pressed; here
 *   nothing can be agreed to by a press of the space bar, and what there is to do is type. With
 *   both fields filled (a link being changed), the focus goes to the first of them.
 * - **The ring Tab walks is every field and every button**, where the prompt has buttons only.
 *
 * Where the focus goes when it closes is the editor's to say (`MarkdownEditor.tsx`): back into the
 * text, where the link now is.
 *
 * Drawn inside the editor and not at the end of the document, so the cursor going into it is not the
 * cursor leaving the editor, which is when a box of a competition keeps its text
 * (`pages/league/EditableText.tsx`).
 *
 * **Enter keeps the link and does not send the form the editor stands in**: a field inside a form
 * sends it on Enter, and the event's form would be sent with the link not made yet.
 */
export function LinkDialog({
  id,
  words: wordsAtFirst,
  address: addressAtFirst,
  onKeep,
  onRemove,
  onClose,
}: LinkDialogProps) {
  const { t } = useI18n()
  const [words, setWords] = useState(wordsAtFirst)
  const [address, setAddress] = useState(addressAtFirst)
  const [fault, setFault] = useState<'editor.noAddress' | 'editor.wrongAddress' | null>(null)
  const addressField = useRef<HTMLInputElement>(null)
  const title = `${id}-link-title`
  const faultId = `${id}-link-fault`
  /* The first field that is empty, or the first field where neither is. */
  const toAddress = wordsAtFirst !== '' && addressAtFirst === ''

  const keep = () => {
    const typed = address.trim()
    const href = hrefFor(typed)

    if (href === undefined) {
      /* Said beside the field, and the cursor taken to it, so what is wrong is read out where it
         can be put right. */
      setFault(typed === '' ? 'editor.noAddress' : 'editor.wrongAddress')
      addressField.current?.focus()
      return
    }

    /* Words left empty are the address as it was typed, which is what a link made without words
       showed before the box had a field for them. */
    onKeep(words.trim() === '' ? typed : words.trim(), href)
  }

  const onFieldKey = (pressed: KeyboardEvent<HTMLInputElement>) => {
    if (pressed.key === 'Enter') {
      pressed.preventDefault()
      keep()
    }
  }

  /* Escape, and Tab that cannot leave, on the sheet and not on the document, for the reasons
     `components/Prompt.tsx` gives at its own handler. */
  const onSheetKey = (pressed: KeyboardEvent<HTMLDivElement>) => {
    if (pressed.key === 'Escape') {
      pressed.preventDefault()
      pressed.stopPropagation()
      onClose()
      return
    }

    if (pressed.key !== 'Tab') {
      return
    }

    const ring = Array.from(pressed.currentTarget.querySelectorAll<HTMLElement>('input, button'))
    const edge = pressed.shiftKey ? ring[0] : ring[ring.length - 1]
    const wrapTo = pressed.shiftKey ? ring[ring.length - 1] : ring[0]

    if (document.activeElement === edge && wrapTo !== undefined) {
      pressed.preventDefault()
      wrapTo.focus()
    }
  }

  return (
    /* The backdrop takes no press: see the note above. */
    <div className="prompt">
      <div
        className="prompt__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        onKeyDown={onSheetKey}
      >
        <h2 className="prompt__title" id={title}>
          {t('editor.link')}
        </h2>

        <div className="prompt__body md-editor__fields">
          <div className="field">
            <label className="field__label" htmlFor={`${id}-link-words`}>
              {t('editor.words')}
            </label>
            <input
              id={`${id}-link-words`}
              className="field__control"
              type="text"
              autoFocus={!toAddress}
              value={words}
              onChange={(event) => setWords(event.target.value)}
              onKeyDown={onFieldKey}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor={`${id}-link-address`}>
              {t('editor.address')}
            </label>
            <input
              id={`${id}-link-address`}
              ref={addressField}
              className="field__control"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoFocus={toAddress}
              value={address}
              aria-invalid={fault !== null}
              aria-describedby={fault === null ? undefined : faultId}
              onChange={(event) => {
                setAddress(event.target.value)
                setFault(null)
              }}
              onKeyDown={onFieldKey}
            />
            {fault !== null && (
              <p className="field__error" id={faultId}>
                {t(fault)}
              </p>
            )}
          </div>
        </div>

        <div className="prompt__answers">
          <button type="button" className="button" onClick={keep}>
            {t('editor.add')}
          </button>
          {onRemove !== undefined && (
            <button type="button" className="button button--secondary" onClick={onRemove}>
              {t('editor.removeLink')}
            </button>
          )}
          <button type="button" className="button button--secondary" onClick={onClose}>
            {t('editor.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
