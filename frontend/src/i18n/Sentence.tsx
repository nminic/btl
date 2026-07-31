import type { ReactNode } from 'react'

/**
 * A translated sentence with one React node standing where a placeholder is.
 *
 * The profile names the club inside a sentence and the club has to be a link:
 * "U klubu Dunavski trkači od 2018." Cutting that into a key for the words
 * before the link and a key for the words after would freeze Serbian word order
 * onto every language translated later, and a translator handed two halves of a
 * sentence cannot move the name where their language needs it.
 *
 * So the sentence stays one key with its placeholders, `translate` fills in
 * everything it has a value for, and whatever it leaves written stands as the
 * seam. That is the same rule the engine already follows for an unknown
 * placeholder: leave it visible rather than turn it into the word "undefined".
 */
export function Sentence({
  text,
  slot,
  children,
}: {
  /** Already translated, with `slot` still written in it. */
  text: string
  /** Placeholder name, without the braces. */
  slot: string
  children: ReactNode
}) {
  const marker = `{${slot}}`
  const at = text.indexOf(marker)

  /* A dictionary that has lost the placeholder still renders as a sentence,
     only without the link in it. The alternative is a screen that throws
     because somebody edited a translation. */
  if (at === -1) {
    return <>{text}</>
  }

  return (
    <>
      {text.slice(0, at)}
      {children}
      {text.slice(at + marker.length)}
    </>
  )
}
