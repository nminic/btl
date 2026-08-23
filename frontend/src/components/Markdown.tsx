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
/** A row of a table, matched whole.
 *
 *  Exported because a guard over the written pages asks the same question and asked
 *  it with its own copy of this pattern until 23.08.2026, which is two homes for one
 *  fact: loosening this one to `/^\|/` there and here would have let a line that
 *  opens a row and never closes it be drawn as a row and read as prose at once, and
 *  nothing would have said so (pages/writtenPages.test.tsx). */
export const ROW = /^\|.*\|$/
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
  /* One slash is this portal. Two is another host, which a browser reads as a
     scheme-relative address and the router would turn into a path of ours;
     neither is what somebody writing a page meant.
   *
     A backslash is the same thing written the other way. A browser normalises
     `/\` to `//` before it resolves anything, so `/\primer.rs` is `https://primer.rs`.
     It was harmless while every path of ours went through the router, which made
     it the literal route `/sr/\primer.rs`; the moment a path could be served as
     written, it became a way for a page a moderator types to send a reader off
     the portal. Refused with the double slash, and refused means left as plain
     text, so nothing is swallowed quietly. Measured 22.08.2026. */
  if (url.startsWith('/') && !/^\/[/\\]/.test(url)) {
    /* A file served beside the application is not a route of it. The statute is
       linked from the terms as `/BTL%20Statut.pdf` (owner, 22.08.2026), and read
       as a page it became `/sr/BTL%20Statut.pdf`, which the router answers with
       the application shell: the reader would open the portal again instead of
       the document. An address that ends in a file extension is therefore served
       as it is written. It is still this host, because both ways of naming
       another one are refused above.
     *
       The extension is read where the path ends and not where the address does:
       a file carries a query or a fragment as readily as a page does, and
       anchored to the end of the whole, `/BTL%20Statut.pdf#strana=3` went back
       to being a route and the reader got the application shell again. Written
       as a look-ahead rather than by cutting the address first, because cutting
       leaves a branch for „no first piece", which a split cannot produce and no
       test can walk. */
    return { inside: !/\.[a-z0-9]{2,4}(?=$|[?#])/i.test(url), href: url }
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
 * Which tag a heading of that depth is drawn with.
 *
 * The four are written out rather than built from the number. `h${level}` is a
 * string as far as the compiler is concerned, so it had to be asserted to be a
 * heading tag, and ADL A14 bans that. What holds it to four is the shape at the
 * top of this file (`#{2,6}`) and the floor of three below it, which is two
 * facts in two other places; here it is one closed list, and a fifth tag cannot
 * be reached by accident.
 */
function headingTag(level: number): 'h3' | 'h4' | 'h5' | 'h6' {
  if (level <= 3) {
    return 'h3'
  }

  if (level === 4) {
    return 'h4'
  }

  return level === 5 ? 'h5' : 'h6'
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
      const value = part.slice(1, -1)

      /* Two things are written the same way and are not the same thing. An
         example inside a sentence is set in italic at the size of the sentence
         (Markdown.css, owner 03.08.2026); a blank the owner has still to fill in
         is a note to ourselves that happens to be on a public page, and it has
         to keep looking like one rather than turning into quiet prose. */
      return (
        <code key={index} className={value.startsWith('[TREBA POPUNITI') ? 'markdown__todo' : undefined}>
          {value}
        </code>
      )
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
    const Tag = headingTag(item.level)

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
