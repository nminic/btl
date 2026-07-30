import type { Moderator } from '../data/types'

/**
 * A moderator by initials rather than by name (owner, 30.07.2026).
 *
 * A select is as wide as its widest choice, and one of the four is called
 * Aleksandra Milovanović-Stefanović, which was pushing the rest of the header
 * onto a second line. Every part of a double surname keeps its
 * letter and its stop, so `A. M.-S.` is still nobody else.
 *
 * The full name goes on the choice as its title, which is a tooltip and nothing
 * more: an option is named to a screen reader by its own text, so what is read
 * out is the initials. That is the cost of the width, and it is one a control no
 * member ever sees can pay.
 */
export function initialsOf(moderator: Moderator): string {
  const surname = moderator.lastName
    .split('-')
    .map((part) => `${part.charAt(0)}.`)
    .join('-')

  return `${moderator.firstName.charAt(0)}. ${surname}`
}
