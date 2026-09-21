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
 * **WHAT THIS ANSWERS SINCE 21.09.2026, SAID NARROWLY, because it used to answer
 * two questions and one of them it cannot.** This is „who administers this team",
 * a fact about the TEAM, and it is answered off the seat the ANSWER carries.
 * `/api/teams` gives `organizerMemberNumber` to the administration alone, because a
 * member number is not a thing Article 73 makes public (P-javno, 13.09.2026). So
 * this is whole for the administration, and for everybody else it is the standing
 * rule alone - which is the right answer to „is there anybody here to decide" and
 * the WRONG answer to „may I decide".
 *
 * **„May I decide" is `readerAdministers` below, and the split is a security fix
 * rather than tidiness.** Measured 21.09.2026: read through this, a member who had
 * NOT founded a team was handed its administrator's controls, because a member is
 * not told who sits in the seat and this fell through to the standing rule. A
 * definite „no" became „maybe yes". The two questions are separated so that the one
 * about a permission can be definite and the one about a recipient can go on being
 * a best guess.
 */
export function teamAdminOf(team: Team, competitors: Competitor[]): string | null {
  const inTeam = competitors.filter((one) => one.teamId === team.id)

  /* The seat as the ANSWER gives it, and nothing where the reader was not told:
     an empty string („nobody holds it"), a JSON null („somebody with no number
     holds it") and the key being absent („not for you") all fail the comparison
     below without a branch of their own, because no member number is any of the
     three. */
  const seat = team.organizerMemberNumber ?? null
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

/**
 * WHETHER THIS READER MAY ADMINISTER THIS TEAM, and it is the question every screen
 * with a control on it actually asks.
 *
 * **Why it is not `teamAdminOf(...) === reader`, which is what it was until
 * 21.09.2026 and was a hole.** That reads the seat, and a member is not told who sits
 * in it: `/api/teams` gives `organizerMemberNumber` to the administration alone and
 * answers everybody else `foundedByMe` (P-javno, 13.09.2026, and `TeamApi`). With no
 * seat to read, the comparison fell through to the standing rule - „whoever has been
 * here longest takes an empty seat" - and handed the team to a member who had not
 * founded it and whose seat was held by somebody else. Measured on a team whose seat
 * names one member while another has been in it longer: the second was given the
 * whole edit screen, and with it the way to delete the team and to decide who joins.
 *
 * **So the three readers are answered by three different facts, and each is
 * definite.**
 *
 * - **A member** is answered `foundedByMe`, which says exactly „the seat is yours" or
 *   „the seat is not yours". `false` is a NO and never a maybe: it does not say
 *   whether the seat is empty, so the standing rule may not be reached for it.
 * - **The administration** is answered the seat itself, so the whole rule can be
 *   worked out and compared.
 * - **A visitor** is answered neither, and draws no control this decides.
 *
 * **The founder only while they are still in it**, which is the half `foundedByMe`
 * cannot carry on its own: it compares the seat to the caller's key and says nothing
 * about the roster, and a moderator moving the founder to another team empties the
 * seat without changing that field.
 *
 * **What this costs, written down rather than left to be found.** A member who did
 * not found a team can no longer take an empty seat by having been there longest, and
 * that is the half of the owner's rule of 04.09.2026 the answer cannot reach.
 * `TeamApi` names the same gap from its own side: „what is still owed is the same
 * question asked by a MEMBER, who is answered `foundedByMe` and nothing else". It is
 * in `PENDING.md` as a question for the owner rather than settled here, and the safe
 * side is the one taken meanwhile.
 */
export function readerAdministers(
  team: Team,
  competitors: Competitor[],
  reader: string | null,
): boolean {
  if (reader === null) {
    return false
  }

  if (team.foundedByMe !== undefined) {
    /* A member. The seat is his or it is not, and „his" still needs him in the team:
       the field is about the seat and says nothing about the roster. */
    return (
      team.foundedByMe &&
      competitors.some((one) => one.teamId === team.id && one.memberNumber === reader)
    )
  }

  /* The administration, which was given the seat and can have the whole rule worked
     out. A visitor reaches neither line, having been sent away above. */
  return teamAdminOf(team, competitors) === reader
}
