import { outsideLink } from '../../data/outsideLink'

/**
 * One run of a text: words exactly as somebody wrote them, or an address among those words that a
 * press should open.
 *
 * `text` is always what was written, character for character, so the runs of a text put back
 * together are that text and nothing else. `href` is where a press leads, and `null` for words.
 */
export type Piece = { text: string; href: string | null }

const HTTPS = 'https://'
const WWW = 'www.'

/**
 * What may stand in front of an address without being part of it: an opening bracket or a quotation
 * mark, in whichever of the usual typographies the text was written.
 *
 * **Asked of Unicode and never listed** (`Ps` open punctuation, `Pi` and `Pf` the quotation marks
 * of every language, and the two straight ones that Unicode files under `Po`). Serbian opens a quote
 * with `„` and closes it with `“`, which is a `Ps` and a `Pi`, and a list written from the keyboard
 * would have had the one and missed the other. The floor under this is a test that walks every code
 * point of those categories (`addressesIn.test.ts`).
 */
const OPENING = /^[\p{Ps}\p{Pi}\p{Pf}"']$/u

/**
 * What may stand behind an address without being part of it: a closing bracket, a quotation mark,
 * and the marks that end a sentence or a clause.
 *
 * Asked of Unicode for the same reason as `OPENING`, with the seven marks of a sentence written out
 * because Unicode files them under `Po` beside characters that an address legitimately ends in
 * (`/`, `%`, `&`, `#`). A slash is therefore **not** here: `www.runtrace.net/` is an address that
 * ends in a slash, and a sentence that ends is one that ends in a full stop.
 */
const CLOSING = /^[\p{Pe}\p{Pi}\p{Pf}"'.,;:!?…]$/u

/**
 * The scheme of an address and the slashes behind it, which a browser skips however many there are
 * and whichever way they lean: `https:///a.example` and `https://\\a.example` both open
 * `a.example`.
 *
 * What a browser reads as the host begins behind them, so the part asked about in `hostPartOf`
 * begins there too. Cut at the two slashes of `https://` alone, the address
 * `https:///www.runtrace.net@zlo.example` would have nothing in front of its first slash, the user
 * part that a browser reads out of it (user `www.runtrace.net`, host `zlo.example`) would never be
 * looked at, and it would be a link to `zlo.example` that is written as `www.runtrace.net`.
 * Measured on 03.10.2026.
 */
const BEHIND_THE_SCHEME = /^https:[/\\]*/

/**
 * Where the part of an address that says who is addressed ends: at the first `/`, `?` or `#`, the
 * three that end it in an address as it is written down (RFC 3986, section 3.2).
 *
 * **Not at a backslash, though a browser ends the host there as well.** A part that ends later than
 * the host it is about is looked at more, and one that ends sooner is looked at less. Cut where a
 * browser cuts, the `@` of `www.zlo.example\@www.runtrace.net` would stand outside the part and the
 * address would be a link (measured on 03.10.2026, with the rule cut that way): a browser reads it
 * as the address of `www.zlo.example`, with a path, and anybody who knows what stands in front of an
 * `@` reads it as the address of `www.runtrace.net`.
 */
const FROM_THE_FIRST_END = /[/?#].*/su

/**
 * What may not stand in that part, because a browser reads each of these as something other than
 * the characters that were typed.
 *
 * - `@` ends a user part, and what stands behind it is the host: `www.runtrace.net@zlo.example`
 *   opens `zlo.example`.
 * - `%` begins an escape, which a browser decodes in a host before it reads it: `%E2%88%95` opens
 *   the host that the character U+2215 opens, in letters that are all ASCII.
 * - `\` is a slash to a browser and a character of the host to a reader (see above).
 * - **Anything outside ASCII** is mapped to ASCII by a browser, and some of it to nothing: U+3164
 *   vanishes from the host, a Cyrillic letter that looks Latin turns the host into an `xn--` one,
 *   and the characters that look like a slash (U+2215, U+2044, U+29F8) are not one, so what
 *   follows them is part of the host.
 *
 * **Asked of the typed text and never of what a browser makes of it.** What a browser makes of the
 * host is ASCII in every case above (an `xn--` host, a host with a character dropped, the host that
 * stands behind an `@`), so the question „is the host ASCII" put to the parsed address is answered
 * yes for all of them.
 */
const NOT_A_HOST_AS_TYPED = /[@%\\\P{ASCII}]/u

/**
 * THE PART OF A TYPED ADDRESS THAT SAYS WHO IS ADDRESSED: a user part, if there is one, the host and
 * its port, and nothing of the path, the query or the fragment.
 *
 * Cut the way `BEHIND_THE_SCHEME` and `FROM_THE_FIRST_END` say, so that a path with letters outside
 * ASCII in it (`https://sr.wikipedia.org/wiki/Niš`) and an `@` that stands in a path
 * (`https://medium.com/@ime/post`) are not in it.
 */
function hostPartOf(core: string): string {
  return core.replace(BEHIND_THE_SCHEME, '').replace(FROM_THE_FIRST_END, '')
}

type Found = { before: string; text: string; href: string; after: string }

/**
 * THE ADDRESS IN ONE WORD, if the word holds one, with what stands in front of it and behind it.
 *
 * **Which words hold one is the owner's sentence and nothing wider** (03.10.2026, PDL P15, chosen
 * among the options offered): „Svaka adresa koja počinje sa `www.` ili `https://` otvara se u novom
 * prozoru". Two forms. `www.` in any case, because the case of a host name carries no meaning;
 * `https://` in lower case only, which is the one case the gate beneath (`outsideLink`) accepts, so
 * asking for more here would be a promise the gate does not keep.
 *
 * **`http://` is not one, and the `www.` inside `http://www.primer.rs` is not one either.** The word
 * begins with `http://`, and linking the part after it would put an address in front of a reader
 * that is not the one that was written: the scheme would quietly become `https`. The gate on its
 * own accepts `http://` (measured 03.10.2026, and held by `addressesIn.test.ts`), so this refusal is
 * the task of this function and of nothing beneath it.
 *
 * **What the gate does not ask, this asks.** Measured on the same day, the gate accepts
 * `https://www.` and `https://.` (an address with nothing in it) and `https://www.runtrace.net)`
 * (a closing bracket that belongs to the sentence), so a prefix with nothing after it is refused
 * here and the closing punctuation is taken off here, before the gate is asked.
 *
 * **And what the gate cannot tell from the words, this asks of the words as they were typed.** The
 * gate says yes to addresses whose host a browser reads otherwise than a reader does, which the
 * review of the change that made these words links measured on 03.10.2026:
 * `www.runtrace.net@zlo.example` opens `zlo.example`, Cyrillic letters in the name open an `xn--`
 * host, and a character that looks like a slash (U+2215, U+2044, U+29F8) or like nothing (U+3164,
 * U+2800) puts what follows it into the host. All of them are held, with the host a browser opens
 * for each, in `addressesIn.test.ts`.
 * The words of a link are the address as it was typed (`EditableText`), so they say the domain
 * only where the domain that was typed is the one that opens, and an address that does not pass
 * is words, the whole word of it with its brackets, as one the gate refuses is.
 *
 * **Decided on 03.10.2026, in the evening** (PDL P15, chosen among the options offered): an
 * address with an `@`, or with letters outside the Latin alphabet in its host, is not a link and
 * stays plain text. **What follows is derived from that and from the sentence PDL P15 keeps beside
 * it** („domen je sama otkucana adresa") **and is not the owner's word**, so each of the four
 * is said here and not left to be found:
 *
 * 1. *Which part is asked* is the one a browser reads as who is addressed (`hostPartOf`), and
 *    nothing behind the first `/`, `?` or `#`. The `@` that means something is the one that ends a
 *    user part, so an `@` in a path or a query (`https://medium.com/@ime/post`) is no refusal, and
 *    neither is a letter outside ASCII in one (`https://sr.wikipedia.org/wiki/Niš`): a path does not
 *    change which site opens.
 * 2. *`%` and `\` are asked too.* Both reach the hosts above while the typed text stays in ASCII,
 *    so without them the sentence beside the decision would be false for an address the decision
 *    does not name (measured on 03.10.2026: `%E2%88%95` opens what U+2215 opens, `%E3%85%A4` what
 *    U+3164 does).
 * 3. *„Outside the Latin alphabet" is read as outside ASCII.* It is the one reading that closes
 *    every measured address, and it has a cost the decision does not name: `š`, `č`, `ć`, `ž` and
 *    `đ`, which the Serbian Latin alphabet has, are outside ASCII, so a host that has one is text.
 *    Written here as a boundary, to be asked of the owner.
 * 4. *A number is a boundary.* `https://0x7f.1/` opens `127.0.0.1` and `https://3232235777/` opens
 *    `192.168.1.1`, and both stay links: what stands in the words is digits, which nobody reads as
 *    the name of a site, and telling it from the host that opens would take this function putting
 *    the address to a parser, which it does nowhere else (`addressesInAlone.test.ts` holds that
 *    what a browser may be given is the gate's judgement and nothing above it repeats it). Held as
 *    a case, so that closing it is a decision and not a side effect.
 */
function addressIn(word: string): Found | null {
  const chars = Array.from(word)
  const first = chars.findIndex((one) => !OPENING.test(one))

  /* A word made only of brackets and quotation marks, which is what `findIndex` answers -1 to. */
  if (first === -1) {
    return null
  }

  const rest = chars.slice(first)
  const start = rest.join('')
  const prefix = start.startsWith(HTTPS) ? HTTPS.length : /^www\./i.test(start) ? WWW.length : 0

  if (prefix === 0) {
    return null
  }

  /* Where the address stops: after the last character that is not closing punctuation, but never
     inside the prefix. The full stop of `www.` is itself closing punctuation, so without the floor
     a bare `www.` would be cut back to `www`, which is shorter than its own prefix. */
  const length = Math.max(rest.findLastIndex((one) => !CLOSING.test(one)) + 1, prefix)

  if (length === prefix) {
    return null
  }

  const core = rest.slice(0, length).join('')

  /* Words, and the whole word of them: the host as it was typed is not one that can be taken for
     the host that opens. Asked before the gate, and of `core` and not of the word, so that the
     punctuation taken off behind the address is not part of what is asked. */
  if (NOT_A_HOST_AS_TYPED.test(hostPartOf(core))) {
    return null
  }

  /* The scheme is written in front of `www.` here and nowhere else, so what the browser is given is
     the address with `https` in front of it, the scheme the owner's other form already names, and
     what is drawn on the screen is still what was typed. */
  const href = outsideLink(prefix === HTTPS.length ? core : `${HTTPS}${core}`)

  /* Nothing rather than a repaired address, which is the rule of the gate and holds here too: an
     address the gate refuses is words, and the whole word stays words, brackets and all. */
  if (href === undefined) {
    return null
  }

  return {
    before: chars.slice(0, first).join(''),
    text: core,
    href,
    after: rest.slice(length).join(''),
  }
}

/**
 * THE RUNS OF A TEXT THAT AN ADMINISTRATOR WROTE FOR A COMPETITION, with every address in it marked
 * as one.
 *
 * Written for the terms and the prizes of a competition, the two boxes on the list of competitions
 * (`pages/league/EditableText.tsx`), and for the sentence the owner gave on 03.10.2026 (PDL P15): the
 * paragraph of the terms of the RunTrace league has to carry `www.runtrace.net` as a link that opens
 * that portal in a window of its own. Before that day the two boxes drew their text and nothing
 * else.
 *
 * **What is returned is the text, cut where an address begins and where it ends, and never
 * changed.** The `text` of the runs put back together is the argument, character for character:
 * blanks, line breaks, brackets and the full stop after an address included. Nothing is trimmed,
 * nothing is collapsed, and nothing is turned into markup, because the terms of a league are not
 * moderated (PDL, 01.09.2026: „Administratorova reč stoji") and what a reader sees is therefore
 * whatever was typed. The caller draws every run as text, and only the addresses as links.
 *
 * **An address is a whole word.** A word is what stands between two blanks, a line break counting
 * as one, and an address ends where its word ends, less the punctuation that closes a sentence or
 * a bracket. It begins where its word begins, after the brackets and the quotation marks that may
 * open it. `ime@www.runtrace.net`, `pogledaj:www.runtrace.net` and `www` in the middle of another
 * word are not addresses, and neither is anything that begins with `http://`.
 *
 * **Nor is an address whose host, as it was typed, is not the host that opens.** One with a user
 * part (`www.runtrace.net@zlo.example`), a `%`, a backslash or a letter outside ASCII in the part in
 * front of its first `/`, `?` or `#` is words, all of the word, exactly as written; why, and how far
 * it goes, is said at `addressIn`.
 *
 * **Not done, and said so.** An address with a closing bracket of its own, such as
 * `https://sr.wikipedia.org/wiki/Trka_(sport)`, loses that bracket from the link, because a bracket
 * that closes the address and one that closes the sentence cannot be told apart without counting,
 * and not counting is the rule that was chosen on 03.10.2026. Two addresses with a comma and no blank
 * between them are one word and so one address, which the gate will refuse or accept as the single
 * thing it is. An address in angle brackets (`<https://primer.rs>`) is not recognised: `<` is not an
 * opening bracket in Unicode's sense, and the text it begins looks like markup, which is left alone.
 */
export function addressesIn(text: string): Piece[] {
  const pieces: Piece[] = []
  let words = ''

  const closeWords = (): void => {
    if (words !== '') {
      pieces.push({ text: words, href: null })
      words = ''
    }
  }

  /* `split` with a capturing group alternates what stands between blanks with the blanks themselves,
     so the even parts are the words and the odd ones are what to leave alone. */
  for (const [at, part] of text.split(/(\s+)/u).entries()) {
    const found = at % 2 === 0 ? addressIn(part) : null

    if (found === null) {
      words += part
    } else {
      words += found.before
      closeWords()
      pieces.push({ text: found.text, href: found.href })
      words = found.after
    }
  }

  closeWords()

  return pieces
}
