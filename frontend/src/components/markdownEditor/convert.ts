import { Fragment, type Mark, type Node } from 'prosemirror-model'
import { blocksOf, escapeLineStart, escapeWords, inlineOf, type Inline } from '../markdownText'
import { hashesOf, hrefOf, schema } from './schema'

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

    /* A value between backticks carries the code mark; a bare address is never met here, because
       the editor reads a text without asking for them (it holds what was typed, and the page makes
       the links). */
    const own = piece.kind === 'code' ? schema.marks.code.create().addToSet(marks) : marks

    return piece.text.split('\n').flatMap((line, index) => [
      ...(index === 0 ? [] : [schema.nodes.hard_break.create()]),
      ...(line === '' ? [] : [schema.text(line, own)]),
    ])
  })
}

function line(text: string): Node[] {
  return nodesOf(inlineOf(text, false), [])
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
      const type = block.ordered ? schema.nodes.ordered_list : schema.nodes.bullet_list

      return type.create(
        null,
        block.items.map((item) =>
          schema.nodes.list_item.create(null, schema.nodes.paragraph.create(null, line(item))),
        ),
      )
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

/** A block of words written out, every line of it escaped where it begins. */
function paragraphOf(block: Node): string {
  return wordsOf(block)
    .split('\n')
    .map((one) => escapeLineStart(one.trim()))
    .filter((one) => one !== '')
    .join('\n')
}

function blockOf(block: Node): string {
  if (block.type === schema.nodes.heading) {
    const words = wordsOf(block).replace(/\n/g, ' ').trim()

    return words === '' ? '' : `${'#'.repeat(hashesOf(block))} ${words}`
  }

  if (block.type === schema.nodes.bullet_list || block.type === schema.nodes.ordered_list) {
    const items: string[] = []

    block.forEach((item) => {
      const words = wordsOf(item.child(0)).replace(/\n/g, ' ').trim()

      if (words !== '') {
        items.push(block.type === schema.nodes.ordered_list ? `${items.length + 1}. ${words}` : `- ${words}`)
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
