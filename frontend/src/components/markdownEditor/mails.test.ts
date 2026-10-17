import { describe, expect, it } from 'vitest'
import type { Node } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { stateFor } from './commands'
import { fromMarkdown } from './convert'
import { mailsOf, mailsShown } from './mails'
import { blocksOf, inlineOf, type Inline } from '../markdownText'

/* The mailboxes the editor shows as links while a text is written (owner, 17.10.2026: „kad otkucam
   nešto nalik mail adresi, treba da ga pretvoriš automatski u link za slanje maila"), asked of a
   document and answered by the words each decoration stands over. */

/** The words every decoration of a document stands over, in the order they stand. */
function shownIn(doc: Node): string[] {
  return mailsOf(doc)
    .find()
    .map((one) => doc.textBetween(one.from, one.to))
}

const shown = (text: string) => shownIn(fromMarkdown(text))

/** The mailboxes the page draws as links for the same text, read the way the description of an
 *  event reads them (`components/Markdown.tsx`, `addresses="mail"`). */
function drawn(text: string): string[] {
  const of = (pieces: Inline[]): string[] =>
    pieces.flatMap((piece) => {
      if (piece.kind === 'address') {
        return [piece.text]
      }

      return piece.kind === 'strong' || piece.kind === 'em' ? of(piece.children) : []
    })

  return blocksOf(text).flatMap((block) => {
    if (block.kind === 'heading') {
      return of(inlineOf(block.text, 'mail'))
    }

    if (block.kind === 'paragraph') {
      return of(inlineOf(block.lines.join('\n'), 'mail'))
    }

    return block.kind === 'list' ? block.items.flatMap((item) => of(inlineOf(item, 'mail'))) : []
  })
}

/* Every shape below, read by the editor and by the page. The two have to agree on each, so the
   writer sees a link exactly where the reader will get one. */
const TEXTS: { text: string; mails: string[] }[] = [
  { text: 'Piši na info@primer.rs.', mails: ['info@primer.rs'] },
  { text: 'info@primer.rs ili (liga@runtrace.net)', mails: ['info@primer.rs', 'liga@runtrace.net'] },
  { text: '## Pišite na info@primer.rs', mails: ['info@primer.rs'] },
  { text: '- info@primer.rs\n- liga@runtrace.net', mails: ['info@primer.rs', 'liga@runtrace.net'] },
  { text: '1. info@primer.rs', mails: ['info@primer.rs'] },
  { text: '**info@primer.rs**', mails: ['info@primer.rs'] },
  { text: 'Piši _na info@primer.rs_ odmah', mails: ['info@primer.rs'] },
  { text: '(**info@primer.rs**)', mails: ['info@primer.rs'] },
  { text: 'info@primer.rs**.** dalje', mails: ['info@primer.rs'] },
  { text: 'Prvi red\ninfo@primer.rs', mails: ['info@primer.rs'] },
  { text: '[sajt](https://a.example) info@primer.rs', mails: ['info@primer.rs'] },
  { text: 'ime\\_prezime@primer.rs', mails: ['ime_prezime@primer.rs'] },
  /* None of these is a mailbox the page draws as a link, so none is shown as one. */
  { text: '[info@primer.rs](mailto:info@primer.rs)', mails: [] },
  { text: '[piši na info@primer.rs](https://a.example)', mails: [] },
  { text: '`info@primer.rs`', mails: [] },
  { text: '| info@primer.rs |', mails: [] },
  { text: 'info@**primer**.rs', mails: [] },
  { text: '**a**info@primer.rs', mails: [] },
  { text: 'info@primer.rs**b**', mails: [] },
  { text: 'ime@primer', mails: [] },
  { text: 'https://a.example/x@y.example', mails: [] },
  { text: 'www.runtrace.net@zlo.example', mails: [] },
  { text: '', mails: [] },
]

describe('the mailboxes the editor shows as links', () => {
  it.each(TEXTS)('are the ones the page draws as links: $text', ({ text, mails }) => {
    expect(shown(text)).toEqual(mails)
    expect(drawn(text)).toEqual(mails)
  })

  it('are found again when the text changes, and kept as they were when only the cursor moves', () => {
    const state = stateFor('Piši na', () => undefined)
    const typed = state.apply(state.tr.insertText(' info@primer.rs', 8))

    expect(mailsShown.getState(state)?.find()).toEqual([])
    expect(shownIn(typed.doc)).toEqual(['info@primer.rs'])
    expect(mailsShown.getState(typed)?.find().map((one) => typed.doc.textBetween(one.from, one.to))).toEqual([
      'info@primer.rs',
    ])

    const moved = typed.apply(typed.tr.setSelection(TextSelection.create(typed.doc, 2)))

    expect(mailsShown.getState(moved)).toBe(mailsShown.getState(typed))
  })
})
