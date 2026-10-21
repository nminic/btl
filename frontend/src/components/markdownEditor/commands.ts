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
import { mailOf } from '../../pages/league/mailsIn'
import { fromMarkdown, isBlank, toMarkdown } from './convert'
import { mailsShown } from './mails'
import { linkableAddress, schema } from './schema'

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

/**
 * Enter in an item of a list: a new item, numbered the way the item before it counts on, and the
 * items below it as they were written.
 *
 * ProseMirror splits an item into two copies of it, and a copy carries the number the item was
 * written with (`list_item` in `schema.ts`), so the new item would be numbered as the one it came
 * from: „4. do" and „4. 10. mesto". The new item is the one that holds the end of the line (a
 * number of its own is taken off it, and it counts on from the item above), or the one above where
 * Enter was pressed at the very start of the line, which leaves the words and their number where
 * they were. An empty item is not split at all: Enter takes it out of the list.
 */
export const splitItem: Command = (state, dispatch) =>
  splitListItem(schema.nodes.list_item)(
    state,
    dispatch &&
      ((tr) => {
        const { $from } = tr.selection
        const second = $from.before(-1)
        const first = $from.node(-2).child($from.index(-2) - 1)
        /* Asked of the thing the text that is written asks (`isBlank`): an item with no word in it is
           written as nothing, so the words that are left are the start of the line however much
           stands before the cursor, a blank or a line break among it. */
        const atStart = isBlank(first.child(0))

        dispatch(tr.setNodeMarkup(atStart ? second - first.nodeSize : second, null, { number: null }))
      }),
  )

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
 * WHERE A LINK MADE IN THE BOX FOR A LINK LEADS, for what was typed into its field Link (owner,
 * 17.10.2026, PDL „Ispravke sa ekrana 17.10.2026": „Ispis je ono što piše, a link ono gde zapravo
 * vodi. https:// ne treba uopšte da popunjavam nego da se podrazumeva (dakle ti ga dodaj
 * automatski)."), or nothing where it may not lead there.
 *
 * - **A mailbox is a link to write to it** (`mailOf`), chosen by the owner the same day among the
 *   options offered, with my recommendation (PDL, the same section).
 * - **A host with nothing in front of it gets `https://`**: what was typed, up to its first `/`,
 *   `?` or `#`, holds a full stop with something on both sides of it (`runtrace.net`,
 *   `www.runtrace.net/lige`, `runtrace.net:8080`). Derived from his sentence and not his word:
 *   `https` and not `http`, because it is the scheme the portal's addresses of other sites are
 *   given everywhere (`addressesIn`, the `www.` of PDL P15).
 * - **What already says where it goes is asked as it stands**: a scheme of its own (`https://`,
 *   `http://`, `mailto:`, and `javascript:` too, which is then refused), or one slash for a page of
 *   this portal (PR 541, the written pages' `/pravilnik` and the statute).
 *
 * Every one of them is then asked what every link of the editor is asked (`linkableAddress`), the
 * host check of PDL P15 included, so a `https://` put in front can never make a link of what the
 * page would draw as words: `www.runtrace.net@zlo.example` becomes
 * `https://www.runtrace.net@zlo.example`, and that is refused.
 *
 * A scheme here has no full stop in it, so a host with a port is not read as one: by the standard
 * `runtrace.net:8080` is the scheme `runtrace.net`, and nobody typing it means that.
 */
const SCHEME = /^[a-z][a-z0-9+-]*:/i
const A_HOST = /^[^/?#.\s][^/?#\s]*\.[^/?#.\s]/

export function hrefFor(typed: string): string | undefined {
  const address = typed.trim()
  const bare = !SCHEME.test(address) && !address.startsWith('/') && A_HOST.test(address)
  const href = mailOf(address) ?? (bare ? `https://${address}` : address)

  return linkableAddress(href) ? href : undefined
}

/** What a link would be made over: what is selected, the words of the link the cursor stands in, or
 *  nothing where the cursor stands in neither. */
function rangeOf(state: EditorState): { from: number; to: number } | null {
  const { empty, from, to } = state.selection
  const existing = linkIn(state)

  if (!empty) {
    return { from, to }
  }

  return existing === undefined ? null : aroundCursor(state, existing)
}

/** The words of a range as one line, which is what the field Ispis can hold. */
function textOf(state: EditorState, range: { from: number; to: number }): string {
  return state.doc.textBetween(range.from, range.to, ' ', ' ')
}

/** What the field Ispis of the box for a link starts with: the words that are selected, or the words
 *  of the link the cursor stands in, or nothing. */
export function wordsAt(state: EditorState): string {
  const range = rangeOf(state)

  return range === null ? '' : textOf(state, range)
}

/**
 * The link the box for a link makes: `words` leading to `href`, over what is selected or over the
 * link the cursor stands in, and at the cursor where there is neither.
 *
 * Words that are the words already there are left as they are, with their bold and their italic,
 * and only the link is put over them. Words that were changed in the box take the place of the old
 * ones, with the marks the old ones began with.
 */
export function putLink(state: EditorState, words: string, href: string): Transaction {
  const mark = schema.marks.link.create({ href })
  const range = rangeOf(state)

  if (range === null) {
    return state.tr.replaceSelectionWith(schema.text(words, [mark]), false)
  }

  const tr = state.tr
  const to = textOf(state, range) === words ? range.to : range.from + words.length

  if (to !== range.to) {
    tr.insertText(words, range.from, range.to)
  }

  return tr.removeMark(range.from, to, schema.marks.link).addMark(range.from, to, mark)
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
  Enter: splitItem,
  'Shift-Enter': lineBreak,
})

/** A state for a text, with the limit asked of `max` each time a change is about to happen. */
export function stateFor(text: string, max: () => number | undefined): EditorState {
  return EditorState.create({
    doc: fromMarkdown(text),
    plugins: [
      mailsShown,
      history(),
      KEYS,
      keymap(baseKeymap),
      new Plugin({ filterTransaction: (tr, state) => fits(tr, state, max()) }),
    ],
  })
}
