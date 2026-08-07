import type { EventRating } from '../../data/types'

/**
 * The overall mark, which PDL P6 says is arithmetic: the average of the three a
 * member gives.
 *
 * Worked out wherever it is shown rather than stored, so the four can never
 * disagree. Rounded to one decimal, which is what a number made of three whole
 * ones can honestly carry: written to two, 4,67 claims a precision that three
 * marks out of five do not have.
 *
 * In a file of its own because it is not a component, and a file that exports
 * both loses fast refresh for the components in it.
 */
export function overall(rating: EventRating): number {
  return Math.round(((rating.organisation + rating.value + rating.ambience) / 3) * 10) / 10
}

/**
 * Whether the overall can be worked out at all.
 *
 * All three, because that is what the overall is: PDL P6 defines it as the
 * average of the three a member gives, and an average of three where two were
 * never given is a number nobody said. A record of 5/0/0 read as "rated" drew
 * "Organizacija: 5 od 5", "Vrednost za novac: Bez ocene", "Ambijent: Bez ocene"
 * and "Ukupna ocena: 1,7" on one card, which is the very fault the form was
 * made to refuse (PDL, 07.08.2026) reappearing on the screen that reads the
 * record back.
 *
 * The marks that were given are still drawn as given. What is withheld is only
 * the figure that cannot be worked out, and it is withheld in the words the
 * portal already uses for a mark nobody gave.
 *
 * The form cannot produce a partial rating and the record can: it carries what
 * was written before the ratings existed, and it will carry whatever a backend
 * one day hands over.
 */
export function rated(rating: EventRating): boolean {
  return rating.organisation > 0 && rating.value > 0 && rating.ambience > 0
}
