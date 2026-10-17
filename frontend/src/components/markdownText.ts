import { addressesIn, CLOSING, opensAsTyped, OPENING } from '../pages/league/addressesIn'

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

/** One block of a text. `numbers` is, for an ordered list, the number each item was written with,
 *  one for every item and none for a bulleted list: a number that somebody typed is the one the page
 *  draws and the editor writes back, whatever its place in the list. `source` is the lines as they
 *  were written, for the blocks the editor
 *  keeps exactly as written (a table, a rule, the place of a drawing): the toolbar has no button
 *  for any of them, and a text that went through the editor must come out with them unchanged. */
export type Block =
  | { kind: 'heading'; hashes: number; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[]; numbers: number[] }
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
/** A number, a full stop and a blank: the number is captured. At most nine digits and no zero in
 *  front of them, so that the number read is the number written and nothing is lost in reading it
 *  (`007.` and a number of twenty digits are words, which is what they were typed as). */
const NUMBERED = /^(0|[1-9]\d{0,8})\.\s+(?=\S)/
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
export function addressOf(
  url: string,
  hostChecked: boolean,
): { inside: boolean; href: string } | undefined {
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

  if (url.startsWith('mailto:')) {
    return { inside: false, href: url }
  }

  if (url.startsWith('https://') || url.startsWith('http://')) {
    /* PDL P15, 03.10.2026: „Adresa sa „@" ili sa slovima van latinice u hostu ne postaje veza nego
       ostaje običan tekst". Said of an address of another site wherever it is written, so the
       address under the words of a link is asked what a bare address is asked (`opensAsTyped`),
       by the texts that make bare addresses links (the terms and the prizes of a competition) and
       by the editor that writes the links of every text. Elsewhere the list above is all that is
       asked, as it was. */
    return !hostChecked || opensAsTyped(url) !== undefined ? { inside: false, href: url } : undefined
  }

  return undefined
}

/** The number a numbered line was written with, or nothing when the line is not one. */
function numberOf(line: string): number | undefined {
  const marker = NUMBERED.exec(line)

  return marker === null ? undefined : Number(marker[1])
}

/**
 * Whether a numbered line begins a list, given whether words of a paragraph stand right above it.
 *
 * Anywhere else every numbered line does. Right under the words of a paragraph only a one does
 * (the rule of CommonMark, and the one the portal has always had for a one): „2026. godine je liga
 * počela." on a line of its own inside a paragraph is a sentence with a year in front of it and not
 * a list whose first item is „godine je liga počela." Read as a list, it lost its year. Asked by
 * `blocksOf` and by `escapeLineStart`, so a line is escaped exactly when it would be read as one.
 */
function opensAList(number: number | undefined, afterWords: boolean): number is number {
  return number !== undefined && (!afterWords || number === 1)
}

/** The number an ordered list is drawn from, or nothing where that is one, which is where a list
 *  starts when nothing is said. */
export function startOf(numbers: readonly number[]): number | undefined {
  return numbers[0] === 1 ? undefined : numbers[0]
}

/** The number an item is drawn with when it is not the one that follows the item above it, or
 *  nothing where it is (and for the first item, whose number is the start of the list). A number
 *  somebody typed is the number the page draws, so „1. 2. 4." is drawn as typed and not renumbered
 *  into „1. 2. 3." Asked by the page and by the editor, so they cannot disagree about where a list
 *  jumps. */
export function breakOf(numbers: readonly number[], index: number): number | undefined {
  const above = numbers[index - 1]
  const number = numbers[index]

  return above === undefined || number === above + 1 ? undefined : number
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

    const number = numberOf(line)
    const ordered = opensAList(number, open?.kind === 'paragraph')

    if (ordered || BULLET.test(line)) {
      // The item is the line with the mark that opened it taken off the front.
      const item = line.replace(ordered ? NUMBERED : BULLET, '')

      if (open?.kind !== 'list' || open.ordered !== ordered) {
        close()
        open = { kind: 'list', ordered, items: [], numbers: [] }
      }

      open.items.push(item)

      if (ordered) {
        open.numbers.push(number)
      }

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
 *  between backticks, and a link. Everything else is a character, to be read by `marked` below.
 *  `hostChecked` is whether the address of a link must also be one whose host, as typed, is the host
 *  that opens (`addressOf`). */
function unitsOf(text: string, hostChecked: boolean): Unit[] {
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
        const address = addressOf(String(url), hostChecked)

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

/** Whether a character may stand at the edge of a word without being part of an address in it: a
 *  mark of bold or italic, or the punctuation `addressesIn` already lets stand there. */
function edge(unit: Char | undefined, punctuation: RegExp): boolean {
  return unit !== undefined && (unit.marks || punctuation.test(unit.char))
}

/**
 * THE BARE ADDRESSES OF A LINE, AS LINKS (PDL P15, 03.10.2026): „Svaka adresa koja počinje sa
 * `www.` ili `https://` otvara se u novom prozoru, sa vidljivim domenom". Which words are addresses
 * is `addressesIn`'s to say and nobody else's.
 *
 * Asked BEFORE bold and italic are, so an address keeps every character it was typed with: an
 * underscore in its path is part of the address and not the start of an italic piece. Asked of the
 * words with the marks of bold and italic, and the punctuation that may stand around an address,
 * taken off their ends, so a bold address is still an address (`**www.runtrace.net**.`).
 */
function withAddresses(units: Unit[]): Unit[] {
  const out: Unit[] = []
  let word: Char[] = []

  const closeWord = () => {
    let from = 0
    let to = word.length

    while (from < to && edge(word[from], OPENING)) {
      from += 1
    }

    while (to > from && edge(word[to - 1], CLOSING)) {
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
 *  and the prizes of a competition ask for that, and for them the address under the words of a
 *  link has to pass what a bare address passes (PDL P15, 03.10.2026, „ostaje običan tekst").
 *  `hostChecked` asks that of the links alone, for a place that draws no bare address and has links
 *  all the same: the cells of a table in those texts. It follows `addresses` where it is not said. */
export function inlineOf(text: string, addresses: boolean, hostChecked: boolean = addresses): Inline[] {
  const units = unitsOf(text, hostChecked)
  const read = addresses ? withAddresses(units) : units

  return marked(read)
}

/**
 * A line of words, escaped where it begins if the line would otherwise be read as something it is
 * not: a heading, an item of a list, a rule, a row of a table.
 *
 * Asked of the very shapes `blocksOf` reads a line by, so a line is escaped exactly when it would be
 * read as one and never otherwise. Written by the editor (`markdownEditor/convert.ts`) over a line
 * whose words are already escaped, so a star or a bracket at its start is already words.
 *
 * `afterWords` is whether a line of the same paragraph stands above it: a number other than one
 * does not begin a list there (`opensAList`), so it is a number in a sentence and keeps its full
 * stop unescaped, as it was typed.
 */
export function escapeLineStart(line: string, afterWords: boolean): string {
  if (HEADING.test(line) || BULLET.test(line) || RULE.test(line) || ROW.test(line)) {
    return `\\${line}`
  }

  return opensAList(numberOf(line), afterWords) ? line.replace('.', '\\.') : line
}

/** The characters of words that would otherwise mark a piece of the line, escaped. */
export function escapeWords(text: string): string {
  return text.replace(/[*_`[\]]/g, '\\$&')
}
