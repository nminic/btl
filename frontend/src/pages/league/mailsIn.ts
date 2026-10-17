import { CLOSING, OPENING, runsOf, type Found, type Piece } from './aroundAWord'

/**
 * THE ADDRESS OF A MAILBOX AS IT IS TYPED: a name, an `@` and a host, in ASCII.
 *
 * The name is letters, digits and `_`, `+` and `-`, with single full stops between them and none at
 * either end. The host is labels of letters, digits and `-`, never beginning or ending with `-`,
 * with at least one full stop between them, and its last label is two letters or more. Anything
 * else is words.
 *
 * **What follows is derived and is not the owner's word**, so each part of it is said here:
 *
 * 1. *ASCII and nothing else, the `@` once, and no `%` and no backslash.* PDL P15 (03.10.2026, and
 *    its addition of 17.10.2026) keeps an address with an „@" or with letters outside the Latin
 *    alphabet in its host as text, and says it holds for every link the editor makes. A mailbox has
 *    its `@` by nature, so what is asked of it is that the host behind that one `@` is what a
 *    browser hands the mail program, in the letters that were typed: one `@` more, a `%` escape or a
 *    letter outside ASCII would put another mailbox behind the same words, exactly as it would put
 *    another site behind a web address (`NOT_A_HOST_AS_TYPED` in `addressesIn.ts`). `š` and `ć`
 *    are outside ASCII here too, which is the boundary the web addresses already have.
 * 2. *A host with no full stop is not one* (`ime@primer` is words): nothing reaches a mailbox on a
 *    host of one label, and a sentence with an `@` in it is far likelier.
 * 3. *A word that begins with `www.` is never a mailbox.* `www.runtrace.net@zlo.example` is the very
 *    address PDL P15 decided stays words, and read as a mailbox it would be a link again.
 * 4. *Nothing behind the host*: no `?subject=` and no second address, so the link written is the
 *    address that was typed and nothing a reader does not see.
 */
const MAILBOX =
  /^[A-Za-z0-9_+-]+(?:\.[A-Za-z0-9_+-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/

/**
 * The link a typed mailbox becomes, `mailto:` and the mailbox as it was typed, or nothing where what
 * was typed is not one (`MAILBOX`).
 *
 * Asked by a mailbox typed into a text (`mailsIn` below), by one typed into the field Link of the
 * editor (`markdownEditor/commands.ts`, `hrefFor`) and by the address under the words of a link that
 * begins with `mailto:` wherever the host is checked (`components/markdownText.ts`, `addressOf`), so
 * the three cannot disagree about what is a mailbox.
 */
export function mailOf(typed: string): string | undefined {
  return MAILBOX.test(typed) && !/^www\./i.test(typed) ? `mailto:${typed}` : undefined
}

/**
 * THE MAILBOX IN ONE WORD, if the word is one, with the brackets and the quotation marks that open it
 * in front of it and the punctuation that closes a sentence behind it, read exactly as an address of
 * a site is (`OPENING`, `CLOSING`).
 */
function mailIn(word: string): Found | null {
  const chars = Array.from(word)
  const first = chars.findIndex((one) => !OPENING.test(one))
  const rest = chars.slice(Math.max(first, 0))
  const length = rest.findLastIndex((one) => !CLOSING.test(one)) + 1
  const core = rest.slice(0, length).join('')
  const href = first === -1 ? undefined : mailOf(core)

  return href === undefined
    ? null
    : { before: chars.slice(0, first).join(''), text: core, href, after: rest.slice(length).join('') }
}

/**
 * THE RUNS OF A TEXT WITH EVERY MAILBOX IN IT MARKED AS ONE, for the sentence the owner gave on
 * 17.10.2026 (PDL, „Ispravke sa ekrana 17.10.2026", chosen with my recommendation): „Slično važi i
 * za mailto tag, kad otkucam nešto nalik mail adresi, treba da ga pretvoriš automatski u link za
 * slanje maila."
 *
 * The same shape as `addressesIn` and the same rules about a word: a mailbox is a whole word, the
 * runs put back together are the text, and nothing is trimmed. Asked by the texts the editor writes
 * (the description of an event, the terms and the prizes of a competition) through
 * `components/markdownText.ts`, and never by a written page, which draws its text as it always did.
 * A mailbox inside the address of a site (`https://a.example/x@y.example`) is part of a word that is
 * not one, so it is words, or the link that address already is.
 */
export function mailsIn(text: string): Piece[] {
  return runsOf(text, mailIn)
}
