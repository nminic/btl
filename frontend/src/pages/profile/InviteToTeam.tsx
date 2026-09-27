import { teamOf } from '../../data/derive'
import { inYearlyWindow } from '../../data/season'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { useToday } from '../../clock/useClock'
import type { Competitor, Team } from '../../data/types'

/**
 * „Pozovi u tim", on somebody else's profile.
 *
 * The other half of „Prijavi se u tim", which lives on the team's own page, and
 * the two are deliberately not symmetrical. An application is decided by whoever
 * leads the team at the moment it is answered, so it waits where that role is
 * worked out; an invitation is decided by one named person who has no reason to
 * visit the team's page at all, so it goes to their inbox and the button that
 * starts it stands where somebody would be looking at them (PDL, „Gde stoji
 * odluka", 06.09.2026).
 *
 * **WHO SEES IT IS AN OVERTURNED RULE THAT THIS SCREEN STILL ENFORCES, AND THAT IS
 * A DEFECT NAMED RATHER THAN A RULE EXPLAINED.** What stood here said „any member
 * of a team, not only whoever leads it", on the owner's parenthesis „(bilo koji
 * član)" of 05.09.2026. **He overturned it on 27.09.2026** (`PDL.md:8703`),
 * choosing between three offered outcomes: „Samo administrator tima, kako pise u
 * Pravilniku." Article 53 of the rulebook had said so all along, and the conflict
 * was found by reading it in order to translate it.
 *
 * The server followed that day: `TeamJoiningWriteApi.invite` and its `takeBack` ask
 * `heAdministersThisTeam` and answer 404 to a member who merely stands in the team.
 * **This screen did not**, and the line below still picks the reader's team by
 * MEMBERSHIP alone, with no notion of a seat, so it offers the button to every
 * member of a team. The route refuses them, so nothing wrong can be written through
 * it; what is wrong is a button that leads to a 404.
 *
 * **What the fix is and why it is not here.** One line, `readerAdministers` from
 * `data/teamAdmin.ts` — the portal's one answer to „may I decide about this team",
 * which `TeamDetail.tsx` already reads, so the precedent is in the portal. Measured
 * 27.09.2026: made on its own it turns **24 of the 35 cases** in
 * `pages/teamInvite.test.tsx` red, because `000007` is the inviter through the whole
 * walk and he does not hold Dunavski trkači's seat. Two of those cases also explain
 * themselves by an axis the reversal REMOVES — „the notice goes to the role and not
 * to whoever typed" — which is a re-measurement and not an actor swap, since the one
 * who sends and the one who leads are now the same seat. That is its own increment
 * and it is recorded as outstanding rather than half done here.
 *
 * **When: inside the transfer window, and only about somebody with no team.**
 * The same window that governs founding a team, so everything that changes who
 * is in which team happens through one door rather than two (owner, 05.09.2026).
 *
 * There is no condition against inviting yourself, and that is not an omission:
 * the reader has a team and the member being read has none, so they cannot be
 * the same person. Written here because the absent check is the kind of thing a
 * later reader adds back.
 */
export function InviteToTeam({
  competitor,
  competitors,
  teams,
}: {
  competitor: Competitor
  competitors: Competitor[]
  teams: Team[]
}) {
  const { t } = useI18n()
  const today = useToday()
  const { memberNumber: reader, invitations, invite, notify } = useSession()

  /* **THE READER'S TEAM BY MEMBERSHIP, WHICH IS THE OVERTURNED RULE THE NOTE ABOVE
     NAMES.** It should be `readerAdministers(one, competitors, reader)`; it is not,
     for the cost measured in that note, and the note says what the button does to a
     member who is not the administrator today.

     The reader's team as the team itself and not as its identity, so „they are in
     no team" and „the team they name is not there" are one question with one
     answer. Asked as two, the second is a state nothing on the portal can reach,
     because deleting a team clears the identity off every record it named.

     Nobody signed in is the same question again: no record answers to `null`, so
     there is no team, and the line below draws nothing. A guard of its own above
     this was measured to be dead on 06.09.2026 — removed rather than left,
     because a guard nothing can reach is a guard nobody can be sure still
     works. */
  const team = teams.find(
    (one) => one.id === teamOf(competitors.find((each) => each.memberNumber === reader)),
  )

  if (team === undefined || teamOf(competitor) !== null || !inYearlyWindow(today)) {
    return null
  }

  /* **One question per team, asked once.** An application cannot be doubled,
     because the button that files it is drawn only when the member has none
     waiting anywhere. An invitation can: it is sent without the other person
     saying anything, so the same team could fill the same inbox with the same
     question every day (PDL, 06.09.2026). What stands here instead is that it
     was already asked, which is also the answer to „did my press register". */
  const asked = invitations.some(
    (one) => one.teamId === team.id && one.memberNumber === competitor.memberNumber,
  )

  if (asked) {
    return <p className="profile__invited">{t('teams.invited', { team: team.name })}</p>
  }

  return (
    <button
      type="button"
      className="button button--secondary"
      onClick={() => {
        const id = invite({ teamId: team.id, memberNumber: competitor.memberNumber, date: today })

        /* The invitation and the message that carries it are written together,
           because neither is any use alone: the record is what may be answered,
           and the inbox is the only place the person being asked will see it. */
        notify({
          from: t('app.name'),
          to: competitor.memberNumber,
          subject: t('teams.inviteSubject', { team: team.name }),
          body: t('teams.inviteBody', { team: team.name }),
          date: today,
          invitation: id,
        })
      }}
    >
      {t('teams.invite')}
    </button>
  )
}
