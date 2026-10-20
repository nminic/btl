import { Fragment, type Mark, type Node } from 'prosemirror-model'
import { blocksOf, breakOf, escapeLineStart, escapeWords, inlineOf, startOf, type Inline } from '../markdownText'
import { hashesOf, hrefOf, numberOfItem, schema, startOf as startOfList } from './schema'

/*
 * THE TWO DIRECTIONS BETWEEN A WRITTEN TEXT AND WHAT THE EDITOR HOLDS.
 *
 * In: read by `markdownText.ts`, the same reading the public page draws from, so a text opened in
 * the editor shows what the page shows. Out: written back in the shape that reading understands,
 * and checked against it (`convert.test.ts` holds that what goes out reads back as what was held).
 */

/** The text nodes of a piece of a line, with the marks it carries. A line break inside a paragraph
 *  is a node of its own, which is the one way ProseMirror has of holding it. */
function nodesOf(pieces: Inline[], marks: readonly Mark[]): Node[] {
  return pieces.flatMap((piece): Node[] => {
    if (piece.kind === 'strong') {
      return nodesOf(piece.children, schema.marks.strong.create().addToSet(marks))
    }

    if (piece.kind === 'em') {
      return nodesOf(piece.children, schema.marks.em.create().addToSet(marks))
    }

    if (piece.kind === 'link') {
      return nodesOf(piece.children, schema.marks.link.create({ href: piece.url }).addToSet(marks))
    }

    /* A value between backticks carries the code mark; a mailbox is words like any other, because
       the editor holds what was typed and the page makes the link (`mails.ts` shows it as one). */
    const own = piece.kind === 'code' ? schema.marks.code.create().addToSet(marks) : marks

    return piece.text.split('\n').flatMap((line, index) => [
      ...(index === 0 ? [] : [schema.nodes.hard_break.create()]),
      ...(line === '' ? [] : [schema.text(line, own)]),
    ])
  })
}

/**
 * A line of a text, read as the page reads it, and not as a reader of the characters alone would.
 *
 * The editor does not know which of the texts it holds, so it reads as the strictest of those it
 * writes, and both are asked with a third argument that does not follow the second, so neither
 * stands in for the other:
 *
 * - **The mailboxes are asked for** (`'mail'`), because the page makes them before it reads italic:
 *   in `pera_peric@gmail.com ili mika_mikic@gmail.com` the underscores are in the names of two
 *   mailboxes and not the ends of an italic piece, and the editor that read them as one showed an
 *   italic the page does not draw and no link where the page draws two (PR 546). The sites are not
 *   asked for, which is what the description of an event does.
 * - **The host of the address under the words of a link is asked** (`true`), because the terms and
 *   the prizes of a competition and the description of an event ask it (PDL P15, 03.10.2026, and the
 *   answer of 17.10.2026), as the box for a link does (`linkableAddress`).
 *   `[x](https://www.runtrace.net@zlo.example)` is the words it was typed as, and not a link whose
 *   words say one host and whose address opens another. A written page asks nothing of its links,
 *   so a link of one that this refuses is words in the editor: the stricter of the two, as the box
 *   for a link already is.
 */
function line(text: string): Node[] {
  return nodesOf(inlineOf(text, 'mail', true), [])
}

/** What the editor holds for a text. Never empty: a document holds at least one paragraph. */
export function fromMarkdown(text: string): Node {
  const blocks = blocksOf(text).map((block): Node => {
    if (block.kind === 'heading') {
      return schema.nodes.heading.create({ hashes: block.hashes }, line(block.text))
    }

    if (block.kind === 'paragraph') {
      return schema.nodes.paragraph.create(null, line(block.lines.join('\n')))
    }

    if (block.kind === 'list') {
      /* The numbers a list was written with go in with it, so the editor writes the same numbers
         back (`blockOf`). A bulleted list has none to give. */
      const items = block.items.map((item, index) =>
        schema.nodes.list_item.create(
          { number: breakOf(block.numbers, index) ?? null },
          schema.nodes.paragraph.create(null, line(item)),
        ),
      )

      return block.ordered
        ? schema.nodes.ordered_list.create({ start: startOf(block.numbers) ?? 1 }, items)
        : schema.nodes.bullet_list.create(null, items)
    }

    const source = block.kind === 'table' ? block.source.join('\n') : block.source

    return schema.nodes.kept.create(null, schema.text(source))
  })

  return schema.nodes.doc.create(null, blocks.length === 0 ? schema.nodes.paragraph.create() : blocks)
}

/** The order in which the marks of a piece open, outermost first: the schema's own order. */
function rank(mark: Mark): number {
  return Object.keys(schema.marks).indexOf(mark.type.name)
}

/** How a mark opens and how it closes. */
function opening(mark: Mark): string {
  if (mark.type === schema.marks.link) {
    return '['
  }

  return mark.type === schema.marks.strong ? '**' : '_'
}

function closingOf(mark: Mark): string {
  if (mark.type === schema.marks.link) {
    return `](${hrefOf(mark)})`
  }

  return mark.type === schema.marks.strong ? '**' : '_'
}

/** One run of words with the marks it carries, or a line break. */
type Run = { text: string; marks: readonly Mark[] } | { text: '\n'; marks: null }

/**
 * The runs of a block of words.
 *
 * A value between backticks is written whole and never split by another mark, so it becomes words
 * of its own here: a run with the code mark is written between backticks at once, unless its words
 * hold a backtick, which a value cannot say, and then it is written as the words it is.
 *
 * Bold and italic may not open on a blank or close on one (an italic piece that begins with a blank
 * is not one, `markdownText.ts`), so a blank at either end of a marked run is moved outside the
 * marks, where it means the same on the screen.
 */
function runsOf(block: Node): Run[] {
  const runs: Run[] = []

  block.forEach((child) => {
    if (child.type === schema.nodes.hard_break) {
      runs.push({ text: '\n', marks: null })
      return
    }

    const text = child.textContent
    const code = schema.marks.code.isInSet(child.marks) !== undefined
    const marks = child.marks.filter((mark) => mark.type !== schema.marks.code)

    if (code && !text.includes('`')) {
      runs.push({ text: `\`${text}\``, marks })
      return
    }

    const lead = text.slice(0, text.length - text.trimStart().length)
    const words = text.slice(lead.length).trimEnd()
    const trail = text.slice(lead.length + words.length)
    const shaped = marks.filter((mark) => mark.type === schema.marks.link)

    if (lead !== '') {
      runs.push({ text: lead, marks: shaped })
    }

    if (words !== '') {
      runs.push({ text: escapeWords(words), marks })
    }

    if (trail !== '') {
      runs.push({ text: trail, marks: shaped })
    }
  })

  return runs
}

/** The words of a block, with the marks of every run opened and closed around it. */
function wordsOf(block: Node): string {
  const open: Mark[] = []
  let out = ''

  const closeTo = (depth: number) => {
    for (const mark of open.splice(depth).reverse()) {
      out += closingOf(mark)
    }
  }

  for (const run of runsOf(block)) {
    if (run.marks === null) {
      closeTo(0)
      out += run.text
      continue
    }

    const wanted = run.marks.toSorted((left, right) => rank(left) - rank(right))
    /* How many of the marks already open this run keeps, counted from the outermost: the first
       one that differs closes, and every mark inside it with it. */
    const differs = wanted.findIndex((mark, index) => !(open[index]?.eq(mark) ?? false))
    const same = differs === -1 ? wanted.length : differs

    closeTo(same)

    for (const mark of wanted.slice(same)) {
      out += opening(mark)
      open.push(mark)
    }

    out += run.text
  }

  closeTo(0)

  return out
}

/** The words of a block as one line, which is how a heading and an item of a list hold them. */
function oneLine(block: Node): string {
  return wordsOf(block).replace(/\n/g, ' ').trim()
}

/**
 * Whether a block of words writes as nothing: no word in it, whatever it holds (blanks, a line
 * break, marks around nothing).
 *
 * What the text that is written skips (`blockOf` writes no heading and no item for it), so what asks
 * whether a piece of the editor is empty asks this and not how much it holds: a piece with a blank
 * in it is not empty by its size and is written as nothing.
 */
export function isBlank(block: Node): boolean {
  return oneLine(block) === ''
}

/** A block of words written out, every line of it escaped where it begins. */
function paragraphOf(block: Node): string {
  return wordsOf(block)
    .split('\n')
    .map((one) => one.trim())
    .filter((one) => one !== '')
    .map((one, index) => escapeLineStart(one, index > 0))
    .join('\n')
}

function blockOf(block: Node): string {
  if (block.type === schema.nodes.heading) {
    const words = oneLine(block)

    return words === '' ? '' : `${'#'.repeat(hashesOf(block))} ${words}`
  }

  if (block.type === schema.nodes.bullet_list || block.type === schema.nodes.ordered_list) {
    const items: string[] = []
    /* The number the next item of a numbered list is written with: the one the list counts from,
       then one more for each, unless an item was written with a number of its own. */
    let number = block.type === schema.nodes.ordered_list ? startOfList(block) : 0

    block.forEach((item) => {
      const words = oneLine(item.child(0))

      if (words !== '') {
        number = numberOfItem(item) ?? number
        items.push(block.type === schema.nodes.ordered_list ? `${number}. ${words}` : `- ${words}`)
        number += 1
      }
    })

    return items.join('\n')
  }

  if (block.type === schema.nodes.kept) {
    return block.textContent.trim()
  }

  return paragraphOf(block)
}

/** The text of what the editor holds, or of a piece of it (a copy to the clipboard). */
export function toMarkdown(content: Fragment): string {
  const blocks: string[] = []

  content.forEach((block) => {
    const written = blockOf(block)

    if (written !== '') {
      blocks.push(written)
    }
  })

  return blocks.join('\n\n')
}

export { Fragment }
