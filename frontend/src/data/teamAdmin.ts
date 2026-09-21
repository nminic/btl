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
 * **The founder only while they are still in it.** The seat is who founded the
 * team and never changes; being its administrator does. A moderator moving the
 * founder to another team empties the seat, and this says who takes it without
 * anybody being asked.
 *
 * **A moderator may still name somebody else** by writing that member's number
 * into `organizerMemberNumber` on the team, which is the field the administration
 * already edits. That is the whole of „sme da dodeli drugog": the standing rule
 * below is what happens when nobody does.
 *
 * **WHO SITS IN THE SEAT IS NOW ASKED IN TWO WORDS, NOT ONE, AND THAT IS THE
 * SWITCH TO `/api` RATHER THAN A SECOND RULE** (21.09.2026). `/api/teams` answers
 * `organizerMemberNumber` to the administration alone, because a member number is
 * not a thing Article 73 makes public (P-javno, 13.09.2026). Every other reader is
 * answered `foundedByMe`, which is that same fact reduced to what concerns them:
 * whether the seat is theirs.
 *
 * So the seat is read off whichever of the two this reader was given, and the rule
 * below is unchanged for both. The administration reads a number and may therefore
 * ask about anybody; a member reads a yes or a no and may therefore ask only about
 * himself, which is every question a member's screen has (`TeamDetail`, `EditTeam`).
 *
 * **The boundary, written here because nothing below can close it.** A member is
 * told „you did not found this" and cannot be told „and nobody else did either",
 * so when the seat is empty and the founder has left, a member's answer falls
 * through to the standing rule while the administration's does not have to. Both
 * answer the same member in every arrangement the portal can reach today, because
 * the standing rule is what the empty seat means; they part only on a seat held by
 * somebody who is not in the team, and that is `TeamApi`'s own open question rather
 * than one to settle here.
 *
 * @param reader the member asking, where one is asking. Nothing for the
 *               administration and for a visitor, both of which are answered by
 *               the seat itself or by neither field.
 */
export function teamAdminOf(
  team: Team,
  competitors: Competitor[],
  reader: string | null = null,
): string | null {
  const inTeam = competitors.filter((one) => one.teamId === team.id)

  /* Whichever of the two the answer carries, and never both: `foundedByMe` is
     absent unless somebody is signed in, and the number is absent unless they are
     the administration. Nothing where it is neither, which is a visitor, and a
     visitor draws no button this decides. */
  const seat = team.foundedByMe === true ? reader : (team.organizerMemberNumber ?? null)

  /* Still in the team, which is what makes this the seat rather than the record of
     who founded it. An empty string and a nothing are both „no member has this
     number" here, and neither needs a branch of its own: no member number is empty
     and none is missing (`Competitor.memberNumber`), so the comparison below is
     false for both without being asked twice. */
  const founder = inTeam.find((one) => one.memberNumber === seat)

  if (founder !== undefined) {
    return founder.memberNumber
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
