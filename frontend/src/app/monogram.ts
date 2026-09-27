/**
 * The last two of whatever identifies somebody, for a circle with no person behind it.
 *
 * This is what the header draws for an ACCOUNT rather than a member: administration, which
 * has no competitor record at all (PDL P21), somebody who has registered and is not a member
 * yet (ADL A44), and a signed in member for the moment before his own record has arrived.
 *
 * **IT TOOK A `Competitor` AND RETURNED INITIALS UNTIL 27.09.2026, and that half is gone
 * rather than left standing.** It was the SECOND home of „what letters stand in a member's
 * circle": `components/Portrait.tsx` had the same two letters out of the same two fields. The
 * day the header moved onto `Portrait` (PDL P28f: the approved photograph must reach „gornjem
 * desnom zaglavlju ulogovanog korisnika"), the only caller left passes no member at all, so
 * that branch became unreachable from every screen while a unit test went on calling it
 * directly - which is the one shape a coverage threshold cannot see, because the line is
 * covered and the branch is dead.
 *
 * So what is left here answers one question and has one caller. A member's letters, and a
 * member's colour, and a member's picture, are `Portrait`'s and nowhere else's.
 */
export function monogramFor(identifier: string): string {
  return identifier.slice(-2)
}
