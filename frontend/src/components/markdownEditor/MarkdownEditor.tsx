import { useCallback, useEffect, useReducer, useRef, useState, type FocusEvent } from 'react'
import type { MarkType } from 'prosemirror-model'
import type { Command, EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Room } from '../../forms/LongBox'
import { heldControl } from '../../forms/held'
import { useI18n } from '../../i18n/useI18n'
import {
  bold,
  heading,
  inHeading,
  inList,
  italic,
  linkable,
  linkableAddress,
  linkIn,
  list,
  marked,
  paste,
  removeLink,
  setLink,
  sizeOf,
  stateFor,
} from './commands'
import { hrefOf, schema } from './schema'
import { toMarkdown } from './convert'
import type { EditorProps } from './props'
import 'prosemirror-view/style/prosemirror.css'
import './MarkdownEditor.css'

/** One button of the toolbar: what it is called, what it does, and whether it is on. */
type Tool = { key: string; command: Command; on: (state: EditorState) => boolean; className: string }

const markOn = (type: MarkType) => (state: EditorState) => marked(state, type)

/* The four that switch something on and off, in the owner's order (PDL, 16.10.2026: „podebljano,
   kurziv, naslov, spisak i vezu"). The fifth, the link, opens a row of its own and is drawn apart. */
const TOOLS: readonly Tool[] = [
  {
    key: 'editor.bold',
    command: bold,
    on: markOn(schema.marks.strong),
    className: 'md-editor__tool md-editor__tool--bold',
  },
  {
    key: 'editor.italic',
    command: italic,
    on: markOn(schema.marks.em),
    className: 'md-editor__tool md-editor__tool--italic',
  },
  { key: 'editor.heading', command: heading, on: inHeading, className: 'md-editor__tool' },
  { key: 'editor.list', command: list, on: inList, className: 'md-editor__tool' },
]

/** The attributes of the box that is typed into: what it is, what names it, and how it stands. */
function attributesOf(props: EditorProps): Record<string, string> {
  const attributes: Record<string, string> = {
    id: props.id,
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-invalid': String(props.invalid === true),
    class: `md-editor__area markdown ${heldControl(props.locked === true)}`,
  }

  if (props.labelledBy !== undefined) {
    attributes['aria-labelledby'] = props.labelledBy
  }

  if (props.label !== undefined) {
    attributes['aria-label'] = props.label
  }

  if (props.describedBy !== undefined) {
    attributes['aria-describedby'] = props.describedBy
  }

  if (props.required === true) {
    attributes['aria-required'] = 'true'
  }

  /* Held the way every other control of a form is held: reachable, read out, and not to be
     changed. `aria-readonly` is what a textbox says for the last of the three. */
  if (props.locked === true) {
    attributes['aria-disabled'] = 'true'
    attributes['aria-readonly'] = 'true'
  }

  return attributes
}

/** The toolbar and the row that asks for the address of a link, over a drawn editor. */
function Controls({ view, id, locked }: { view: EditorView; id: string; locked: boolean }) {
  const { t } = useI18n()
  const [linking, setLinking] = useState<{ address: string; wrong: boolean } | null>(null)
  const { state } = view
  const existing = linkIn(state)
  const panelId = `${id}-link`

  const run = (command: Command) => {
    command(view.state, view.dispatch)
    view.focus()
  }

  const closeLink = () => {
    setLinking(null)
    view.focus()
  }

  const applyLink = (address: string) => {
    if (!linkableAddress(address.trim())) {
      setLinking({ address, wrong: true })
      return
    }

    view.dispatch(setLink(view.state, address.trim()))
    closeLink()
  }

  return (
    <>
      <div className="md-editor__tools" role="group" aria-label={t('editor.tools')}>
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            className={tool.className}
            aria-pressed={tool.on(state)}
            disabled={locked || !tool.command(state)}
            /* The press must not take the cursor out of the text first: what is selected is what
               the button acts on. */
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(tool.command)}
          >
            {t(tool.key)}
          </button>
        ))}

        <button
          type="button"
          className="md-editor__tool"
          aria-expanded={linking !== null}
          disabled={locked || !linkable(state)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            setLinking(
              linking === null
                ? { address: existing === undefined ? '' : hrefOf(existing), wrong: false }
                : null,
            )
          }
        >
          {t('editor.link')}
        </button>
      </div>

      {linking !== null && (
        <div className="md-editor__link" role="group" aria-labelledby={`${panelId}-label`}>
          <label className="field__label" id={`${panelId}-label`} htmlFor={panelId}>
            {t('editor.address')}
          </label>
          <input
            id={panelId}
            className="field__control"
            type="text"
            inputMode="url"
            autoFocus
            value={linking.address}
            aria-invalid={linking.wrong}
            aria-describedby={linking.wrong ? `${panelId}-wrong` : undefined}
            onChange={(event) => setLinking({ address: event.target.value, wrong: false })}
            onKeyDown={(event) => {
              /* Enter keeps the address rather than sending the form the editor stands in, and
                 Escape puts the row away and the cursor back into the text. */
              if (event.key === 'Enter') {
                event.preventDefault()
                applyLink(linking.address)
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                closeLink()
              }
            }}
          />
          {linking.wrong && (
            <p className="field__error" id={`${panelId}-wrong`}>
              {t('editor.wrongAddress')}
            </p>
          )}
          <div className="md-editor__link-actions">
            <button type="button" className="button" onClick={() => applyLink(linking.address)}>
              {t('editor.setLink')}
            </button>
            {existing !== undefined && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  view.dispatch(removeLink(view.state, existing))
                  closeLink()
                }}
              >
                {t('editor.removeLink')}
              </button>
            )}
            <button type="button" className="button button--secondary" onClick={closeLink}>
              {t('editor.cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * THE EDITOR OF THE TEXTS OF THE ADMINISTRATION, „vidiš šta dobijaš" (owner, 16.10.2026: „Uređivač
 * je „vidiš šta dobijaš", sa dugmadima za podebljano, kurziv, naslov, spisak i vezu; tekst se čuva
 * kao Markdown, isto kao pisane strane").
 *
 * Three places write through it: the description of an event, the terms and the prizes of a
 * competition, and the written pages. What it holds is read from the text by the same reading the
 * page draws from (`markdownText.ts`), and what it gives back is the text that reading understands,
 * so what is shown while somebody writes is what the page shows once it is kept.
 *
 * Built on ProseMirror and loaded only where it is drawn (`components/TextEditor.tsx`), so the
 * public screens carry none of it. Why ProseMirror and not another editor is in the description of
 * the change that brought it: the smallest of the three measured, a schema that can be closed to
 * exactly what a written text says, and a toolbar that is ours, so every button is a `<button>`.
 *
 * The buttons say what they do in words and not in pictures, because a word is its own name: what a
 * screen reader reads is what is on the button (WCAG 2.2 SC 2.5.3), and nobody has to guess what a
 * slanted letter means. Each of the four that switch says whether it is on (`aria-pressed`), and a
 * press never takes the cursor out of the text.
 */
export default function MarkdownEditor(props: EditorProps) {
  const latest = useRef(props)
  /* The text this editor last said it holds, or was last handed. A value handed in that is not this
     one is somebody else's change (a form put back, a record read again) and replaces what is in the
     box; one that is this one is the box's own change coming back, and changes nothing. */
  const written = useRef(props.value)
  /* And the text last handed in, so only a change of what is handed in is read as one: a screen
     that hands in the text it opened with and keeps it there is not asking for it back. */
  const handed = useRef(props.value)
  const [view, setView] = useState<EditorView | null>(null)
  const [, redraw] = useReducer((count: number) => count + 1, 0)
  const [dropped, setDropped] = useState(0)

  useEffect(() => {
    latest.current = props
  })

  const mount = useCallback((place: HTMLDivElement | null) => {
    const made: EditorView = new EditorView(place, {
      state: stateFor(latest.current.value, () => latest.current.maxLength),
      attributes: attributesOf(latest.current),
      editable: () => latest.current.locked !== true,
      dispatchTransaction: (tr) => {
        made.updateState(made.state.apply(tr))
        redraw()

        if (tr.docChanged) {
          setDropped(0)
          written.current = toMarkdown(made.state.doc.content)
          latest.current.onChange(written.current)
        }
      },
      handlePaste: (into, event) => {
        const text = event.clipboardData?.getData('text/plain')

        if (text === undefined) {
          return false
        }

        const cut = paste(into.state, text.replace(/\r\n?/g, '\n'), latest.current.maxLength)

        into.dispatch(cut.tr)
        setDropped(cut.dropped)

        return true
      },
      /* What goes to the clipboard is the text with its shape, written the way it is kept, so a
         paste back into this editor or into another one comes back the same. */
      clipboardTextSerializer: (slice) => toMarkdown(slice.content),
    })

    setView(made)

    if (latest.current.autoFocus === true) {
      made.focus()
    }

    return () => made.destroy()
  }, [])

  /* What a screen hands in after the box is drawn: the attributes every time, and a text that is
     somebody else's change. */
  useEffect(() => {
    if (view === null) {
      return
    }

    view.setProps({ attributes: attributesOf(props) })

    if (props.value === handed.current) {
      return
    }

    handed.current = props.value

    if (props.value !== written.current) {
      written.current = props.value
      view.updateState(stateFor(props.value, () => latest.current.maxLength))
      redraw()
    }
  })

  /* The cursor has left everything that belongs to the editor: the text, the toolbar and the row
     that asks for an address. Leaving the text for one of its own buttons is not leaving it. */
  const left = (event: FocusEvent<HTMLDivElement>) => {
    const to = event.relatedTarget

    if (!(to instanceof Node && event.currentTarget.contains(to))) {
      latest.current.onLeave(written.current)
    }
  }

  return (
    <div className="md-editor" onBlur={left}>
      {view !== null && <Controls view={view} id={props.id} locked={props.locked === true} />}

      <div ref={mount} />

      <Room
        length={view === null ? props.value.length : sizeOf(view.state.doc)}
        maxLength={props.maxLength}
        leftId={props.leftId}
        dropped={dropped}
      />
    </div>
  )
}
