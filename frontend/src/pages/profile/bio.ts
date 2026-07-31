/** What the biography is cut to, and why that number.
 *
 * The card stands in a column beside the scoreboard and the donut and has to
 * finish where they finish. At the widest the column holds about fifty
 * characters a line and about twelve lines of body text before it is taller than
 * the scoreboard beside it, so six hundred (owner's own preference, 30.07.2026:
 * a limit rather than a scrollbar inside a card).
 *
 * Cut at a word, never mid-word, and only ever as a safety net: the limit
 * belongs on the field the text is written in, and this is what protects the
 * layout from a row that arrives over length from somewhere else. */
const BIO_LIMIT = 600

export function shortBio(text: string): string {
  if (text.length <= BIO_LIMIT) {
    return text
  }

  const cut = text.slice(0, BIO_LIMIT)
  const lastSpace = cut.lastIndexOf(' ')

  return `${cut.slice(0, lastSpace === -1 ? BIO_LIMIT : lastSpace)}…`
}
