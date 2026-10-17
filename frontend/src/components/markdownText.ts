import { addressesIn } from '../pages/league/addressesIn'

/* WHAT A WRITTEN TEXT SAYS, READ ONCE, FOR EVERY READER OF IT.
 *
 * The written pages have been Markdown since they were written (`Markdown.tsx`), and since
 * 16.10.2026 the three texts of the administration are too: the description of an event, the
 * terms and the prizes of a competition, and the written pages themselves (PDL, „Ispravke sa
 * ekrana 16.10.2026": „Uređivač je „vidiš šta dobijaš" ... tekst se čuva kao Markdown, isto kao
 * pisane strane"). Two readers read it: the screen that draws it (`Markdown.tsx`) and the editor
 * that writes it (`markdownEditor/`). Both read it through this file and nothing else, so what the
 * editor shows while somebody writes is what the page draws once it is kept: a second parser beside
 * this one would be the one place where the two could disagree, and the person who would see it is
 * the reader of the public page, not the one who typed.
 *
 * It is a deliberately small subset: sub-headings, paragraphs, lists, tables, a rule, bold,
 * italic, code and links. Raw HTML is never interpreted, and nothing here produces anything but
 * data: no string ever reaches `dangerouslySetInnerHTML`, so nothing that ends up in a text can put
 * an element of its own on the page.
 */

/** One block of a text. `source` is the lines as they were written, for the blocks the editor
 *  keeps exactly as written (a table, a rule, the place of a drawing): the toolbar has no button
 *  for any of them, and a text that went through the editor must come out with them unchanged. */
export type Block =
  | { kind: 'heading'; hashes: number; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; rows: string[][]; source: string[] }
  | { kind: 'rule'; source: string }
  | { kind: 'marker'; source: string }

/** One piece of a line. `address` is a bare address drawn as a link (PDL P15), and only a reader
 *  that asks for them gets one. */
export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; url: string; inside: boolean; children: Inline[] }
  | { kind: 'address'; text: string; href: string }

/* Where in a written page its drawing stands. A line holding nothing but this is taken out of the
 * words and the drawing takes its place (`PageSectionBody.tsx`). Here because the editor has to
 * keep the line exactly as it is: written as text, a bracket would be escaped and the mark lost. */
export const MARKER = '[[gallery]]'

/* What a line can be. Each shape says where the mark ends and nothing more, and the piece that
 * carries the text is cut out of the line itself. */
const RULE = /^-{3,}$/
const HEADING = /^#{2,6}\s+(?=\S)/
const BULLET = /^[-*]\s+(?=\S)/
const NUMBERED = /^\d+\.\s+(?=\S)/
/** A row of a table, matched whole.
 *
 *  Exported because a guard over the written pages asks the same question
 *  (pages/writtenPages.test.tsx), and one pattern moves both readers at once. */
export const ROW = /^\|.*\|$/
const SEPARATOR = /^:?-{2,}:?$/

/**
 * The characters a backslash makes literal.
 *
 * The five that mark a piece of a line (`*`, `_`, `` ` ``, `[`, `]`) and the four that mark a line
 * when it begins with them (`#`, `-`, `.` after a number, `|`). Nothing else: a backslash in front of
 * any other character is a backslash, so `C:\Users` and an address with a backslash in it
 * (`addressesIn.ts`, which refuses those on purpose) are drawn as they were typed.
 *
 * **The backslash itself is not one of them, and that is deliberate.** An address an administrator
 * typed as `https://\\a.example` has to be drawn as typed, both slashes of it, because a browser reads
 * it as an address of another host and the reader has to be able to see that
 * (`test/misleadingAddresses.ts`). The cost is one text that cannot be written: a backslash standing
 * immediately in front of a bold or an italic piece. Said here rather than left to be found.
 */
export const ESCAPABLE = new Set(['*', '_', '`', '[', ']', '#', '-', '.', '|'])

/* Which addresses a text is allowed to point at.
 *
 * A text is content, and content is edited by an administrator, so the set of schemes it may
 * produce is closed here rather than trusted: a link is the one piece of markup that can carry an
 * instruction to the browser, and `javascript:` in a text somebody else typed is a script on the
 * portal. Anything outside this list stays literal text, so nothing is silently swallowed either. */
export function addressOf(url: string): { inside: boolean; href: string } | undefined {
  /* One slash is this portal. Two is another host, which a browser reads as a scheme-relative
     address and the router would turn into a path of ours; neither is what somebody writing a page
     meant.
   *
     A backslash is the same thing written the other way. A browser normalises `/\` to `//` before
     it resolves anything, so `/\primer.rs` is `https://primer.rs`. Refused with the double slash,
     and refused means left as plain text, so nothing is swallowed quietly. Measured 22.08.2026. */
  if (url.startsWith('/') && !/^\/[/\\]/.test(url)) {
    /* A file served beside the application is not a route of it. The statute is linked from the
       terms as `/BTL%20Statut.pdf` (owner, 22.08.2026), and read as a page it became
       `/sr/BTL%20Statut.pdf`, which the router answers with the application shell. An address that
       ends in a file extension is therefore served as it is written. The extension is read where
       the path ends and not where the address does, so a query or a fragment behind it does not
       turn it back into a route. */
    return { inside: !/\.[a-z0-9]{2,4}(?=$|[?#])/i.test(url), href: url }
  }

  if (url.startsWith('mailto:') || url.startsWith('https://') || url.startsWith('http://')) {
    return { inside: false, href: url }
  }

  return undefined
}

/** The hashes of a heading and the words on it, or nothing when the line is not one. */
function headingOf(line: string): { hashes: number; text: string } | undefined {
  const marker = HEADING.exec(line)

  if (marker === null) {
    return undefined
  }

  return { hashes: marker[0].trimEnd().length, text: line.slice(marker[0].length) }
}

function cellsOf(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim())
}

/** Splits a text into blocks. One pass, line by line, no lookahead. */
export function blocksOf(text: string): Block[] {
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
      blocks.push({ kind: 'rule', source: line })
      continue
    }

    /* A line of its own. `PageSectionBody` takes it out of a written page before this is ever
       asked, so on a screen it is only ever met in a text that is not a written page, where it is
       drawn as the words it is. */
    if (line === MARKER) {
      close()
      blocks.push({ kind: 'marker', source: line })
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
        open = { kind: 'table', rows: [], source: [] }
      }

      open.source.push(line)

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

/** A character of a line, or a piece of it that is already whole. `marks` is whether an unescaped
 *  `*` or `_` may open or close a piece: one written behind a backslash never does. */
type Char = { char: string; marks: boolean }
type Unit = Char | { piece: Inline }

/** The words of a link, the address under them, and how much of the line the two take.
 *
 *  The words may hold an escaped bracket, which is how the editor writes one; the address holds no
 *  blank and no closing bracket, which is the shape a written page has always had. */
const LINK = /\[((?:\\.|[^\]\\])+)\]\(([^)\s]+)\)/y

/** The pieces that are whole the moment they are found: an escaped character, a value written
 *  between backticks, and a link. Everything else is a character, to be read by `marked` below. */
function unitsOf(text: string): Unit[] {
  const units: Unit[] = []
  let at = 0

  while (at < text.length) {
    const char = text.charAt(at)
    const next = text.charAt(at + 1)

    if (char === '\\' && ESCAPABLE.has(next)) {
      units.push({ char: next, marks: false })
      at += 2
      continue
    }

    if (char === '`') {
      const end = text.indexOf('`', at + 1)

      /* An empty pair is two backticks somebody wrote, and an unclosed one is one: both stay
         literal, so nothing is swallowed. */
      if (end > at + 1) {
        units.push({ piece: { kind: 'code', text: text.slice(at + 1, end) } })
        at = end + 1
        continue
      }
    }

    if (char === '[') {
      LINK.lastIndex = at
      const link = LINK.exec(text)

      /* A link to an address the list above refuses is the words somebody wrote, every character
         of them, and not a link with its address quietly dropped. The groups are read as strings:
         the shape has both, so neither is ever missing. */
      if (link !== null) {
        const [whole, words, url] = link
        const address = addressOf(String(url))

        if (address !== undefined) {
          units.push({
            piece: {
              kind: 'link',
              url: String(url),
              inside: address.inside,
              children: inlineOf(String(words), false),
            },
          })
          at += whole.length
          continue
        }
      }
    }

    units.push({ char, marks: char === '*' || char === '_' })
    at += 1
  }

  return units
}

/** Whether the unit is a character that may open or close a piece, and which one. */
function marksWith(unit: Unit | undefined, char: string): boolean {
  return unit !== undefined && 'char' in unit && unit.marks && unit.char === char
}

/** Whether the unit is a blank, which an italic piece may not begin or end with. */
function blank(unit: Unit | undefined): boolean {
  return unit !== undefined && 'char' in unit && /\s/u.test(unit.char)
}

/**
 * THE BARE ADDRESSES OF A LINE, AS LINKS (PDL P15, 03.10.2026): „Svaka adresa koja počinje sa
 * `www.` ili `https://` otvara se u novom prozoru, sa vidljivim domenom". Which words are addresses
 * is `addressesIn`'s to say and nobody else's.
 *
 * Asked BEFORE bold and italic are, so an address keeps every character it was typed with: an
 * underscore in its path is part of the address and not the start of an italic piece. Asked of the
 * words with the marks of bold and italic taken off their ends, so a bold address is still an
 * address (`**www.runtrace.net**`).
 */
function withAddresses(units: Unit[]): Unit[] {
  const out: Unit[] = []
  let word: Char[] = []

  const closeWord = () => {
    let from = 0
    let to = word.length

    while (from < to && (marksWith(word[from], '*') || marksWith(word[from], '_'))) {
      from += 1
    }

    while (to > from && (marksWith(word[to - 1], '*') || marksWith(word[to - 1], '_'))) {
      to -= 1
    }

    /* Every unit of a word is a character (a whole piece ends the word), one code unit each, so
       the text and the units line up place for place and a run of the text is a run of units. */
    const middle = word.slice(from, to)
    const pieces = addressesIn(middle.map((unit) => unit.char).join(''))

    out.push(...word.slice(0, from))

    let offset = 0

    for (const piece of pieces) {
      if (piece.href === null) {
        out.push(...middle.slice(offset, offset + piece.text.length))
      } else {
        out.push({ piece: { kind: 'address', text: piece.text, href: piece.href } })
      }

      offset += piece.text.length
    }

    out.push(...word.slice(to))
    word = []
  }

  for (const unit of units) {
    /* A word is a run of characters between two blanks; a piece that is already whole ends one,
       since the words of a link are never an address of their own. */
    if ('piece' in unit || blank(unit)) {
      closeWord()
      out.push(unit)
    } else {
      word.push(unit)
    }
  }

  closeWord()

  return out
}

/** The first place from `from` on where `char` closes a piece, or -1. Bold is two of them. */
function closing(units: Unit[], from: number, char: string, twice: boolean): number {
  return units.findIndex(
    (unit, at) => at >= from && marksWith(unit, char) && (!twice || marksWith(units[at + 1], char)),
  )
}

/**
 * Bold and italic over the units, each of them a piece that may hold the other.
 *
 * Bold is `**` on both sides and italic is `_`, and the two are different characters on purpose:
 * with `*` for both, a piece that is bold and italic at once is `***` on each side, and which star
 * closes what can no longer be read off the line. An italic piece may not begin or end with a blank,
 * so `a _ b _ c` is the words somebody typed. Unclosed marks stay literal, so `**Važno` keeps its
 * stars rather than losing them.
 */
function marked(units: Unit[]): Inline[] {
  const out: Inline[] = []
  let words = ''
  /* Where the next unit to read is, once a piece has taken the ones before it. */
  let next = 0

  const closeWords = () => {
    if (words !== '') {
      out.push({ kind: 'text', text: words })
      words = ''
    }
  }

  for (const [at, unit] of units.entries()) {
    if (at < next) {
      continue
    }

    if ('piece' in unit) {
      closeWords()
      out.push(unit.piece)
      continue
    }

    if (marksWith(unit, '*') && marksWith(units[at + 1], '*')) {
      const end = closing(units, at + 3, '*', true)

      if (end !== -1) {
        closeWords()
        out.push({ kind: 'strong', children: marked(units.slice(at + 2, end)) })
        next = end + 2
        continue
      }
    }

    if (marksWith(unit, '_') && !blank(units[at + 1])) {
      const end = closing(units, at + 2, '_', false)

      if (end !== -1 && !blank(units[end - 1])) {
        closeWords()
        out.push({ kind: 'em', children: marked(units.slice(at + 1, end)) })
        next = end + 1
        continue
      }
    }

    words += unit.char
  }

  closeWords()

  return out
}

/** The pieces of a line. `addresses` turns its bare addresses into links (PDL P15); only the terms
 *  and the prizes of a competition ask for that. */
export function inlineOf(text: string, addresses: boolean): Inline[] {
  const units = unitsOf(text)
  const read = addresses ? withAddresses(units) : units

  return marked(read)
}

/** Which of the characters above, at the start of a line, would make the line something it is not:
 *  a heading, an item of a list, a row of a table, a rule. Escaped by the editor, so a line that
 *  begins with one is the words it was typed with. */
export function escapeLineStart(line: string): string {
  if (/^#/.test(line) || /^-/.test(line) || /^\|/.test(line)) {
    return `\\${line}`
  }

  return line.replace(/^(\d+)\.(?=\s)/, '$1\\.')
}

/** The characters of words that would otherwise mark a piece of the line, escaped. */
export function escapeWords(text: string): string {
  return text.replace(/[*_`[\]]/g, '\\$&')
}
