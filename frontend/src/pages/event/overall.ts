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
