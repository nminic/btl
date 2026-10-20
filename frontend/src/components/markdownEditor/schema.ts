import { Schema, type Mark, type Node } from 'prosemirror-model'
import { addressOf } from '../markdownText'

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
    /**
     * A numbered list, with the number it counts from. Typed numbers are kept: a list that was
     * written to start at three starts at three on the page and comes out of the editor the same.
     */
    ordered_list: {
      attrs: { start: { default: 1 } },
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ol', getAttrs: (dom) => ({ start: numberedBy(dom.getAttribute('start')) ?? 1 }) }],
      toDOM: (node) => (startOf(node) === 1 ? ['ol', 0] : ['ol', { start: String(startOf(node)) }, 0]),
    },
    /** One line of words and nothing else, because an item of a written list is one line: a
     *  list inside a list is not something a written text can say.
     *
     *  `number` is the number an item was written with where it is not the one after the item above
     *  it (`breakOf` in `markdownText.ts`), and nothing where it is: „1. 2. 4." keeps its four. */
    list_item: {
      attrs: { number: { default: null } },
      content: 'paragraph',
      defining: true,
      parseDOM: [{ tag: 'li', getAttrs: (dom) => ({ number: numberedBy(dom.getAttribute('value')) }) }],
      toDOM: (node) =>
        numberOfItem(node) === null ? ['li', 0] : ['li', { value: String(numberOfItem(node)) }, 0],
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
      /* A link that is dropped or pasted is asked what a link made in the box is asked
         (`linkableAddress`): where the answer is no, the rule does not match and the words of the
         link come in as the words they are. Without it a `javascript:` address, or one the page
         would draw as words, went into the text that is kept. */
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom) => {
            const href = dom.getAttribute('href')

            return href !== null && linkableAddress(href) ? { href } : false
          },
        },
      ],
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

/**
 * Which address a link may lead to: one of this portal, written with one slash, or one of another
 * site, written with `https://`, `http://` or `mailto:`, and no blank and no closing bracket in it,
 * which a written link cannot hold.
 *
 * Whether the page will draw it is asked of the page's own list (`addressOf`), so the editor never
 * makes a link the page would show as words. It is asked with the host check (PDL P15, 03.10.2026:
 * an address with an „@" or with letters outside ASCII in its host is text), which the terms and the
 * prizes of a competition make of every link. The editor does not know which text it writes, so a
 * link the page of a description would still draw is refused here too: the stricter of the two.
 *
 * Here and not with the commands because the schema asks it too, of every link a drop or a paste
 * brings in (`link.parseDOM`), and the commands import the schema and not the other way round.
 */
const LINKABLE = /^(?:https?:\/\/|mailto:|\/(?![/\\]))[^\s)]+$/

export function linkableAddress(address: string): boolean {
  return LINKABLE.test(address) && addressOf(address, true) !== undefined
}

/** A number as a pasted list says it (`start` of an `ol`, `value` of an `li`), or nothing where it
 *  says none or says what a written text cannot (`NUMBERED` in `markdownText.ts` reads nine digits
 *  at most). */
function numberedBy(said: string | null): number | null {
  return said !== null && /^(0|[1-9]\d{0,8})$/.test(said) ? Number(said) : null
}

/** The number a list counts from. An attribute of ProseMirror is untyped, so it is read as a number
 *  here and nowhere else. */
export function startOf(node: Node): number {
  return Number(node.attrs.start)
}

/** The number an item was written with, or nothing where it is the one after the item above. */
export function numberOfItem(node: Node): number | null {
  return node.attrs.number === null ? null : Number(node.attrs.number)
}

/** The hashes of a heading. An attribute of ProseMirror is untyped, so it is read as a number here
 *  and nowhere else. */
export function hashesOf(node: Node): number {
  return Number(node.attrs.hashes)
}

/** Where a link leads, read the same way. */
export function hrefOf(mark: Mark): string {
  return String(mark.attrs.href)
}
