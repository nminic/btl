import type { Ask } from '../session/context'
import type { Competitor, Team } from './types'
import { teamOf } from './derive'
import { inYearlyWindow } from './season'
import { teamAdminOf } from './teamAdmin'

/**
 * Why an application to join a team cannot be taken, or nothing where it can be.
 *
 * **Everything here is asked at the moment of the answer, not at the moment of the
 * question**, and that distinction is the whole reason this exists. An application waits in
 * an inbox, and between the asking and the answering the portal can change underneath it:
 * the team can be deleted, the person answering can stop being its administrator, the
 * member can join another team, and the transfer window can close. Written without this,
 * every one of those four was live (review, 05.09.2026), and the worst of them pulled a
 * member out of a team that had never been asked.
 *
 * **The shape is copied, not invented.** `pages/admin/teamProposal.ts` answers the same
 * question for the moderator's queue, in the same way and for the same reason: a key of the
 * dictionary or nothing, everything read through the session's layer by the caller, and the
 * screen that asks does nothing but draw the answer.
 */
export function joinRefusal(
  ask: Ask,
  /** Every team there is, read through the overlay by the caller, so a team deleted during
   *  this visit is gone here too. */
  teams: Team[],
  /** The members, read the same way, so „who administers this team" and „does this member
   *  have one" are the same answers the screens draw. */
  members: Competitor[],
  /** Whoever is answering. */
  deciding: string,
  /** The day it is being answered on. */
  today: string,
): string | null {
  const team = teams.find((one) => one.id === ask.teamId)

  if (team === undefined) {
    return 'teams.joinTeamGone'
  }

  const runs = teamAdminOf(team, members)

  /* A team can be left by everybody while a letter about it waits, and then nobody runs
     it. Said in its own words rather than through „this is not yours", which would tell
     the reader that somebody else decides when nobody does (review, 05.09.2026). */
  if (runs === null) {
    return 'teams.joinNobodyRuns'
  }

  if (runs !== deciding) {
    return 'teams.joinNotYours'
  }

  const asking = members.find((one) => one.memberNumber === ask.memberNumber)

  /* And whether there is anybody left to let in. Administration may delete a member, and
     the letter goes on waiting; taken then, the answer wrote a team onto a record that is
     gone, brought back the very edits the deletion had thrown away, and told an
     administrator a thing had been done that had not (review, 05.09.2026). */
  if (asking === undefined) {
    return 'teams.joinMemberGone'
  }

  if (teamOf(asking) !== null) {
    return 'teams.joinHasTeam'
  }

  /* The window, because the answer is what writes the season the member runs from, and
     `seasonOnSale` answers the next season only inside it. Answered in June, the same
     expression writes the running season, which puts the member into this year's team with
     every result they have already run this year (review, 05.09.2026). A team changes in
     one window and in no other (owner, 05.09.2026). */
  if (!inYearlyWindow(today)) {
    return 'teams.joinShut'
  }

  return null
}
