import { Fragment, useState } from 'react'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import type { Competitor, Team } from '../../data/types'
import { combinePair, useCompetitors, useHowManyTimesDropped, useTeams } from '../../data/useResource'
import { transfersTakeEffect } from '../../data/season'
import { useToday } from '../../clock/useClock'
import type { FieldError, FieldOption, FormValues } from '../../forms/types'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { addressesIn, nameError } from './teamProposal'
import { EditableCell } from './EditableCell'
import { DeletionSaid } from './DeletionSaid'
import { TeamLogoModeration } from './TeamLogoModeration'
import { TeamMembers } from './TeamMembers'
import { EntityBar, EntityEditor, RowActions, type Saving } from './EntityEditor'
import { MEMBERS, recordsOf, TEAMS, type Editing, type Overlay } from './entityForms'
import { useOverlay } from './overlay'
import {
  theTeamAsWritten,
  WHEN_DELETING_A_TEAM,
  WHEN_THE_ADMINISTRATION_WRITES_A_TEAM,
  whereTheTeamGoes,
} from './teamWrites'
import '../member/Member.css'

/* Teams, with the organiser and the head count beside each. Both matter when a
 * team is approved: a team with nobody in it and a team whose organiser has
 * left are the two cases worth spotting from the list (PDL P13). */

/**
 * EVERY WRITE OF THIS SCREEN GOES TO THE SERVER SINCE 23.11.2026, AND NOTHING ABOUT A TEAM IS
 * KEPT IN THE BROWSER'S SESSION ANY MORE.
 *
 * <p>PDL P13, „[ZATEČENO 23.11.2026 ...]", owner: „NAPRAVIM TIM KAO ADMIN I NESTANE IZ LISTE. A I
 * KAD SE POJAVI NA KRATKO, PIŠE 0 ČLANOVA IAKO TREBA DA ODMAH RAČUNA SVOG ORGANIZATORA". The decision
 * of 09.10.2026 („Administracija pravi i menja tim direktno, bez reda za moderaciju") had never been
 * carried out: „Novi tim" and „Izmeni" wrote into the session alone and a team made here did not
 * exist in the database. ~~This screen deletes through the server and still makes and changes a team
 * in the session~~, said the note that stood here from 26.09.2026, and named the cost.
 *
 * <ul>
 * <li><b>„Novi tim"</b> is `POST /api/teams/direct`, which writes the team, the organizer's
 * membership and his seat at once (`TeamAdministrationWriteApi.make`).
 * <li><b>„Izmeni"</b> and the town in its cell are `PUT /api/teams/{id}`.
 * <li><b>„Obriši"</b> is `DELETE /api/teams/{id}`, the same verb the team's own administrator sends
 * (PDL P13b, 25.09.2026, „isto dugme i iste posledice").
 * </ul>
 *
 * <p><b>WHAT THE LIST SHOWS IS WHAT THE SERVER HOLDS, AND IT ASKS AGAIN AFTER EVERY WRITE.</b> Each
 * write drops `teams` and `competitors`, and both are read with the number of times they were dropped
 * as their revision (`useHowManyTimesDropped`), so the list that is still mounted reads them again: a
 * team just made stands in it with its organizer counted, because a member's team reaches the portal
 * as `Competitor.teamId` off `/api/competitors` and that answers the membership that has not ended
 * whatever season it begins in. Nothing is drawn from what this screen hoped the server did.
 */

/** Nothing of a team is held beside the server's answer. */
const NOTHING: Overlay = { edits: {}, creations: {}, deletions: {} }

/** Who can run a team: any registered member, which makes this a closed list
 *  whose contents are data rather than a fixed set (PDL P13). */
function organizerOptions(competitors: Competitor[], held: string): FieldOption[] {
  const offered = competitors.map((one) => ({
    value: one.memberNumber,
    labelKey: `${one.firstName} ${one.lastName} (${one.memberNumber})`,
  }))

  /**
   * And whoever the record already names, even when they are no longer among them.
   *
   * **A control cannot hold a value it does not offer.** A `<select>` whose value names
   * no option leaves the first one showing, so a team whose organiser administration had
   * deleted drew somebody who had never run it, while the record went on holding the
   * number that was there and saving it back (review, 05.09.2026).
   */
  return offered.some((one) => one.value === held) || held === ''
    ? offered
    : [...offered, { value: held, labelKey: held }]
}

export function AdminTeams() {
  const { locale, t } = useI18n()
  const today = useToday()
  /* The members still through the overlay, which other screens of the administration write
     member records into; the teams never, since nothing here writes one. */
  const overlay = useOverlay()
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = combinePair(
    useTeams(useHowManyTimesDropped('teams')),
    useCompetitors(useHowManyTimesDropped('competitors')),
  )

  /** The team whose members are drawn under its row („Dodaj člana”, „Izbaci”), or none. */
  const [openTeam, setOpenTeam] = useState<number | null>(null)

  /** What just happened, for whoever is not watching the list. */
  const [said, setSaid] = useState('')

  /** Why a deletion or a change of the town did not happen, beside the row it was pressed on. */
  const [refused, setRefused] = useState<{
    id: number
    answer: Exclude<Answer, { got: 'done' }>
    refusals: Record<string, string>
  } | null>(null)

  /** The sentence the season of a founder who has not paid is said with (`theSeasonIsNotPaid`). */
  const params = { season: transfersTakeEffect(today) }

  /** Both resources a write of a team moves: the team, and its members' `teamId`. */
  function readAgain(): void {
    clearResourceCache('teams')
    clearResourceCache('competitors')
  }

  /**
   * THE FORM'S OWN SAVE, to the making or to the change by the identity it was opened with
   * (`whereTheTeamGoes`). A refusal keeps the form open with the route's sentence, and the reader has
   * everything he typed (`EntityEditor`).
   */
  async function saveOne(values: FormValues, open: Editing): Promise<Saving> {
    const id = open.mode === 'one' ? Number(open.record[TEAMS.idField]) : null
    const where = whereTheTeamGoes(id)
    const answer = await askTheServer(where.path, theTeamAsWritten(values), where.method)

    if (answer.got !== 'done') {
      return {
        said: (
          <ServerSaid answer={answer} refusals={WHEN_THE_ADMINISTRATION_WRITES_A_TEAM} params={params} />
        ),
      }
    }

    readAgain()

    /* The identity the route answered with, which for a team just made is the one the
       database handed out; for a change it is the team's own. */
    const body: unknown = answer.body
    const written =
      typeof body === 'object' && body !== null && 'id' in body ? String(body.id) : String(id)

    return { written }
  }

  /** A town changed in its cell: the same change, with everything else as the row has it. */
  async function townOf(team: Team, city: string): Promise<void> {
    const answer = await askTheServer(
      `/api/teams/${String(team.id)}`,
      /* The seat, the description and the link are left out, which the route reads as „as they
         stand" (`TeamAdministrationWriteApi`): a cell about the town speaks for nothing else. */
      { name: team.name, city, country: team.country },
      'PUT',
    )

    if (answer.got !== 'done') {
      setRefused({ id: team.id, answer, refusals: WHEN_THE_ADMINISTRATION_WRITES_A_TEAM })

      return
    }

    setRefused(null)
    readAgain()
  }

  /**
   * TAKING A TEAM AWAY THROUGH THE ROUTE (PDL P13b, owner 25.09.2026: the same act and the same
   * address as its own administrator's). The window is the route's to keep and this screen draws no
   * condition of its own about it: outside it the answer is 409 `theWindowIsShut`, and the sentence
   * comes off the answer. What goes with the team (the memberships, the season's total) is the
   * server's; the two resources are read again so that every screen agrees.
   */
  async function deleteOne(team: Team): Promise<void> {
    const answer = await askTheServer(`/api/teams/${team.id}`, {}, 'DELETE')

    if (answer.got !== 'done') {
      setRefused({ id: team.id, answer, refusals: WHEN_DELETING_A_TEAM })
      /* The sentence of an earlier deletion is not about this one (`DeletionSaid.tsx`). */
      setSaid('')

      return
    }

    readAgain()
    setRefused(null)
    setSaid(t('admin.teamGone'))
  }

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.teams')}</h1>

      <Resource state={state}>
        {([teams, competitors]) => {
          const rows = recordsOf(TEAMS, teams, NOTHING)
          const listed = recordsOf(MEMBERS, competitors, overlay)

          if (editing !== null) {
            return (
              <EntityEditor
                entity={TEAMS}
                editing={editing}
                /* Off the same list the rows beside it read, and never without the one
                   the record already names (review, 05.09.2026, twice). */
                options={{
                  organizerMemberNumber: organizerOptions(
                    listed,
                    editing.mode === 'one' ? String(editing.record.organizerMemberNumber) : '',
                  ),
                }}
                /* A name already taken is refused (PDL P13) by the address it makes, before
                   anything is sent, against every team but the one being edited. The route
                   refuses it too, inside its own statement, so a name taken by another
                   administrator a moment ago is answered by the route's sentence. */
                also={(values): Record<string, FieldError> =>
                  nameError(
                    String(values.name),
                    addressesIn(
                      rows.filter(
                        (one) =>
                          String(one.id) !==
                          (editing.mode === 'one' ? String(editing.record[TEAMS.idField]) : ''),
                      ),
                    ),
                  )
                }
                save={(values) => saveOne(values, editing)}
                /* THE TEAM'S LOGO, IN THE FORM OF A TEAM THAT EXISTS (owner, PDL 25.11.2026, „Urednik tima postavlja
                   znak tima slikom”: „da moze i iz administracije”). It writes at once, as the league's mark does in
                   its own form, and holds nothing the form holds. Found in the served list by identity, so a team
                   being made, which has no identity yet, draws none. */
                beneath={
                  editing.mode === 'one'
                    ? () =>
                        teams
                          .filter((one) => String(one.id) === String(editing.record[TEAMS.idField]))
                          .map((team) => <TeamLogoModeration key={team.id} team={team} />)
                    : undefined
                }
                onDone={() => setEditing(null)}
              />
            )
          }

          return (
            <>
              <EntityBar entity={TEAMS} onNew={() => setEditing({ mode: 'new' })} />

              {/* What the deletion said, DRAWN and not only said (owner, 23.10.2026: the deletion asks and
                  answers as the member's row does, `DeletionSaid.tsx`). */}
              <DeletionSaid said={said} clear={setSaid} />

              <div className="table-scroll table-scroll--measured">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.teams')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('teams.name')}</th>
                      <th scope="col">{t('event.place')}</th>
                      <th scope="col">{t('teams.members')}</th>
                      <th scope="col">{t('admin.organizer')}</th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((team) => {
                      const members = listed.filter((one) => one.teamId === team.id)
                      const organizer = listed.find(
                        (one) => one.memberNumber === team.organizerMemberNumber,
                      )

                      return (
                        <Fragment key={team.id}>
                        <tr>
                          {/* Read here and changed on the form, unlike the town beside it (ADL,
                              03.08.2026): a cell writes one field and cannot put the address
                              right afterwards. */}
                          <td>{team.name}</td>
                          <td>
                            <EditableCell
                              value={team.city}
                              label={t('event.place')}
                              commit={(city) => void townOf(team, city)}
                            />
                          </td>
                          <td>
                            {/* THE HEAD COUNT IS THE BUTTON THAT OPENS THE MEMBERS UNDER THE ROW (PDL P13,
                                [ODLUKA 23.11.2026], „uz svaki tim: Dodaj člana ... i Izbaci uz svakog
                                člana”). The number it shows is the first part of its name, as SC 2.5.3
                                asks, and the cell still reads as the head count it was. */}
                            <button
                              type="button"
                              className="entity-open"
                              aria-label={`${formatNumber(members.length, locale)} ${t('admin.teamMembersOf', { team: team.name })}`}
                              aria-expanded={openTeam === team.id}
                              aria-controls={`team-${String(team.id)}-members`}
                              onClick={() => setOpenTeam((was) => (was === team.id ? null : team.id))}
                            >
                              {formatNumber(members.length, locale)}
                            </button>
                          </td>
                          <td>
                            {organizer === undefined
                              ? t('admin.noOrganizer')
                              : `${organizer.firstName} ${organizer.lastName}`}
                          </td>
                          <td>
                            <RowActions
                              entity={TEAMS}
                              asks={t('admin.teamDeleteAsk')}
                              record={team}
                              name={team.name}
                              onOpen={() => setEditing({ mode: 'one', record: team })}
                              deleteRecord={() => deleteOne(team)}
                              /* The sentence of an earlier refusal of THIS row goes when the
                                 reader puts the question away (registry item 311). */
                              onKeep={() => setRefused((was) => (was !== null && was.id === team.id ? null : was))}
                            />
                            {/* Why this one did not go or did not change, in the row it was
                                pressed in. `ServerSaid` draws it in an alert. */}
                            {refused !== null && refused.id === team.id && (
                              <ServerSaid answer={refused.answer} refusals={refused.refusals} params={params} />
                            )}
                          </td>
                        </tr>
                        {openTeam === team.id && (
                          <tr id={`team-${String(team.id)}-members`}>
                            <td colSpan={5}>
                              <TeamMembers
                                team={team}
                                members={members}
                                free={listed.filter((one) => one.teamId === null)}
                                season={params.season}
                                onWritten={readAgain}
                              />
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
