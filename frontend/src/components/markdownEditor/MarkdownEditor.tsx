import { useCallback, useEffect, useReducer, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import type { Mark, MarkType } from 'prosemirror-model'
import type { Command, EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { LinkIcon, ListIcon } from '../../app/icons'
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
  linkIn,
  list,
  marked,
  paste,
  putLink,
  removeLink,
  sizeOf,
  stateFor,
  wordsAt,
} from './commands'
import { hrefOf, schema } from './schema'
import { toMarkdown } from './convert'
import { LinkDialog } from './LinkDialog'
import type { EditorProps } from './props'
import 'prosemirror-view/style/prosemirror.css'
import './MarkdownEditor.css'

/** One button of the toolbar: what it is called, what it shows, what it does, and whether it is on. */
type Tool = { key: string; symbol: ReactNode; command: Command; on: (state: EditorState) => boolean }

const markOn = (type: MarkType) => (state: EditorState) => marked(state, type)

/* The four that switch something on and off, in the owner's order (PDL, 16.10.2026: „podebljano,
   kurziv, naslov, spisak i vezu"). The fifth, the link, opens the box for a link and is drawn apart.

   Each shows a symbol, as the palette of Word does (owner, 17.10.2026, PDL „Ispravke sa ekrana
   17.10.2026": „voleo bih da svi ti dugmići za formatiranje budu simboli nalik Word paleti (B, I, U i
   sl)... ovako deluje nezgrapno"): the letters B and I, set the way they set the text, an H for a
   heading, and a drawing for the list and for the link. There is no U, because the owner chose that
   there is no underlining (the same section). */
const TOOLS: readonly Tool[] = [
  {
    key: 'editor.bold',
    symbol: <span className="md-editor__symbol md-editor__symbol--bold">B</span>,
    command: bold,
    on: markOn(schema.marks.strong),
  },
  {
    key: 'editor.italic',
    symbol: <span className="md-editor__symbol md-editor__symbol--italic">I</span>,
    command: italic,
    on: markOn(schema.marks.em),
  },
  {
    key: 'editor.heading',
    symbol: <span className="md-editor__symbol md-editor__symbol--bold">H</span>,
    command: heading,
    on: inHeading,
  },
  { key: 'editor.list', symbol: <ListIcon className="md-editor__icon" />, command: list, on: inList },
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

/** What the box for a link is opened with: its two fields, and the link the cursor stood in. */
type Linking = { words: string; address: string; existing: Mark | undefined }

/** The toolbar and the box for a link, over a drawn editor. */
function Controls({ view, id, locked }: { view: EditorView; id: string; locked: boolean }) {
  const { t } = useI18n()
  const [linking, setLinking] = useState<Linking | null>(null)
  const { state } = view

  /* A button that cannot act stays where it is and says so (`aria-disabled`), rather than leaving the
     order of focus: held, not switched off, which is how every control of a form on the portal is
     held (`forms/FormRenderer.tsx`). So the press is refused here. */
  const run = (command: Command, refused: boolean) => {
    if (!refused) {
      command(view.state, view.dispatch)
      view.focus()
    }
  }

  /* Closed by any road, the cursor goes back into the text, where the link is or was to be. */
  const closeLink = () => {
    setLinking(null)
    view.focus()
  }

  const linkRefused = locked || !linkable(state)

  /* Taking a link off is offered only where there is one to take off. */
  const removing = (existing: Mark | undefined) =>
    existing === undefined
      ? undefined
      : () => {
          view.dispatch(removeLink(view.state, existing))
          closeLink()
        }

  return (
    <>
      <div className="md-editor__tools" role="group" aria-label={t('editor.tools')}>
        {TOOLS.map((tool) => {
          const refused = locked || !tool.command(state)

          return (
            <button
              key={tool.key}
              type="button"
              className="md-editor__tool"
              /* A symbol is no name (WCAG 2.2 SC 1.1.1, and what SC 2.5.3 says of symbols), so the
                 button is named by the word it showed before it showed a symbol, and that word is
                 what a pointer resting on it shows too. */
              aria-label={t(tool.key)}
              title={t(tool.key)}
              aria-pressed={tool.on(state)}
              aria-disabled={refused ? true : undefined}
              /* The press must not take the cursor out of the text first: what is selected is what
                 the button acts on. */
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => run(tool.command, refused)}
            >
              {tool.symbol}
            </button>
          )
        })}

        <button
          type="button"
          className="md-editor__tool"
          aria-label={t('editor.link')}
          title={t('editor.link')}
          aria-haspopup="dialog"
          aria-disabled={linkRefused ? true : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (linkRefused) {
              return
            }

            const existing = linkIn(state)

            setLinking({
              words: wordsAt(state),
              address: existing === undefined ? '' : hrefOf(existing),
              existing,
            })
          }}
        >
          <LinkIcon className="md-editor__icon" />
        </button>
      </div>

      {linking !== null && (
        <LinkDialog
          id={id}
          words={linking.words}
          address={linking.address}
          onKeep={(words, href) => {
            view.dispatch(putLink(view.state, words, href))
            closeLink()
          }}
          onRemove={removing(linking.existing)}
          onClose={closeLink}
        />
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
 * The buttons show symbols, as the palette of Word does (owner, 17.10.2026, PDL „Ispravke sa ekrana
 * 17.10.2026"), and each is named by its word for whoever cannot see the symbol (`aria-label`), with
 * the same word shown where a pointer rests on it (`title`). Until that day they showed their words,
 * which the owner found clumsy. Each of the four that switch says whether it is on (`aria-pressed`),
 * and a press never takes the cursor out of the text.
 */
export default function MarkdownEditor(props: EditorProps) {
  const latest = useRef(props)
  /* The text this editor last said it holds, or was last handed. A value handed in that is not this
     one is somebody else's change (a form put back, a record read again) and replaces what is in the
     box; one that is this one is the box's own change coming back, and changes nothing. */
  const written = useRef(props.value)
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

  /* What a screen hands in after the box is drawn: the attributes, every time it draws. */
  useEffect(() => {
    if (view !== null) {
      view.setProps({ attributes: attributesOf(props) })
    }
  })

  /* And a text handed in that is not the one the box last said it holds: somebody else's change,
     which replaces what is in the box. Asked only when what is handed in changes, so a screen that
     hands in the text it opened with and keeps it there is not asking for it back. */
  const { value } = props

  useEffect(() => {
    if (view !== null && value !== written.current) {
      written.current = value
      view.updateState(stateFor(value, () => latest.current.maxLength))
      redraw()
    }
  }, [view, value])

  /* The cursor has left everything that belongs to the editor: the text, the toolbar and the box for
     a link. Leaving the text for one of its own buttons is not leaving it. */
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
