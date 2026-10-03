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
     inside the prefix. The full stop of `www.` is itself closing punctuation, so without this a
     bare `www.` would be taken apart and its remainder judged as if it were an address. */
  const length = Math.max(rest.findLastIndex((one) => !CLOSING.test(one)) + 1, prefix)

  if (length === prefix) {
    return null
  }

  const core = rest.slice(0, length).join('')
  /* The scheme is written in front of `www.` here and nowhere else, so what the browser is given is
     the address as it was typed with a scheme the owner chose (https) and the text on the screen is
     still what was typed. */
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
