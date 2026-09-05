import type { Competitor, Team } from './types'

/**
 * Who administers a team: the member who founded it, or whoever stands in when
 * that seat is empty.
 *
 * Owner, 04.09.2026: „Administrator tima je onaj ko je tim osnovao. Kad se mesto
 * isprazni, po podrazumevanom ga preuzima član koji je najduže u timu, dakle
 * najraniji `teamSince`, a kod izjednačenja manji broj člana. Moderator ili
 * administrator sme da dodeli drugog kad primeti da je mesto prazno."
 *
 * **Worked out rather than stored**, from two fields the record already carries.
 * A second field naming the administrator would be a second home for a fact the
 * roster already answers, and it would go stale the day somebody leaves: the
 * founder of a team can leave it, and then the record still names them.
 *
 * **The founder only while they are still in it.** `organizerMemberNumber` is
 * who founded the team and never changes; being its administrator does. A
 * moderator moving the founder to another team empties the seat, and this says
 * who takes it without anybody being asked.
 *
 * **A moderator may still name somebody else** by writing that member's number
 * into `organizerMemberNumber` on the team, which is the field the administration
 * already edits. That is the whole of „sme da dodeli drugog": the standing rule
 * below is what happens when nobody does.
 */
export function teamAdminOf(team: Team, competitors: Competitor[]): string | null {
  const inTeam = competitors.filter((one) => one.teamId === team.id)

  if (inTeam.some((one) => one.memberNumber === team.organizerMemberNumber)) {
    return team.organizerMemberNumber
  }

  /* Longest in the team, and the smaller number where two arrived the same year.
     A member with no year at all is last rather than first: the type says a team
     and a year travel together (`teamSince`), so a missing one is a record that
     has lost something rather than somebody who has been there forever, and
     reading it as the earliest of all would hand the team to whoever is most
     broken. */
  const ordered = [...inTeam].sort(
    (left, right) =>
      (left.teamSince ?? Infinity) - (right.teamSince ?? Infinity) ||
      left.memberNumber.localeCompare(right.memberNumber),
  )

  return ordered[0]?.memberNumber ?? null
}
