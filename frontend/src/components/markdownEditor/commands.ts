import {
  baseKeymap,
  chainCommands,
  newlineInCode,
  setBlockType,
  toggleMark,
} from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { Slice, type Mark, type MarkType, type Node } from 'prosemirror-model'
import { liftListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import { EditorState, Plugin, type Command, type Transaction } from 'prosemirror-state'
import { addressOf } from '../markdownText'
import { fromMarkdown, toMarkdown } from './convert'
import { schema } from './schema'

/*
 * WHAT THE BUTTONS AND THE KEYS OF THE EDITOR DO, without a screen, so each of them can be asked
 * of a state and answered by a state.
 */

/** How long a document is, counted as what the server keeps and counts: the Markdown. */
export function sizeOf(doc: Node): number {
  return toMarkdown(doc.content).length
}

/**
 * Whether a change may happen under the limit.
 *
 * A change that makes the text longer than the field takes is refused at the door (owner,
 * 01.08.2026), and a change that does not make it longer is always let through: a record can be
 * longer than a limit put on the field after it was written, and a writer shortening it must not be
 * stopped by the length they are taking away.
 */
export function fits(tr: Transaction, state: EditorState, max: number | undefined): boolean {
  return !tr.docChanged || max === undefined || sizeOf(tr.doc) <= Math.max(max, sizeOf(state.doc))
}

export const bold = toggleMark(schema.marks.strong)
export const italic = toggleMark(schema.marks.em)

/** A line break inside a paragraph, or inside a block that is kept as written. */
export const lineBreak: Command = chainCommands(newlineInCode, (state, dispatch) => {
  dispatch?.(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView())

  return true
})

/** Whether the cursor stands in a heading. */
export function inHeading(state: EditorState): boolean {
  return state.selection.$from.parent.type === schema.nodes.heading
}

/** A heading, or a paragraph again where it already is one. */
export const heading: Command = (state, dispatch) =>
  inHeading(state)
    ? setBlockType(schema.nodes.paragraph)(state, dispatch)
    : setBlockType(schema.nodes.heading, { hashes: 2 })(state, dispatch)

/** Whether the cursor stands in an item of a list, of either kind. */
export function inList(state: EditorState): boolean {
  const { $from } = state.selection

  return $from.node(Math.max(0, $from.depth - 1)).type === schema.nodes.list_item
}

/**
 * A list, or out of one where it already is in one.
 *
 * A heading becomes an item too: it is made a paragraph first, because an item of a written list is
 * one line of words and not a heading, and both happen in one change, so one undo takes back both.
 */
export const list: Command = (state, dispatch) => {
  if (inList(state)) {
    return liftListItem(schema.nodes.list_item)(state, dispatch)
  }

  if (!inHeading(state)) {
    return wrapInList(schema.nodes.bullet_list)(state, dispatch)
  }

  const tr = state.tr.setBlockType(state.selection.from, state.selection.to, schema.nodes.paragraph)

  return wrapInList(schema.nodes.bullet_list)(state.apply(tr), (wrapped) => {
    wrapped.steps.forEach((step) => tr.step(step))
    dispatch?.(tr.scrollIntoView())
  })
}

/** Whether what is selected, or what is about to be typed, carries the mark. */
export function marked(state: EditorState, type: MarkType): boolean {
  const { from, to, empty, $from } = state.selection

  return empty
    ? type.isInSet(state.storedMarks ?? $from.marks()) !== undefined
    : state.doc.rangeHasMark(from, to, type)
}

/** The link the cursor or the selection stands in, if there is one. */
export function linkIn(state: EditorState): Mark | undefined {
  const { from, to, $from } = state.selection
  let found = schema.marks.link.isInSet($from.marks())

  state.doc.nodesBetween(from, to, (node) => {
    found = found ?? schema.marks.link.isInSet(node.marks)
  })

  return found
}

/** Whether a link can stand where the cursor is: not inside a block kept as written. */
export function linkable(state: EditorState): boolean {
  return toggleMark(schema.marks.link, { href: '' })(state)
}

/** The words of the link the cursor stands in, from where they begin to where they end. */
export function aroundCursor(state: EditorState, link: Mark): { from: number; to: number } {
  const { $from } = state.selection
  const start = $from.start()
  let run: { from: number; to: number } | null = null
  let found = { from: $from.pos, to: $from.pos }

  $from.parent.forEach((child, offset) => {
    const from = start + offset
    const to = from + child.nodeSize

    if (!link.isInSet(child.marks)) {
      run = null
      return
    }

    run = run === null ? { from, to } : { from: run.from, to }

    if (run.from <= $from.pos && $from.pos <= run.to) {
      found = run
    }
  })

  return found
}

/**
 * Which address a link may lead to: one of this portal, written with one slash, or one of another
 * site, written with `https://`, `http://` or `mailto:`, and no blank and no closing bracket in it,
 * which a written link cannot hold.
 *
 * Whether the page will draw it is asked of the page's own list (`addressOf`), so the editor never
 * makes a link the page would show as words.
 */
const LINKABLE = /^(?:https?:\/\/|mailto:|\/(?![/\\]))[^\s)]+$/

export function linkableAddress(address: string): boolean {
  return LINKABLE.test(address) && addressOf(address) !== undefined
}

/** The selection, or the link around the cursor, made a link to the address. With nothing
 *  selected and no link to change, the address itself is written as its words. */
export function setLink(state: EditorState, address: string): Transaction {
  const { empty, from, to } = state.selection
  const existing = linkIn(state)
  const mark = schema.marks.link.create({ href: address })

  if (empty && existing === undefined) {
    return state.tr.replaceSelectionWith(schema.text(address, [mark]), false)
  }

  const range = empty && existing !== undefined ? aroundCursor(state, existing) : { from, to }

  return state.tr.removeMark(range.from, range.to, schema.marks.link).addMark(range.from, range.to, mark)
}

/** The link the cursor stands in, or every link in the selection, taken off its words. */
export function removeLink(state: EditorState, existing: Mark): Transaction {
  const { empty, from, to } = state.selection
  const range = empty ? aroundCursor(state, existing) : { from, to }

  return state.tr.removeMark(range.from, range.to, schema.marks.link)
}

/** What a paste of plain text is read as: Markdown, the way a text is kept, so a text copied out
 *  of this editor or out of a written page comes back with its shape. */
function sliceOf(text: string): Slice {
  return Slice.maxOpen(fromMarkdown(text).content)
}

/**
 * A paste, cut where the limit is, and how many of its characters did not fit.
 *
 * The limit is refused at the door and the writer is told what a paste lost (`forms/LongBox.tsx`
 * says why), so the paste is cut rather than refused whole: the most of it that fits goes in.
 * Counted in the characters that were pasted, which is what the writer brought.
 */
export function paste(
  state: EditorState,
  text: string,
  max: number | undefined,
): { tr: Transaction; dropped: number } {
  const upTo = (length: number) =>
    state.tr.replaceSelection(sliceOf(text.slice(0, length))).scrollIntoView()
  const whole = upTo(text.length)

  if (max === undefined || sizeOf(whole.doc) <= max) {
    return { tr: whole, dropped: 0 }
  }

  let fitting = 0
  let over = text.length

  while (over - fitting > 1) {
    const middle = Math.floor((fitting + over) / 2)

    if (sizeOf(upTo(middle).doc) <= max) {
      fitting = middle
    } else {
      over = middle
    }
  }

  return { tr: upTo(fitting), dropped: text.length - fitting }
}

/** The keys, beside the ones every ProseMirror editor has. Tab is not one of them: it leaves the
 *  editor, as it leaves every other field, so nobody is trapped in it (WCAG 2.2 SC 2.1.2). */
const KEYS = keymap({
  'Mod-b': bold,
  'Mod-i': italic,
  'Mod-z': undo,
  'Mod-y': redo,
  'Shift-Mod-z': redo,
  Enter: splitListItem(schema.nodes.list_item),
  'Shift-Enter': lineBreak,
})

/** A state for a text, with the limit asked of `max` each time a change is about to happen. */
export function stateFor(text: string, max: () => number | undefined): EditorState {
  return EditorState.create({
    doc: fromMarkdown(text),
    plugins: [
      history(),
      KEYS,
      keymap(baseKeymap),
      new Plugin({ filterTransaction: (tr, state) => fits(tr, state, max()) }),
    ],
  })
}
