import { teamAdminOf } from './teamAdmin'
import type { Competitor, Team } from './types'
import type { Invitation } from '../session/context'

/**
 * What happens to every other team's invitation when somebody joins a club.
 *
 * The owner asked for it in one sentence on 06.09.2026: „kad član uđe u tim (ko
 * god da je poslao poziv), svi ostali pozivi za ostale timove se automatski
 * brišu", and the decision that followed says the notice goes out **whichever
 * road they took in** — accepting an invitation, or having their own application
 * accepted (PDL, 06.09.2026).
 *
 * **Why this is a module and not three copies.** There are three doors into a
 * club and each writes the same two fields: the member's own inbox
 * (`member/InvitationAnswer.tsx`), the team's page answering an application
 * (`TeamDetail.tsx`), and the moderator's queue approving a proposed team
 * (`admin/PendingQueue.tsx`). Written at the first of them only, the other two
 * left every other team waiting on a question that could no longer be answered
 * and nobody was told (review, 06.09.2026).
 *
 * **What it does not do is send anything.** It answers two questions — which
 * invitations stop being open, and who is told — and the screen does the writing.
 * A rule that returns an answer can be held against a case; a rule that writes
 * has to be watched.
 */
export function afterJoining({
  member,
  joined,
  keep,
  invitations,
  teams,
  competitors,
}: {
  /** Whose invitations these are. */
  member: string
  /** The club they are now in. */
  joined: string
  /**
   * The one invitation that is not closed, where there is one.
   *
   * The invitation somebody has just accepted stays open, and that is what lets
   * their own copy of the message say „you accepted this" rather than „you
   * joined somewhere else": closed, it would take the name of the team that
   * asked with it. It is kept out of the team's list of open questions by the
   * team's page, which drops anybody who now has a club.
   *
   * Nothing is kept when the member came in by another road, because then no
   * invitation was accepted and saying one was would be false.
   */
  keep: string | undefined
  invitations: Invitation[]
  teams: Team[]
  competitors: Competitor[]
}): { close: string[]; tell: string[] } {
  const theirs = invitations.filter((one) => one.memberNumber === member && one.id !== keep)

  return {
    close: theirs.map((one) => one.id),
    /* Told to whoever leads that team at this moment, worked out from its roster
       rather than remembered from whoever pressed „Pozovi": the notice is the
       team's business and not the typist's.

       Walked rather than found, twice, so „that team has been deleted" and „that
       team has nobody in it" need no question of their own: neither matches
       anything here and no recipient comes out, which is what the decision asks
       for („Tim koji nema nijednog člana ne dobija poruku, jer nema kome").

       And never the club they have just joined: that one either did the asking or
       did the accepting, so it is told nothing it does not already know. */
    tell: theirs
      .filter((one) => one.teamId !== joined)
      .flatMap((one) => teams.filter((team) => team.id === one.teamId))
      .flatMap((team) => {
        const lead = teamAdminOf(team, competitors)

        return lead === null ? [] : [lead]
      }),
  }
}
