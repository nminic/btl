import { teamOf } from '../../data/derive'
import { teamAdminOf } from '../../data/teamAdmin'
import { seasonOnSale } from '../../data/season'
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

          /* **Every other team that asked is told, and its question is closed.**
             The owner asked for exactly this on 06.09.2026: „kad član uđe u tim
             (ko god da je poslao poziv), svi ostali pozivi za ostale timove se
             automatski brišu". The message in each of those inboxes stays; what
             ends is the question.

             Told to whoever leads that team at this moment, worked out from its
             roster rather than remembered from whoever pressed „Pozovi": the
             notice is the team's business, not the typist's, and a team with
             nobody in it has nobody to tell. */
          const others = invitations.filter(
            (one) => one.memberNumber === invitation.memberNumber && one.id !== invitation.id,
          )

          for (const other of others) {
            close(other.id)
          }

          /* Walked rather than found, three times over, so „that team is gone" and „the
             portal no longer has this member" need no question of their own: neither
             matches anything here and the body simply does not run, which is the same
             silence a team with nobody in it gets and for the same reason. Closing is
             done above and on its own, so it happens whatever the walk finds. */
          for (const who of competitors.filter(
            (one) => one.memberNumber === invitation.memberNumber,
          )) {
            for (const other of others) {
              for (const team of teams.filter((one) => one.id === other.teamId)) {
                const lead = teamAdminOf(team, competitors)

                if (lead === null) {
                  continue
                }

                notify({
                  from: t('app.name'),
                  to: lead,
                  subject: t('teams.inviteMissedSubject'),
                  body: t('teams.inviteMissedBody', {
                    name: `${who.firstName} ${who.lastName}`,
                    team: asking.name,
                  }),
                  date: today,
                })
              }
            }
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
