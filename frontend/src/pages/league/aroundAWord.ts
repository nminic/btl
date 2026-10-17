/*
 * WHAT A TEXT OF THE ADMINISTRATION IS READ BY, BEFORE ANYBODY ASKS WHETHER A WORD OF IT IS AN ADDRESS.
 *
 * Shared by the addresses of a site (`addressesIn.ts`, PDL P15) and the addresses of a mailbox
 * (`mailsIn.ts`, PDL „Ispravke sa ekrana 17.10.2026"), so the two cut a text into words, and read what
 * may stand in front of a word and behind it, the same way. The type and the two kinds of
 * punctuation were moved out of `addressesIn.ts` on 17.10.2026 as they were, and the cutting into
 * words is the loop `addressesIn` had, made a function both ask. Here and not there so the
 * mailboxes can be read without importing the module whose every reader has to draw a link of a site
 * left to right (`pages/league/linkDirection.test.tsx`).
 */

/**
 * One run of a text: words exactly as somebody wrote them, or an address among those words that a
 * press should open.
 *
 * `text` is always what was written, character for character, so the runs of a text put back
 * together are that text and nothing else. `href` is where a press leads, and `null` for words.
 */
export type Piece = { text: string; href: string | null }


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
export const OPENING = /^[\p{Ps}\p{Pi}\p{Pf}"']$/u

/**
 * What may stand behind an address without being part of it: a closing bracket, a quotation mark,
 * and the marks that end a sentence or a clause.
 *
 * Asked of Unicode for the same reason as `OPENING`, with the seven marks of a sentence written out
 * because Unicode files them under `Po` beside characters that an address legitimately ends in
 * (`/`, `%`, `&`, `#`). A slash is therefore **not** here: `www.runtrace.net/` is an address that
 * ends in a slash, and a sentence that ends is one that ends in a full stop.
 */
export const CLOSING = /^[\p{Pe}\p{Pi}\p{Pf}"'.,;:!?…]$/u

/** An address found in a word, with what stands in front of it and behind it in the same word. */
export type Found = { before: string; text: string; href: string; after: string }

/** The runs of a text, with every word that `find` finds an address in cut where that address
 *  begins and ends. Shared by the addresses of a site and the addresses of a mailbox, so the two
 *  read a word, and what may stand around it, the same way. */
export function runsOf(text: string, find: (word: string) => Found | null): Piece[] {
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
    const found = at % 2 === 0 ? find(part) : null

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
