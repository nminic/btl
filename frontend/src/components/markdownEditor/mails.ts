import type { Node } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { CLOSING, OPENING } from '../../pages/league/aroundAWord'
import { mailsIn } from '../../pages/league/mailsIn'
import { schema } from './schema'

/*
 * THE MAILBOXES OF A TEXT, SHOWN IN THE EDITOR AS THE LINKS THE PAGE WILL MAKE OF THEM.
 *
 * The owner, 17.10.2026 (PDL, „Ispravke sa ekrana 17.10.2026"): „kad otkucam nešto nalik mail
 * adresi, treba da ga pretvoriš automatski u link za slanje maila." The page makes the link
 * (`components/markdownText.ts`, `mailsIn`), so what is kept is the mailbox as it was typed and a
 * text keeps reading the same wherever it is drawn. The editor is „vidiš šta dobijaš" (PDL,
 * 16.10.2026), so a mailbox the page will draw as a link is drawn here the way a link is, the moment
 * it is typed: a decoration, which changes how the words look and nothing of what they are, so
 * nothing of it reaches the text that is kept.
 *
 * Every text the editor writes draws its mailboxes as links (the description of an event, the terms
 * and the prizes of a competition), so the editor asks no question about which text it is.
 */

/** Whether a piece of text is words a mailbox may stand in: not the words of a link, which are a
 *  link already, and not a value between backticks, which the page draws as it was typed. */
function plain(node: Node): boolean {
  return (
    node.isText &&
    !node.marks.some((mark) => mark.type === schema.marks.link || mark.type === schema.marks.code)
  )
}

/**
 * Whether a mailbox found at the edge of a run of text is the edge of a word.
 *
 * The page reads a word across bold and italic (`withAddresses`): `**a**ime@primer.rs` is one word,
 * and not a mailbox. In the editor the two are two runs of text with different marks, so a mailbox
 * that begins where a run begins is one only where the run before it ends a word: in a blank, in a
 * bracket or a quotation mark that may open one, or nowhere, at the start of the line, beside a line
 * break or beside a link. The same at the end, with the punctuation that may close one.
 */
function edgeOfWord(neighbour: Node | null, char: (text: string) => string, edge: RegExp): boolean {
  if (neighbour === null || !plain(neighbour)) {
    return true
  }

  const next = char(neighbour.textContent)

  return /\s/u.test(next) || edge.test(next)
}

/** The places of the mailboxes of a document, each as a decoration that draws it as a link. */
export function mailsOf(doc: Node): DecorationSet {
  const found: Decoration[] = []

  doc.descendants((block, at) => {
    /* A block kept as it was written (a table, a rule) shows its lines as lines and draws no link
       here, and a block that is not a block of words holds the ones that are. */
    if (!block.isTextblock) {
      return true
    }

    if (block.type.spec.code === true) {
      return false
    }

    block.forEach((run, offset, index) => {
      if (!plain(run)) {
        return
      }

      const text = run.textContent
      const before = index === 0 ? null : block.child(index - 1)
      const after = index === block.childCount - 1 ? null : block.child(index + 1)
      let from = 0

      for (const piece of mailsIn(text)) {
        const to = from + piece.text.length
        const opens = from > 0 || edgeOfWord(before, (one) => one.slice(-1), OPENING)
        const closes = to < text.length || edgeOfWord(after, (one) => one.slice(0, 1), CLOSING)

        if (piece.href !== null && opens && closes) {
          const start = at + 1 + offset + from

          found.push(Decoration.inline(start, start + piece.text.length, { class: 'md-editor__mail' }))
        }

        from = to
      }
    })

    return false
  })

  return DecorationSet.create(doc, found)
}

const KEY = new PluginKey<DecorationSet>('mails')

/** The plugin that keeps them: found again whenever the text changes, and only then. */
export const mailsShown = new Plugin<DecorationSet>({
  key: KEY,
  state: {
    init: (_, state) => mailsOf(state.doc),
    apply: (tr, before) => (tr.docChanged ? mailsOf(tr.doc) : before),
  },
  props: {
    decorations: (state) => KEY.getState(state),
  },
})
