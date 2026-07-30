import type { Moderator } from '../data/types'

/**
 * A moderator by initials rather than by name (owner, 30.07.2026).
 *
 * A select is as wide as its widest choice, and one of the four is called
 * Aleksandra Milovanović-Stefanović, which was pushing the rest of the header
 * onto a second line. Every part of a double surname keeps its letter, so
 * A. M-S. is still nobody else.
 *
 * The full name is on the control as its title, so hovering says who it is, and
 * it is what a screen reader is given for the chosen one: the switch is a
 * development control, but a control nobody can read is one nobody can use.
 */
export function initialsOf(moderator: Moderator): string {
  const surname = moderator.lastName
    .split('-')
    .map((part) => `${part.charAt(0)}.`)
    .join('-')

  return `${moderator.firstName.charAt(0)}. ${surname}`
}
