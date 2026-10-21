import { addressesIn } from '../pages/league/addressesIn'

/**
 * THE WORDS OF A MEMBER, WITH EVERY ADDRESS IN THEM DRAWN AS A LINK THE MODERATOR MAY PRESS (PDL P9,
 * 03.10.2026): „A u tekstu ako se nalazi link, da taj link moderator moze da klikne -> Dakle
 * prepoznavanje linka kao u opisu lige. [...] Ovo treba da vazi na svim slanjima rezultata."
 *
 * <p><b>Which words are addresses is `addressesIn`'s to say and nobody else's</b>, the same
 * question the terms and the prizes of a competition are asked (PDL P15), so the two cannot
 * disagree: a word that begins with `www.` or `https://` and whose host, as it was typed, is the
 * host that opens. An address that does not pass (`www.runtrace.net@zlo.example`, a Cyrillic
 * letter in the name, `http://`) is words, all of the word, exactly as written, and so is every
 * other word the member typed. Nothing is rewritten and nothing is trimmed: the text of what is
 * drawn is the text that was sent, character for character.
 *
 * <p><b>Not Markdown, on purpose.</b> The member's words are plain words, and a text that is read
 * as Markdown lets a member put words of his own over an address (`[www.runtrace.net](https://zlo.example)`),
 * which the owner has not decided for this box. Only the bare address is recognised.
 *
 * <p>Drawn as the bare address of a competition's text is (`components/Markdown.tsx`): a window of
 * its own, `rel` written out so the page on the other end is not told which administrative screen
 * the moderator came from and cannot reach back through `window.opener`, the address as it was
 * typed for its words so the host is visible, and `dir="ltr"` so it is drawn in the order it was
 * typed (`pages/league/linkDirection.test.tsx` says why).
 */
export function AddressesAsLinks({ text }: { text: string }) {
  return (
    <>
      {addressesIn(text).map((piece, index) =>
        piece.href === null ? (
          piece.text
        ) : (
          <a key={index} href={piece.href} target="_blank" rel="noreferrer noopener" dir="ltr">
            {piece.text}
          </a>
        ),
      )}
    </>
  )
}
