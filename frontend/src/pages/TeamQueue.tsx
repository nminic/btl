import type { ReactElement } from 'react'
import { CompetitorName } from '../components/CompetitorName'
import { inYearlyWindow } from '../data/season'
import type { Competitor } from '../data/types'
import { formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { ServerSaid } from './account/ServerSaid'
import { WHEN_DECIDING_AN_APPLICATION } from './joiningThisTeam'
import { useTeamQueue, type QueueRefusal, type QueueRow } from './useTeamQueue'

/**
 * WHAT IS WAITING ON THIS TEAM, AND THE TEAM'S ANSWER TO IT, BOTH ON THE SERVER.
 *
 * <p>Owner, PDL 06.09.2026: „Ishod poziva se vraća timu kao poruka onome ko vodi tim u
 * trenutku odgovora... <b>Uz to strana tima pokazuje i pozive koje je poslala, da tim ne
 * zavisi od poruke.</b> Poruka je vest a ne ovlašćenje." A message is news; these two lists
 * are the record.
 *
 * <p><b>A component of its own rather than two more blocks inside `TeamDetail.tsx`</b>, and
 * the reason is a rule rather than tidiness: the team is resolved inside that screen's
 * `Resource` render prop, and a hook may not be called there. Lifted to the top of
 * `TeamDetail` instead, the read would have had to re-do the slug lookup and the overlay a
 * second time, which is a second home for „which team is this page about".
 *
 * <p><b>WHO SEES THIS, AND MOVING IT TO THE SERVER NARROWED IT.</b> Drawn for whoever leads
 * the team, which is what `data/teamAdmin.ts` answers definitely, and the route answers 404 to
 * everybody else. The session prototype this replaces drew the sent invitations for EVERY
 * member of the team; that narrowing follows the owner's decision of 27.09.2026 („Poziv u tim
 * salje <b>samo administrator tog tima</b>") and its recorded consequence („[IZVEDENO, ne
 * pitano] Povlacenje poziva takodje sme samo administrator"), and is not a choice made here.
 *
 * <p><b>The administration is a reader the ROUTE has and this screen does not ask for, which
 * is a boundary rather than an oversight.</b> `TeamJoiningApi.heMayReadThisTeamsQueue` answers
 * a moderator with the right over teams; on this side such an account has no competitor record
 * at all (PDL P21, „Jedan nalog je tacno jedan clan"), so `readerAdministers` answers false and
 * nothing is drawn. Giving him these sections would be new behaviour that no recorded decision
 * asks for, so it is written down here instead of being added.
 *
 * <p><b>THE SECTIONS ARE NOT BOUND BY THE TRANSFER WINDOW AND THE PROTOTYPE WAS.</b> PDL,
 * 06.09.2026: „<b>„Prihvati" traži prelazni rok, „Odbij" ne.</b> ... Odbijanje ne upisuje
 * ništa o sastavu nego samo završava pitanje", and the entry names what binding it would cost -
 * „član pozvan 30. decembra ne bi mogao ni da prihvati ni da se oslobodi pitanja do sledećeg
 * oktobra". `TeamJoiningWriteApi.deciding` is written that way round too: it asks
 * `transferWindowOpen` only after the branch that refuses. So the window takes „Primi u tim"
 * away and nothing else.
 *
 * <p><b>A section with nothing in it is not drawn at all</b>, which is a review finding of
 * 06.09.2026 rather than a preference: „a heading over an empty list announced applications
 * that were not there". `teamQueue.ts` says why an unreadable list and an empty one are the
 * same outcome here and what that costs.
 */
export function TeamQueue({
  team,
  members,
  today,
}: {
  /** `team.id`, which is the key both routes take in their path. */
  team: number
  /** The roster this page already read, for turning a member number into a name. The way the
   *  portal already does it: `app/AccountMenu.tsx`, `event/EventComments.tsx` and
   *  `event/GoingToEvent.tsx` all find a `Competitor` by `memberNumber` off the same list. */
  members: Competitor[]
  /** The day in the league's own zone, off the clock this screen already reads. */
  today: string
}) {
  const { locale, t } = useI18n()
  const { applications, invitations, busy, refused, decide, takeBack } = useTeamQueue(team)
  const mayTakeHimIn = inYearlyWindow(today)

  /**
   * WHAT TO CALL THE MEMBER A ROW IS ABOUT, and the three answers are three different facts.
   *
   * <p><b>No number at all</b> is an invitation to somebody whose fee has lapsed, which the
   * route answers deliberately and by decision (PDL, 13.09.2026: „Nijedan javni odgovor ne
   * sme da imenuje člana kome je članarina istekla, NI POSREDNO"). <b>The sentence drawn in
   * his place is MY REASONING and not a recorded decision</b>, and it is written down as such
   * so that the next reader does not take it for the owner's: with nothing at all the row
   * reads as a fault in the screen, and „Član kome je članarina istekla" names the STATE
   * rather than the man, so it does not reach the thing that decision forbids. <b>It falls the
   * day the owner says otherwise</b>, and what replaces it is one key in
   * `teams.inviteLapsed`.
   *
   * <p><b>A number the roster has not got</b> is honest and stays a number. `/api/competitors`
   * ends `where c.active` and these two lists are read at a different moment, so a row can
   * name somebody that answer no longer carries. Dropping the row would show the team fewer
   * questions than it has; the number is what the route already handed this reader.
   */
  const whoIs = (memberNumber: string | null): { said: string; row: Competitor | undefined } => {
    if (memberNumber === null) {
      return { said: t('teams.inviteLapsed'), row: undefined }
    }

    const found = members.find((one) => one.memberNumber === memberNumber)

    return {
      said: found === undefined ? memberNumber : `${found.firstName} ${found.lastName}`,
      row: found,
    }
  }

  /** The name, as a link where there is a record to link to and as plain words where there is
   *  not. `CompetitorName` is the one place that decides whether a profile can be opened. */
  const named = (memberNumber: string | null): ReactElement => {
    const { said, row } = whoIs(memberNumber)

    return row === undefined ? <span>{said}</span> : <CompetitorName competitor={row} />
  }

  /** Why the last press did not do what it said, under the row it was pressed on and nowhere
   *  else. Two rows are two questions, and a sentence that floated above both would leave the
   *  reader working out which of them it is about. */
  const why = (row: QueueRow): ReactElement | null =>
    refused !== null && refused.row.kind === row.kind && refused.row.id === row.id
      ? sentence(refused)
      : null

  return (
    <>
      {applications.length > 0 && (
        <>
          {/* Named by its own heading, because a list of questions about people is a thing a
              reader arrives at and must be able to leave again (WCAG 2.2, 1.3.1). It also lets
              a case say „these three and no others" instead of counting every `li` on the
              page. */}
          <h2 className="profile__section" id="team-waiting">
            {t('teams.joinWaiting')}
          </h2>
          <ul className="submissions" aria-labelledby="team-waiting">
            {applications.map((one) => {
              const row: QueueRow = { kind: 'application', id: one.id }
              const { said } = whoIs(one.memberNumber)

              return (
                <li key={one.id} className="submissions__item">
                  <p className="submissions__meta">{named(one.memberNumber)}</p>
                  {/* The day they asked, the same shape the moderator's queue gives a card
                      (`admin/PendingQueue.tsx`). */}
                  <p className="submissions__meta">{formatShortDate(one.date, locale)}</p>
                  <p className="member__actions">
                    {/* Both controls carry the name of whoever is being answered about. Two
                        members waiting on one team put two controls with one name on the
                        screen, and a reader who arrives at „Primi u tim" is answered „about
                        whom" by nothing (WCAG 2.2 AA, SC 2.4.6; review, 06.09.2026). */}
                    {mayTakeHimIn && (
                      <button
                        type="button"
                        className="button button--secondary"
                        aria-label={t('teams.joinTakenNamed', { name: said })}
                        /* Told off rather than switched off, which is `member/Membership.tsx`'s
                           own reason: a control that goes away takes the keyboard focus with
                           it. The press is refused in the handler, because `aria-disabled`
                           stops nothing by itself. */
                        aria-disabled={busy(row) ? true : undefined}
                        onClick={() => {
                          void decide(one.id, true)
                        }}
                      >
                        {t('teams.joinTaken')}
                      </button>
                    )}{' '}
                    <button
                      type="button"
                      className="button button--secondary"
                      aria-label={t('teams.joinRefusedNamed', { name: said })}
                      aria-disabled={busy(row) ? true : undefined}
                      onClick={() => {
                        void decide(one.id, false)
                      }}
                    >
                      {t('teams.joinRefused')}
                    </button>
                  </p>
                  {why(row)}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {invitations.length > 0 && (
        <>
          <h2 className="profile__section" id="team-invited">
            {t('teams.inviteSent')}
          </h2>
          <ul className="submissions" aria-labelledby="team-invited">
            {invitations.map((one) => {
              const row: QueueRow = { kind: 'invitation', id: one.id }
              const { said } = whoIs(one.memberNumber)

              return (
                <li key={one.id} className="submissions__item">
                  <p className="submissions__meta">{named(one.memberNumber)}</p>
                  <p className="submissions__meta">{formatShortDate(one.date, locale)}</p>
                  <p className="member__actions">
                    {/* <b>No window on this one, for the reason „Odbij" has none:</b> it writes
                        nothing about a squad, so a team that asked the wrong man need not wait
                        until October to undo it. <b>Taking an invitation back is DERIVED, and was
                        NOT ASKED:</b> PDL records it as following from the owner's decision of
                        27.09.2026 that only the administrator of a team sends an invitation
                        („[IZVEDENO, ne pitano] Povlacenje poziva takodje sme samo
                        administrator."). The missing window is reasoning by analogy with
                        „Odbij", and is written down as such. */}
                    <button
                      type="button"
                      className="button button--secondary"
                      aria-label={t('teams.inviteWithdrawNamed', { name: said })}
                      aria-disabled={busy(row) ? true : undefined}
                      onClick={() => {
                        void takeBack(one.id)
                      }}
                    >
                      {t('teams.inviteWithdraw')}
                    </button>
                  </p>
                  {why(row)}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}

/**
 * The refusal, with the dictionary belonging to the verb that was sent.
 *
 * <p><b>Taking an invitation back names no reason at all and is handed an empty table.</b>
 * `TeamJoiningWriteApi.takeBack` answers 204 or an empty 404, so a failure arrives as
 * `{ got: 'wrong', status: 404 }` and is said out loud with its number. A dictionary with
 * invented keys in it would claim that route refuses by name, and it does not.
 */
function sentence(refusal: QueueRefusal): ReactElement {
  return (
    <ServerSaid
      answer={refusal.answer}
      refusals={refusal.row.kind === 'application' ? WHEN_DECIDING_AN_APPLICATION : {}}
    />
  )
}
