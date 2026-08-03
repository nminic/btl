/**
 * How many rows a page of a long table holds (owner, 03.08.2026, PDL P24).
 *
 * Fifty, because that is the number the owner reads a standing in. It bounds the
 * one side of these tables that grows without limit: a competition has as many
 * rows as the league has members, and there is no number of members the portal
 * would refuse.
 *
 * It does not bound the columns, and no number here could. A competition of
 * forty six races is forty six columns whatever this says, so the width goes on
 * being answered the way every wide table on the portal answers it, by scrolling
 * inside its own box (`.table-scroll`).
 */
export const PER_PAGE = 50

/** Which page the address asks for, counted from one, and never past the end. */
export function pageFrom(asked: string | null, rows: number): number {
  const wanted = Number(asked)

  if (!Number.isInteger(wanted) || wanted < 1) {
    return 1
  }

  return Math.min(wanted, Math.max(1, Math.ceil(rows / PER_PAGE)))
}
