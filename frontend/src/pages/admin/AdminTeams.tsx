import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import type { Competitor, Team } from '../../data/types'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import type { FieldError, FieldOption } from '../../forms/types'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { addressesIn, nameError } from './teamProposal'
import { EditableCell } from './EditableCell'
import { useSession } from '../../session/useSession'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { MEMBERS, recordsOf, TEAMS, type Editing } from './entityForms'
import { recordKey } from '../../session/context'
import { useOverlay } from './overlay'
import { standsOnTheServer, WHEN_DELETING_A_TEAM } from './teamWrites'
import '../member/Member.css'

/* Teams, with the organiser and the head count beside each. Both matter when a
 * team is approved: a team with nobody in it and a team whose organiser has
 * left are the two cases worth spotting from the list (PDL P13). */

/**
 * THIS SCREEN DELETES THROUGH THE SERVER AND STILL MAKES AND CHANGES A TEAM IN THE SESSION,
 * AND THAT SPLIT IS A BOUNDARY WRITTEN DOWN RATHER THAN WORK LEFT HALF DONE.
 *
 * <p>PDL P28c point 2, owner 24.09.2026: „Svi ekrani administracije prestaju da pisu u
 * sesijski sloj i pocinju da zovu rute", with his reason - „bez toga nijedan entitet unet
 * kroz portal stvarno ne postoji". `admin/AdminLeagues.tsx` did all of that in one go
 * because all four of a competition's routes were finished and unreachable. A team is not
 * in that position, and the difference was MEASURED over `backend/src/main/java` on
 * 26.09.2026 rather than assumed:
 *
 * <ul>
 * <li><b>`DELETE /api/teams/{id}` exists</b> (`TeamWriteApi.remove`), and this screen now
 * calls it. PDL P13b, owner 25.09.2026: „Superadmin i moderator sa pravom nad timovima imaju
 * <b>isto dugme i iste posledice</b> kao administrator tog tima", which is why the
 * administration sends the same verb to the same address rather than getting one of its
 * own.</li>
 * <li><b>There is no `PUT` anywhere</b>, so a team has no route to be changed at.</li>
 * <li><b>`POST /api/teams` makes no team.</b> It makes a `team_proposal` and the
 * `verification` row that carries it to whoever decides (`TeamWriteApi`, PDL P13: „Upis tima
 * prolazi kroz moderaciju"), and it answers 404 to anybody who already has a team. It
 * therefore cannot serve „Novi tim" here, by right or by meaning.</li>
 * </ul>
 *
 * <p><b>SO MAKING AND CHANGING A TEAM STAY IN THE SESSION, AND THE COST IS NAMED HERE
 * BECAUSE IT IS REAL:</b> a team entered on this screen still does not exist on the server,
 * exactly as PDL P28c point 1 names the same thing for results - „Unos rezultata danas nema
 * nijednu pisucu rutu ... dakle unos rezultata ulazi u obim pred lansiranje."
 *
 * <p><b>WHOSE DECISION THIS IS, said plainly so that no later reader takes it for the
 * owner's.</b> The owner has NOT been asked whether the administration should be able to
 * enter a team directly; he is being told separately that the route is missing, as an item
 * for him to decide when the main work stops. What was decided inside this increment is only
 * that the half with a route goes to the server now rather than waiting for the half without
 * one. The outcome refused, and the reason: taking „Novi tim" and „Izmeni" off this screen
 * would remove a capability nobody asked to have removed.
 *
 * <p><b>WHAT THAT MEANS FOR THE DELETE BUTTON, and it is the one place the two halves meet
 * in one table.</b> A row entered during this visit is filed under a negative number
 * (`entityForms.idFor` counts down from nought), so its delete is answered by the session and
 * never sent; a served row carries a `bigserial` and its delete goes to the route.
 * `standsOnTheServer` is that question, and the note on it says what sending the other kind
 * would have cost.
 */

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
   * number that was there and saving it back. One screen said three things about one
   * fact, and the middle one was the only one nobody could see was wrong (review,
   * 05.09.2026). Kept here rather than mended in the renderer, because what a record may
   * still name is a fact about this screen's data.
   */
  return offered.some((one) => one.value === held) || held === ''
    ? offered
    : [...offered, { value: held, labelKey: held }]
}

export function AdminTeams() {
  const { locale, t } = useI18n()
  /**
   * WHAT TAKES A DELETED TEAM OUT OF THE LIST, AND IT IS THE SAME STORE THE MAKING AND THE
   * CHANGING STILL WRITE TO.
   *
   * **One overlay and not two, which is the fault `AdminLeagues.tsx` names in its own
   * words**: „Writing a second merge here would be a second answer to „what does this list
   * show", and the first fault of that shape is always ... a record somebody deleted going
   * on standing in a list." That screen had to keep its own overlay because every one of its
   * writes had left the session; here the creations and the edits are still the session's,
   * so a confirmed deletion joins them rather than starting a rival store.
   *
   * **Written only inside the branch that ran because the answer said the write went
   * through**, which is the whole of the discipline: nothing here records what this screen
   * hoped the server did.
   *
   * **`editRecord` beside it is the OTHER half and is used nowhere near a route**: it takes
   * the roster of a team the server has never heard of along with it, and the note on
   * `alsoRemove` below says why that is only ever done where nothing can refuse.
   */
  const { editRecord, remove } = useSession()
  const overlay = useOverlay()
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = combinePair(useTeams(), useCompetitors())

  /** What just happened, for whoever is not watching the list. */
  const [said, setSaid] = useState('')

  /** Why a deletion did not happen, beside the row it was pressed on. */
  const [refused, setRefused] = useState<{
    id: number
    answer: Exclude<Answer, { got: 'done' }>
  } | null>(null)

  /**
   * TAKING A TEAM AWAY THROUGH THE ROUTE, WHICH IS ONLY HALF OF THE ACT PDL P13b CALLS
   * THE SAME.
   *
   * <p>PDL P13b, owner 25.09.2026: brisanje tima iz administracije je <b>ista radnja</b> kao
   * brisanje od strane njegovog administratora, pa je i adresa ista - this function calls
   * `DELETE /api/teams/{id}` rather than an address of its own. <b>Measured on 26.09.2026,
   * the other half of that pair has not moved here yet.</b> `TeamDetail.tsx`'s own „Obriši"
   * button, the one the team's administrator presses, still only calls `editRecord` and
   * `remove` on the session: `askTheServer` has exactly thirteen call sites in this portal,
   * this function's among them, and `TeamDetail.tsx` is not a fourteenth. So the decision
   * names one act; the code today has two, and the two differences that follow from that
   * are named here rather than left for the next reader to take the title above at its word.
   *
   * <ul>
   * <li><b>Permanence.</b> This function's deletion is the server's and outlives the tab.
   * `TeamDetail.tsx`'s is the session's alone, so nothing tells the server; a refresh reads
   * the team back off it.</li>
   * <li><b>The window.</b> The refusal below is `SeasonClock.transferWindowOpen` answering
   * 409 outside 1.10-31.12, and PDL P13b names that rule „i to i administratoru tima i
   * administraciji" - the same rule for both. `TeamDetail.tsx` asks the route nothing, so
   * the window binds this function alone: the team's own administrator can delete in June
   * exactly as freely as in November, which is the half of that sentence the code does not
   * yet keep.</li>
   * </ul>
   *
   * <p>What follows from a deletion THAT REACHES THE ROUTE is the server's and is not
   * restated here: PDL P13a, owner 25.09.2026 - „I tim (ako nema više ni jednog člana) i par
   * (ako nema bar jednog člana) nestaju sa spiska i brišu se svi rezultati te sezone.
   * <b>Prethodne sezone su zamrznute i ne diraju se.</b>" The season's total for the team
   * goes because it is derived from memberships that cascade (V11), the frozen season stays
   * (V17), and the members' own results are not touched at all (V7 carries no team on a
   * result), which is the other half of the same decision: nestaje zbir tima za tu sezonu, a
   * licni rezultati clanova ostaju netaknuti.
   *
   * <p><b>THIS SCREEN DRAWS NO CONDITION OF ITS OWN ABOUT THE WINDOW, and that is the point
   * of the refusal below rather than an omission.</b> The route asks
   * `SeasonClock.transferWindowOpen` and answers 409 `theWindowIsShut` outside 1.10-31.12. A
   * screen that refused first would be a second home for 1 October, and the two would be
   * free to disagree on the day either was edited. So the reason the reader is given comes
   * off the ANSWER, and `adminTeams.test.tsx` holds that from both sides: the sentence
   * appears on a 409 received on a day this screen would have called open, and the row goes
   * on a 204 received on a day it would have called shut.
   *
   * <p><b>AND NOTHING GOES WITH THE TEAM FROM THIS FUNCTION, WHICH IS A REMOVAL AND NOT A
   * GAP.</b> The row used to hand `RowActions` an `alsoRemove` that blanked `teamId` on every
   * member of the team in the session, on every row alike. That cannot stand beside a route,
   * and the reason is in `RowActions` itself: `deleteRow` runs `alsoRemove` BEFORE it asks
   * anybody and regardless of the answer, so a refused deletion would have emptied the roster
   * of a team that is still standing. For a team the route owns, the route does the whole of it
   * - the memberships cascade (V11) - and what makes the screen agree is the pair of cache
   * lines below rather than this paragraph. <b>It survives on the session half, where there is
   * no answer to be wrong about</b>; the note on `alsoRemove` says why that half still needs
   * it and why the two can never both be in force for one row.
   */
  async function deleteOne(team: Team): Promise<void> {
    const answer = await askTheServer(`/api/teams/${team.id}`, {}, 'DELETE')

    if (answer.got !== 'done') {
      setRefused({ id: team.id, answer })

      return
    }

    /* THE NEXT MOUNT READS THE SERVER, AND FOR BOTH OF THE TWO RESOURCES THIS DELETION
       MOVED. A screen that is still mounted never asks its resource again, so the cache this
       visit fetched would answer the next mount with the team still in it - the fault a
       review of PR 368 measured on the competitions.

       `competitors` BESIDE `teams`, AND THAT IS THE HALF THAT IS EASY TO MISS: the members of
       a deleted team lose their membership on the server (V11 cascades), and a member's team
       reaches this portal as `Competitor.teamId` off `/api/competitors`. Cleared here rather
       than written into the overlay member by member, which is what `alsoRemove` used to do
       and what the note above says why it cannot. Left uncleared, every screen that draws
       somebody's club would go on drawing a team that is gone. */
    clearResourceCache('teams')
    clearResourceCache('competitors')

    setRefused(null)
    setSaid(t('admin.teamGone'))
    remove(TEAMS.id, String(team.id))
  }

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.teams')}</h1>

      <Resource state={state}>
        {([teams, competitors]) => {
          const rows = recordsOf(TEAMS, teams, overlay)
          /* **Through the same layer as the teams beside them**, because a team entered on
             this screen and a member approved out of the queue are both still the session's
             (see the note on this component for what has a route and what has not).
             `AdminEvents.tsx` has read its races this way since the day it learned to take
             them along.

             **And it is read for two different reasons now**, which is worth saying because
             the two used to be one. For a served team this is what the head count is drawn
             from, and a deletion puts it right by dropping the resource (`deleteOne`). For a
             team approved during this visit it is also the only place its roster exists at
             all, which is why that half still takes the roster along by hand (`alsoRemove`
             below). */
          const listed = recordsOf(MEMBERS, competitors, overlay)

          if (editing !== null) {
            return (
              <EntityEditor
                entity={TEAMS}
                editing={editing}
                /* Off the same list the rows beside it read, and never without the one
                   the record already names. Left on the file while the row moved to the
                   session, one screen said two things about one fact; moved to the
                   session alone, it said three (review, 05.09.2026, twice). */
                options={{
                  organizerMemberNumber: organizerOptions(
                    listed,
                    editing.mode === 'one' ? String(editing.record.organizerMemberNumber) : '',
                  ),
                }}
                /* A name already taken is refused (PDL P13), and refused by the
                   address it makes rather than by the letters: the address is
                   read off the name (entityForms.ts) and `slugify` is not one
                   to one, so two names can be two teams at one address, which
                   is a rule about the same thing and stricter than the words
                   (ADL A7). The queue of new teams already refuses it; without
                   this the same name could be typed in here.

                   **And it is the SCREEN that refuses it here, unlike the address of a
                   competition, which the route decides since 25.09.2026.** Not a departure
                   from that precedent but the absence of the thing it rests on: `add` and
                   `change` on a competition refuse a taken address inside the statement, and
                   a team has no route to be made or changed at at all. The list this checks
                   against can only ever be what this browser was served plus what this visit
                   made, and that limit is what a route would remove the day one exists.

                   Compared against every team but the one being edited, or
                   saving a team without touching its name would refuse
                   itself. */
                also={(values): Record<string, FieldError> =>
                  nameError(
                    String(values.name),
                    addressesIn(
                      rows.filter(
                        (one) =>
                          String(one.id) !==
                          (editing.mode === 'one'
                            ? String(editing.record[TEAMS.idField])
                            : /* Nothing to leave out: a team being made is not
                                 in the list yet, and no team has a blank id. */
                              ''),
                      ),
                    ),
                  )
                }
                onDone={() => setEditing(null)}
              />
            )
          }

          return (
            <>
              <EntityBar entity={TEAMS} onNew={() => setEditing({ mode: 'new' })} />

              <div className="table-scroll">
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
                      /**
                       * WHICH OF THE TWO HALVES THIS ROW IS, ASKED ONCE AND ANSWERING BOTH
                       * OF THE CONTROLS BELOW.
                       *
                       * A team the database handed out is deleted by the route; a team
                       * entered or approved during this visit is deleted by the session,
                       * because no route knows it exists (see the note on this component).
                       * Asked here rather than twice inside the markup, so that the two
                       * consequences cannot come apart: one of them sending to the server
                       * while the other still wrote the roster is precisely the arrangement
                       * the paragraph on `deleteOne` says must not exist.
                       */
                      const served = standsOnTheServer(team.id)

                      return (
                        <tr key={team.id}>
                          {/* Read here and changed on the form, unlike the town
                              beside it. The address a team answers at is made
                              out of its name (entityForms.ts), and a cell
                              writes one field of one record: it has no way to
                              put the address right afterwards, and no way to
                              refuse a name already taken. Both of those live on
                              the form, so that is where a name is changed. */}
                          <td>{team.name}</td>
                          <td>
                            <EditableCell
                              under={TEAMS.id}
                              id={String(team.id)}
                              field="city"
                              value={team.city}
                              label={t('event.place')}
                            />
                          </td>
                          <td>{formatNumber(members.length, locale)}</td>
                          <td>
                            {organizer === undefined
                              ? t('admin.noOrganizer')
                              : `${organizer.firstName} ${organizer.lastName}`}
                          </td>
                          <td>
                            <RowActions
                              entity={TEAMS}
                              record={team}
                              name={team.name}
                              onOpen={() => setEditing({ mode: 'one', record: team })}
                              /* THE ROUTE FOR A TEAM THE DATABASE HANDED OUT, AND THE
                                 SESSION FOR ONE ENTERED DURING THIS VISIT. Left
                                 undefined, `RowActions` writes the deletion into the
                                 session itself, which is the right answer for a row the
                                 server has never heard of: its key is negative and
                                 `DELETE /api/teams/-1` is an address nothing answers to.
                                 See `standsOnTheServer`. */
                              deleteRecord={served ? () => void deleteOne(team) : undefined}
                              /**
                               * AND WHAT GOES WITH THE TEAM, FOR THE SESSION HALF AND FOR
                               * THAT HALF ALONE.
                               *
                               * <p>The people in a team approved during this visit are
                               * written into the session by the approval and nowhere else
                               * (`PendingQueue.tsx` files them under the identity
                               * `entityForms.idFor` counted DOWN from nought), so nothing
                               * on the server can take them along: it has never heard of
                               * either the team or the membership. Left undone, a member
                               * kept a team nobody could open - the portal went on refusing
                               * them a new one while their profile showed no club, because
                               * `teams.find` answered nothing while `teamId` still named a
                               * team (review, 05.09.2026), and
                               * `pages/teamDelete.test.tsx` holds exactly that walk.
                               *
                               * <p><b>AND IT IS ABSENT FROM THE OTHER HALF, WHICH IS THE
                               * WHOLE POINT RATHER THAN A SAVING.</b> `RowActions.deleteRow`
                               * runs this BEFORE it asks anybody and regardless of what
                               * comes back, so paired with a route it would empty the
                               * roster of a team the server had just REFUSED to delete. On
                               * the session half there is nothing to refuse, so the
                               * ordering that makes it wrong over there cannot arise here.
                               * For a served team the route does the whole of it - the
                               * memberships cascade (V11) - and `deleteOne` drops the
                               * `competitors` cache that carried the old answer.
                               */
                              alsoRemove={
                                served
                                  ? undefined
                                  : () => {
                                      for (const one of members) {
                                        editRecord(recordKey(MEMBERS.id, one.memberNumber), {
                                          teamId: '',
                                        })
                                      }
                                    }
                              }
                            />
                            {/* Why this one did not go, in the row it was pressed in.
                                The focus has already moved to the control that starts a
                                new record, as it does on every other list, so the words
                                carry themselves: `ServerSaid` draws them in an alert. */}
                            {refused !== null && refused.id === team.id && (
                              <ServerSaid answer={refused.answer} refusals={WHEN_DELETING_A_TEAM} />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Said once and politely: the list beside it has already changed, and a
                  reader who is not looking at it gets the one sentence that says so.
                  The same shape the competitions use. */}
              <p aria-live="polite" className="visually-hidden">
                {said}
              </p>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
