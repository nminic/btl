import { useEffect } from 'react'

/**
 * WHAT THE SCREEN SAYS ONCE A ROW IS GONE: „Tim je obrisan." (owner, 23.10.2026, PDL „Tri odgovora od
 * 23.10.2026": the deletion of a record asks and answers as the member's row does, and the member's row
 * says „Član je obrisan." on the screen, PDL „Brisanje člana na ekranu članova").
 *
 * <p><b>DRAWN, NOT ONLY SAID.</b> These four screens kept the sentence in a clipped region
 * (`visually-hidden`) for a reader who does not look at the list. The reader who does look saw the row go
 * and was told nothing: the sheet is closed, and the focus has moved to the control that starts a new
 * record.
 *
 * <p><b>ALWAYS ON THE PAGE AND FILLED WHEN IT IS TRUE</b>: a live region that appears with its words in
 * it is often not read, one that is already there and then gets them is. An empty one takes no room
 * (`Entity.css`).
 *
 * <p><b>THE LIST TAKES THE SENTENCE BACK WHEN IT GOES.</b> The words live in the screen, which outlasts
 * the list: the form of a record replaces the list while it is open, and a sentence left standing would
 * come back with the list, over a screen it is no longer about. The list is where this is drawn, so its
 * going is what puts the words away. The next deletion replaces them in the screen's own function.
 */
export function DeletionSaid({ said, clear }: {
  said: string
  /** Puts the words away; the screen's own setter, which does not change between renders. */
  clear: (words: string) => void
}) {
  useEffect(() => () => clear(''), [clear])

  return (
    <p role="status" className="entity-gone">
      {said}
    </p>
  )
}
