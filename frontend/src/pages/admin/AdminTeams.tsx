import { useState } from 'react'
import { Resource } from '../../components/Resource'
import type { Competitor } from '../../data/types'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import type { FieldError, FieldOption } from '../../forms/types'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { addressesIn, addressOf } from './teamProposal'
import { EditableCell } from './EditableCell'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { recordsOf, TEAMS, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import '../member/Member.css'

/* Teams, with the organiser and the head count beside each. Both matter when a
 * team is approved: a team with nobody in it and a team whose organiser has
 * left are the two cases worth spotting from the list (PDL P13). */

/** Who can run a team: any registered member, which makes this a closed list
 *  whose contents are data rather than a fixed set (PDL P13). */
function organizerOptions(competitors: Competitor[]): FieldOption[] {
  return competitors.map((one) => ({
    value: one.memberNumber,
    labelKey: `${one.firstName} ${one.lastName} (${one.memberNumber})`,
  }))
}

export function AdminTeams() {
  const { locale, t } = useI18n()
  const overlay = useOverlay()
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = combinePair(useTeams(), useCompetitors())

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.teams')}</h1>

      <Resource state={state}>
        {([teams, competitors]) => {
          const rows = recordsOf(TEAMS, teams, overlay)

          if (editing !== null) {
            return (
              <EntityEditor
                entity={TEAMS}
                editing={editing}
                options={{ organizerMemberNumber: organizerOptions(competitors) }}
                /* A name already taken is refused (PDL P13), and refused by the
                   address it makes rather than by the letters: the address is
                   read off the name (entityForms.ts) and `slugify` is not one
                   to one, so two names can be two teams at one address, which
                   is a rule about the same thing and stricter than the words
                   (ADL A7). The queue of new teams already refuses it; without
                   this the same name could be typed in here.

                   Compared against every team but the one being edited, or
                   saving a team without touching its name would refuse
                   itself. */
                also={(values): Record<string, FieldError> =>
                  addressesIn(
                    rows.filter(
                      (one) =>
                        one.id !==
                        (editing.mode === 'one'
                          ? String(editing.record[TEAMS.idField])
                          : /* Nothing to leave out: a team being made is not in
                               the list yet, and no team has a blank id. */
                            ''),
                    ),
                  ).includes(addressOf(String(values.name)))
                    ? { name: { key: 'teams.proposeTaken' } }
                    : {}
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
                      const members = competitors.filter((one) => one.teamId === team.id)
                      const organizer = competitors.find(
                        (one) => one.memberNumber === team.organizerMemberNumber,
                      )

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
                              id={team.id}
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
                            />
                          </td>
                        </tr>
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
