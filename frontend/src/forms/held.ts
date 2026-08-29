/**
 * What a control wears while the portal is holding it.
 *
 * **„Odbijeno, ne ugašeno" (PDL).** A held control stays in the keyboard's path
 * and says what it is in a word a screen reader reads, so the one thing left to
 * say is the one a reader who is looking rather than listening needs: this box is
 * an answer and not a question. The dress itself is a single rule, beside the
 * rule for a plain control (`FormRenderer.css`).
 *
 * **Why a function and not four strings.** Until 29.08.2026 the class was written
 * out at three places and forgotten at a fourth. Measured by a review on
 * 28.08.2026 in Chrome over the built stylesheet: on `unos-rezultata`, choosing a
 * race locks four fields, and the difference between the whole computed style of
 * the locked date and a live date was the empty set, while the locked number
 * beside it differed in its background and its cursor. Three fields went grey and
 * the fourth looked like a box somebody may type into. One fact with four homes
 * and a guard that knew of three (ADL A31).
 *
 * **What stays local, and deliberately.** Not this, but the question it answers.
 * Whether a given control is being held is a different question at every one of
 * them: the renderer holds what the form locked, the town holds what the form
 * locked, the country holds that **or** a country the codebook brought with the
 * town (owner, 23.08.2026: „Ukoliko se upari država prepoznavanjem mesta... postaje
 * potpuno disabled"), and the date holds what the form locked. Folding those four
 * into one condition would be inventing a fact rather than housing one.
 */
export function heldControl(held: boolean): string {
  return held ? 'field__control field__control--held' : 'field__control'
}
