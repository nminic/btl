/** What the biography is cut to, and why that number.
 *
 * The card is the third of three across one row and has to finish where the
 * other two finish (owner, 31.07.2026). What it has to match got shorter in the
 * same breath: the scoreboard beside it lost its heading and its race count, so
 * it is five rows now and not six with a title, which is about two hundred and
 * thirty pixels.
 *
 * At the width of a third of the row the card holds about forty characters to a
 * line, and the card's own heading takes the first thirty pixels, which leaves
 * room for nine lines. Nine times forty is three hundred and sixty.
 *
 * Cut at a word, never mid-word, and only ever as a safety net: the limit
 * belongs on the field the text is written in, and this is what protects the
 * layout from a row that arrives over length from somewhere else. */
const BIO_LIMIT = 360

export function shortBio(text: string): string {
  if (text.length <= BIO_LIMIT) {
    return text
  }

  const cut = text.slice(0, BIO_LIMIT)
  const lastSpace = cut.lastIndexOf(' ')

  return `${cut.slice(0, lastSpace === -1 ? BIO_LIMIT : lastSpace)}…`
}
