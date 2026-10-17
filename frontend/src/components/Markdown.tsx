import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { blocksOf, breakOf, inlineOf, startOf, type Block, type Inline } from './markdownText'
import './Markdown.css'

/* The written pages (rulebook, terms, privacy policy) are data, not code, and they run to
 * thousands of words with tables and sub-headings. Markdown is the shape that survives the move
 * from a JSON file to the database, so this is the one place that turns it into elements. Since
 * 16.10.2026 it draws the other texts of the administration as well (the description of an event,
 * the terms and the prizes of a competition), because the owner chose that they are written the
 * same way (PDL, „Ispravke sa ekrana 16.10.2026").
 *
 * What a text says is read by `markdownText.ts`, which the editor reads it through too, so what is
 * drawn here is what the editor showed. Raw HTML is never interpreted and no string ever reaches
 * dangerouslySetInnerHTML, so nothing that ends up in the content can put an element of its own on
 * the page.
 */

/** Re-exported, because a guard over the written pages asks the same question
 *  (pages/writtenPages.test.tsx) and has always asked it of this module. */
export { ROW } from './markdownText'

/**
 * Which tag a heading of that depth is drawn with.
 *
 * Written out rather than built from the number. `h${level}` is a string as far as the compiler is
 * concerned, so it had to be asserted to be a heading tag, and ADL A14 bans that.
 */
function headingTag(level: number): 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  if (level <= 2) {
    return 'h2'
  }

  if (level === 3) {
    return 'h3'
  }

  if (level === 4) {
    return 'h4'
  }

  return level === 5 ? 'h5' : 'h6'
}

/**
 * The level a heading of a text is drawn at, under the heading the text stands beneath.
 *
 * A written page stands under the heading of its section (an h2), and since it was written `##` and
 * `###` are both an h3 there and `####` an h4: a body never goes above the level under its own
 * heading. That rule is kept exactly, and only moved by where the text stands: the description of
 * an event stands under the name of the event (an h1), the terms of a competition under the heading
 * of their box (an h3). Six is the deepest there is.
 */
function levelOf(hashes: number, under: number): number {
  return Math.min(6, Math.max(hashes + under - 2, under + 1))
}

/** How the links of a text open. */
type Reading = {
  locale: string
  /** Whether a link to another site opens in a window of its own. */
  outward: boolean
}

/**
 * A link to another site, or to a file of this one.
 *
 * In a window of its own where the text asks for it, which is the shape of every link to an outside
 * page on the screens these texts stand on: the organiser's page beside the description of an event
 * (`pages/EventDetail.tsx`) and the addresses in the terms of a competition (PDL P15). `rel` is
 * written out rather than left to what a browser does for `_blank`, so the other end is not told
 * which page the reader came from and cannot reach back through `window.opener`.
 */
function outsideLink(key: number, href: string, words: ReactNode, reading: Reading): ReactNode {
  return reading.outward ? (
    <a key={key} href={href} target="_blank" rel="noreferrer noopener">
      {words}
    </a>
  ) : (
    <a key={key} href={href}>
      {words}
    </a>
  )
}

function inline(pieces: Inline[], reading: Reading): ReactNode[] {
  return pieces.map((piece, index) => {
    if (piece.kind === 'text') {
      return piece.text
    }

    if (piece.kind === 'strong') {
      return <strong key={index}>{inline(piece.children, reading)}</strong>
    }

    if (piece.kind === 'em') {
      return <em key={index}>{inline(piece.children, reading)}</em>
    }

    if (piece.kind === 'code') {
      /* Two things are written the same way and are not the same thing. An example inside a
         sentence is set in italic at the size of the sentence (Markdown.css, owner 03.08.2026); a
         blank the owner has still to fill in is a note to ourselves that happens to be on a public
         page, and it has to keep looking like one rather than turning into quiet prose. */
      return (
        <code key={index} className={piece.text.startsWith('[TREBA POPUNITI') ? 'markdown__todo' : undefined}>
          {piece.text}
        </code>
      )
    }

    if (piece.kind === 'address') {
      /* A bare address of the terms or the prizes of a competition (PDL P15): a new window, the
         address as it was typed for its words, so the domain is visible, and `dir="ltr"` so it is
         drawn in the order it was typed (`pages/league/linkDirection.test.tsx` says why). */
      return (
        <a key={index} href={piece.href} target="_blank" rel="noreferrer noopener" dir="ltr">
          {piece.text}
        </a>
      )
    }

    const words = inline(piece.children, reading)

    /* A page is written once and read in every language, so an address inside it is written
       without the language and gets it here (ADL A2). */
    return piece.inside ? (
      <Link key={index} to={`/${reading.locale}${piece.url}`}>
        {words}
      </Link>
    ) : (
      outsideLink(index, piece.url, words, reading)
    )
  })
}

function Table({
  rows,
  reading,
  addresses,
}: {
  rows: string[][]
  reading: Reading
  addresses: boolean
}) {
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
                  {inline(inlineOf(cell, false, addresses), reading)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) => (
                <td key={index}>{inline(inlineOf(cell, false, addresses), reading)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function block(
  item: Block,
  key: number,
  reading: Reading,
  under: number,
  addresses: boolean,
): ReactNode {
  if (item.kind === 'rule') {
    return <hr key={key} />
  }

  if (item.kind === 'heading') {
    const Tag = headingTag(levelOf(item.hashes, under))

    return <Tag key={key}>{inline(inlineOf(item.text, addresses), reading)}</Tag>
  }

  if (item.kind === 'list') {
    /* An ordered list is drawn with the numbers it was written with: from the first one, and with
       the number of an item that does not follow the item above it. A list that counts from one
       carries neither, so it is drawn as it always was. */
    const items = item.items.map((text, index) => (
      <li key={index} value={breakOf(item.numbers, index)}>
        {inline(inlineOf(text, addresses), reading)}
      </li>
    ))

    return item.ordered ? (
      <ol key={key} start={startOf(item.numbers)}>
        {items}
      </ol>
    ) : (
      <ul key={key}>{items}</ul>
    )
  }

  if (item.kind === 'table') {
    return <Table key={key} rows={item.rows} reading={reading} addresses={addresses} />
  }

  /* The place of a drawing, met outside a written page: the words it is. */
  if (item.kind === 'marker') {
    return <p key={key}>{item.source}</p>
  }

  /* The lines of a paragraph are kept as they were written and broken by the style sheet, not by
     markup: an address and a signature need their breaks, and a paragraph that is one text node
     stays one string for the reader and for search. */
  return <p key={key}>{inline(inlineOf(item.lines.join('\n'), addresses), reading)}</p>
}

/** Renders one body of written text. */
export function Markdown({
  text,
  under = 2,
  addresses = false,
  outward = false,
}: {
  text: string
  /**
   * The level of the heading the text stands under, so its own headings start one below it. Two
   * for a section of a written page, which is what every text was drawn under until 16.10.2026.
   */
  under?: number
  /** Whether its bare addresses are links (PDL P15, the terms and the prizes of a competition). */
  addresses?: boolean
  /** Whether a link to another site opens in a window of its own. */
  outward?: boolean
}) {
  const { locale } = useI18n()
  const reading = { locale, outward }

  return (
    <div className="markdown">
      {blocksOf(text).map((item, key) => block(item, key, reading, under, addresses))}
    </div>
  )
}
