/**
 * The mark on the row that belongs to whoever is reading (owner, 05.08.2026).
 *
 * A table of forty is a wall of names, and the one name the reader came for is
 * their own. Every standing on the portal draws it the same way, so the mark is
 * one class and one rule (`table__mine` in src/styles/table.css) rather than a
 * decision taken again on each screen.
 *
 * Not on the charts. The owner drew the line there himself: a bar with a face
 * over it is already a picture of one person, and a fifth colour on it would be
 * a fifth thing to read.
 *
 * Nobody signed in is `null` rather than an empty string, which is a member
 * number nobody has: absence here means the portal is being read by a visitor,
 * and the difference decides whether any row is marked at all.
 */
/* For the rule behind the name below, which is this module's business: the name
   is handed out from here, and the screens that draw it never learn where it
   comes from (ADL A7). */
import '../styles/table.css'

export const MINE = 'table__mine'

/**
 * The class for a row about these people, read by `mine`.
 *
 * A list rather than one member number, because a row is not always about one
 * person: a pair on the top boards is two, and the owner asked for his own row
 * there as well "ukoliko sam u paru".
 */
export function mineIn(members: string[], mine: string | null): string | undefined {
  return mine !== null && members.includes(mine) ? MINE : undefined
}

/** The same, where a row is about one person, which is most of them. */
export function mineClass(memberNumber: string, mine: string | null): string | undefined {
  return mineIn([memberNumber], mine)
}

/**
 * The classes a row wears, as one attribute.
 *
 * A row can be on the podium and be the reader's own at the same time, and the
 * two marks are drawn by two rules. Written by hand it is
 * `[a, b].filter(Boolean).join(' ')` at each of the three call sites, and
 * `undefined` where there is nothing to say, because `class=""` is an attribute
 * that says nothing and still shows up in the markup.
 */
export function rowClass(...marks: (string | undefined)[]): string | undefined {
  const worn = marks.filter((one) => one !== undefined)

  return worn.length === 0 ? undefined : worn.join(' ')
}
