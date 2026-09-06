import { teamOf } from '../../data/derive'
import { afterJoining } from '../../data/afterJoining'
import { inYearlyWindow, seasonOnSale } from '../../data/season'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { useToday } from '../../clock/useClock'
import type { Competitor, Team } from '../../data/types'

/**
 * The two buttons under an invitation, and the sentence that stands where they
 * were.
 *
 * This is the one message on the portal that asks rather than tells, and the
 * whole of what it remembers is which invitation it is about (`Message`). Every
 * other question it might be asked is worked out here, when it is drawn:
 *
 * - **May this still be answered?** Only while the invitation is open and the
 *   member has no team. Three teams may ask the same person on the same day and
 *   none of them knows about the others, so „already answered" cannot be a flag
 *   on any one of them (PDL, 06.09.2026).
 * - **If not, why not?** Read off where the member ended up, which is the same
 *   source the buttons were held against. Nothing is remembered about the
 *   answer, and nothing needs to be: joining the team that asked is an accepted
 *   invitation, joining another is being overtaken, and having no team at all
 *   after the question closed is a refusal.
 *
 * The message itself never goes away. Deleting somebody's mail would delete the
 * answer to „what happened to that invitation", which is the question this
 * screen exists to answer.
 */
export function InvitationAnswer({
  invitation: id,
  competitors,
  teams,
}: {
  invitation: string
  competitors: Competitor[]
  teams: Team[]
}) {
  const { t } = useI18n()
  const today = useToday()
  const { memberNumber, invitations, close, editRecord, notify } = useSession()

  const invitation = invitations.find((one) => one.id === id)
  /* The reader's team as the team itself rather than as its identity, so „they are
     in none" and „the one they name is not there" are one answer and not two. The
     second is a state nothing can reach, because deleting a team clears its
     identity off every record that named it. */
  const mine = teams.find(
    (one) => one.id === teamOf(competitors.find((each) => each.memberNumber === memberNumber)),
  )
  /* The name of whoever this invitation names, for the notice the other teams get.
     Joined rather than taken out of the list, so „the portal no longer has this
     member" needs no question of its own: nothing matches, the name is empty, and
     the loop that would use it has no team to write to either. */
  const mineName = competitors
    .filter((one) => one.memberNumber === memberNumber)
    .map((one) => `${one.firstName} ${one.lastName}`)
    .join('')

  if (invitation === undefined || mine !== undefined) {
    /* **Three sentences, and none of them is remembered.** An accepted invitation
       is one whose team the member is now in; a refused one is one that is closed
       while they are still in none; and being overtaken is having a team that is
       not the one this message is about. Nothing has to be written down when the
       button is pressed, which is what lets three teams ask the same person
       without any of them knowing about the others (PDL, 06.09.2026).

       The accepted one is the only invitation that is **not** closed, and that is
       what makes the first sentence possible: closed, it would take the name of
       the team that asked with it, and the message would say the member joined
       somewhere else. What keeps it out of the team's list of open questions is
       the team's own page, which drops anybody who now has a team, exactly as it
       does for applications. */
    return (
      <p className="messages__answered">
        {mine === undefined
          ? t('teams.inviteRefused')
          : t(mine.id === invitation?.teamId ? 'teams.inviteAccepted' : 'teams.inviteOvertaken', {
              team: mine.name,
            })}
      </p>
    )
  }

  /* A team that has been deleted since it asked cannot take anybody in, and the
     member is told so rather than handed a button that would put them in nothing.
     Named here rather than above, because until this line an invitation with no
     team is not different from one whose team is there. */
  const asking = teams.find((one) => one.id === invitation.teamId)

  if (asking === undefined) {
    return <p className="messages__answered">{t('teams.inviteGone')}</p>
  }

  /* **And only inside the transfer window, for the same reason the team's own page
     answers an application only there.** „Prihvati" writes the season the member
     runs for the club from, and `seasonOnSale` gives the next one only inside the
     window: pressed on 5 January the same line writes the season that is already
     running, and the member joins a squad in the middle of it and carries points
     to it (review, 06.09.2026). PDL 05.09.2026 puts everything that changes a
     squad through one door, and `transfersTakeEffect` says a transfer takes effect
     at the start of the next season and never during a running one.

     The invitation waits rather than lapsing, which is what the window is for: it
     is open again on 1 October, and until then this says so instead of offering a
     button. */
  if (!inYearlyWindow(today)) {
    return <p className="messages__answered">{t('teams.inviteWaits')}</p>
  }

  return (
    <p className="messages__answer">
      <button
        type="button"
        className="button button--secondary"
        onClick={() => {
          /* What the team's own page writes when it takes somebody in, and what
             the moderator's queue writes when it approves a proposed team: the
             team on the record and the season they run for it from, which is the
             next one (PDL, 05.09.2026). One fact by a third road, written the
             same way rather than a third way. */
          editRecord(invitation.memberNumber, {
            teamId: invitation.teamId,
            teamSince: String(seasonOnSale(today)),
          })

          /* **Every other team that asked is told, and its question is closed.** The rule
             itself is in `data/afterJoining.ts`, because there are three doors into a club
             and this is one of them: written only here, the other two left every other team
             waiting on a question nobody could answer (review, 06.09.2026). */
          const { close: ending, tell } = afterJoining({
            member: invitation.memberNumber,
            joined: invitation.teamId,
            keep: invitation.id,
            invitations,
            teams,
            competitors,
          })

          for (const id of ending) {
            close(id)
          }

          for (const to of tell) {
            notify({
              from: t('app.name'),
              to,
              subject: t('teams.inviteMissedSubject'),
              body: t('teams.inviteMissedBody', { name: mineName, team: asking.name }),
              date: today,
            })
          }
        }}
      >
        {t('teams.inviteAccept')}
      </button>{' '}
      <button
        type="button"
        className="button button--quiet"
        onClick={() => {
          close(invitation.id)
        }}
      >
        {t('teams.inviteRefuse')}
      </button>
    </p>
  )
}
