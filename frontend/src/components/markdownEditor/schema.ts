import { Schema, type Mark, type Node } from 'prosemirror-model'

/**
 * WHAT THE EDITOR CAN HOLD, which is exactly what a written text can say (`markdownText.ts`) and
 * nothing more.
 *
 * Closed on purpose. A paste from a word processor or a web page brings tables, colours, images
 * and nested lists; anything the schema has no node for is dropped on the way in rather than
 * written into the text as something no screen of the portal draws. What is here is what the
 * owner's toolbar writes (PDL, 16.10.2026: podebljano, kurziv, naslov, spisak, veza) and what the
 * written pages already carry and the toolbar has no button for: a numbered list, a value written
 * between backticks, and the three blocks the editor keeps exactly as they were written (`kept`).
 */
export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    /**
     * A sub-heading, with the number of hashes it was written with, so a text that went through
     * the editor keeps the depth of every heading it had. The button writes two, which is the
     * first level under the heading the text stands beneath (`levelOf` in `Markdown.tsx`).
     */
    heading: {
      attrs: { hashes: { default: 2 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h2', attrs: { hashes: 2 } },
        { tag: 'h3', attrs: { hashes: 3 } },
        { tag: 'h4', attrs: { hashes: 4 } },
        { tag: 'h5', attrs: { hashes: 5 } },
        { tag: 'h6', attrs: { hashes: 6 } },
      ],
      /* Drawn the way a written page draws it, an h3 for two and three hashes, so the editor looks
         like the page it writes. */
      toDOM: (node) => [hashesOf(node) <= 3 ? 'h3' : `h${hashesOf(node)}`, 0],
    },
    bullet_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },
    ordered_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ol' }],
      toDOM: () => ['ol', 0],
    },
    /** One line of words and nothing else, because an item of a written list is one line: a
     *  list inside a list is not something a written text can say. */
    list_item: {
      content: 'paragraph',
      defining: true,
      parseDOM: [{ tag: 'li' }],
      toDOM: () => ['li', 0],
    },
    /**
     * A block kept as it was written: a table, a rule, the place of a drawing on a written page.
     *
     * The toolbar has none of the three, and the written pages carry all of them (ten sections
     * with a table, four with a rule, two with the place of a drawing, measured on 17.10.2026 over
     * `test/mock/pages.json`). Read as anything else they would come back out of the editor as
     * words with their characters escaped, and the table would be gone from the page. Shown as the
     * lines it is written in, which is the one shape in which it can still be changed.
     */
    kept: {
      content: 'text*',
      marks: '',
      code: true,
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM: () => ['pre', { class: 'md-editor__kept' }, 0],
    },
    text: { group: 'inline' },
    /** A line break inside a paragraph, which a written text keeps (an address, a signature). */
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
  },
  marks: {
    /* First, so it is the outermost of the marks a piece of text carries: the words of a link may
       be bold, a link is never inside a bold piece that it splits. */
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [{ tag: 'a[href]', getAttrs: (dom) => ({ href: dom.getAttribute('href') }) }],
      toDOM: (mark) => ['a', { href: hrefOf(mark) }, 0],
    },
    strong: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM: () => ['strong', 0],
    },
    em: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }],
      toDOM: () => ['em', 0],
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM: () => ['code', 0],
    },
  },
})

/** The hashes of a heading. An attribute of ProseMirror is untyped, so it is read as a number here
 *  and nowhere else. */
export function hashesOf(node: Node): number {
  return Number(node.attrs.hashes)
}

/** Where a link leads, read the same way. */
export function hrefOf(mark: Mark): string {
  return String(mark.attrs.href)
}
