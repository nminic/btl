import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import './Markdown.css'

/* The written pages (rulebook, terms, privacy policy) are data, not code, and
 * they run to thousands of words with tables and sub-headings. Markdown is the
 * shape that survives the move from a JSON file to the database, so this is the
 * one place that turns it into elements.
 *
 * It is a deliberately small subset: sub-headings, paragraphs, lists, tables,
 * a rule, bold, code and links. Raw HTML is never interpreted and no string ever
 * reaches dangerouslySetInnerHTML, so nothing that ends up in the content can
 * put an element of its own on the page.
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'rule' }

/* What a line can be. Each shape says where the mark ends and nothing more, and
 * the piece that carries the text is cut out of the line itself: a capture group
 * hands its text back as something that might not be there, and answering for a
 * heading with no words on it is a decision that belongs to nobody, about a case
 * the shape has already ruled out. Every shape is read by one function, once. */
const RULE = /^-{3,}$/
const HEADING = /^#{2,6}\s+(?=\S)/
const BULLET = /^[-*]\s+(?=\S)/
const NUMBERED = /^\d+\.\s+(?=\S)/
const ROW = /^\|.*\|$/
const SEPARATOR = /^:?-{2,}:?$/
/* The one that does capture, because splitting on it is what the group is for:
 * it hands back the marked segments along with the plain text between them. */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g
/* The same three shapes, anchored. Splitting on INLINE hands back the marked
 * segments and the plain text between them in one array, and only a segment that
 * matches from end to end is markup: "**Važno" is a pair of stars somebody
 * wrote and never closed, and cutting two characters off it eats the text. */
const BOLD = /^\*\*[^*]+\*\*$/
const CODE = /^`[^`]+`$/
const LINK = /^\[[^\]]+\]\([^)\s]+\)$/

/* Which addresses a written page is allowed to point at.
 *
 * A page is content, and content is edited by a moderator, so the set of schemes
 * it may produce is closed here rather than trusted: a link is the one piece of
 * markup that can carry an instruction to the browser, and `javascript:` in a
 * page somebody else typed is a script on the portal. Anything outside this list
 * stays literal text, so nothing is silently swallowed either. */
function addressOf(url: string): { inside: boolean; href: string } | undefined {
  /* One slash is a page of this portal. Two is another host, which a browser
     reads as a scheme-relative address and the router would turn into a path of
     ours; neither is what somebody writing a page meant. */
  if (url.startsWith('/') && !url.startsWith('//')) {
    return { inside: true, href: url }
  }

  if (url.startsWith('mailto:') || url.startsWith('https://') || url.startsWith('http://')) {
    return { inside: false, href: url }
  }

  return undefined
}

/** The level of a heading and the words on it, or nothing when the line is not
 *  one. The level is how many hashes it opens with. */
function headingOf(line: string): { level: number; text: string } | undefined {
  const marker = HEADING.exec(line)

  if (marker === null) {
    return undefined
  }

  return {
    // A section already carries an h2, so the deepest a body may start is h3.
    level: Math.max(marker[0].trimEnd().length, 3),
    text: line.slice(marker[0].length),
  }
}

/**
 * The words of a link and the address under them, or nothing when the part is
 * not a link.
 *
 * The words hold no `]` (the shape above says so), so the first `](` in the part
 * is the one that separates the two, and both pieces are slices of the part
 * itself.
 */
function linkOf(part: string): { text: string; url: string } | undefined {
  if (!LINK.test(part)) {
    return undefined
  }

  const middle = part.indexOf('](')

  return { text: part.slice(1, middle), url: part.slice(middle + 2, -1) }
}

function cellsOf(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim())
}

/** Splits the text into blocks. One pass, line by line, no lookahead. */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let open: Block | undefined

  const close = () => {
    if (open !== undefined) {
      blocks.push(open)
      open = undefined
    }
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()

    if (line === '') {
      close()
      continue
    }

    if (RULE.test(line)) {
      close()
      blocks.push({ kind: 'rule' })
      continue
    }

    const heading = headingOf(line)

    if (heading !== undefined) {
      close()
      blocks.push({ kind: 'heading', ...heading })
      continue
    }

    if (ROW.test(line)) {
      const cells = cellsOf(line)

      if (open?.kind !== 'table') {
        close()
        open = { kind: 'table', rows: [] }
      }

      // The dashed line under the head carries no content of its own.
      if (!cells.every((cell) => SEPARATOR.test(cell))) {
        open.rows.push(cells)
      }

      continue
    }

    const ordered = NUMBERED.test(line)
    const mark = ordered ? NUMBERED : BULLET

    if (ordered || BULLET.test(line)) {
      // The item is the line with the mark that opened it taken off the front.
      const item = line.replace(mark, '')

      if (open?.kind !== 'list' || open.ordered !== ordered) {
        close()
        open = { kind: 'list', ordered, items: [] }
      }

      open.items.push(item)
      continue
    }

    if (open?.kind !== 'paragraph') {
      close()
      open = { kind: 'paragraph', lines: [] }
    }

    open.lines.push(line)
  }

  close()

  return blocks
}

/** Bold, code and links inside a line of text. Everything else stays literal, an
 *  unclosed marker included. */
function inline(text: string, locale: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (BOLD.test(part)) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }

    if (CODE.test(part)) {
      return <code key={index}>{part.slice(1, -1)}</code>
    }

    const link = linkOf(part)

    if (link !== undefined) {
      const address = addressOf(link.url)

      if (address === undefined) {
        return part
      }

      /* A page is written once and read in every language, so an address inside
         it is written without the language and gets it here (ADL A2). */
      return address.inside ? (
        <Link key={index} to={`/${locale}${address.href}`}>
          {link.text}
        </Link>
      ) : (
        <a key={index} href={address.href}>
          {link.text}
        </a>
      )
    }

    return part
  })
}

function Table({ rows, locale }: { rows: string[][]; locale: string }) {
  const [head, ...body] = rows

  // A table that held nothing but the dashed line under the head has no rows
  // left once that line is dropped.
  if (head === undefined) {
    return null
  }

  // A table whose first row is empty everywhere is a list of facts in two
  // columns, not a table with a head. An empty head row would only add noise.
  const hasHead = head.some((cell) => cell !== '')

  return (
    <div className="table-scroll">
      <table className="table markdown__table">
        {hasHead && (
          <thead>
            <tr>
              {head.map((cell, index) => (
                <th key={index} scope="col">
                  {inline(cell, locale)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) => (
                <td key={index}>{inline(cell, locale)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function block(item: Block, key: number, locale: string): ReactNode {
  if (item.kind === 'rule') {
    return <hr key={key} />
  }

  if (item.kind === 'heading') {
    const Tag = `h${item.level}` as 'h3' | 'h4' | 'h5' | 'h6'

    return <Tag key={key}>{inline(item.text, locale)}</Tag>
  }

  if (item.kind === 'list') {
    const items = item.items.map((text, index) => <li key={index}>{inline(text, locale)}</li>)

    return item.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>
  }

  if (item.kind === 'table') {
    return <Table key={key} rows={item.rows} locale={locale} />
  }

  /* The lines of a paragraph are kept as they were written and broken by the
     style sheet, not by markup: an address and a signature need their breaks,
     and a paragraph that is one text node stays one string for the reader and
     for search. */
  return <p key={key}>{inline(item.lines.join('\n'), locale)}</p>
}

/** Renders one body of written text. */
export function Markdown({ text }: { text: string }) {
  const { locale } = useI18n()

  return (
    <div className="markdown">
      {parseBlocks(text).map((item, key) => block(item, key, locale))}
    </div>
  )
}
