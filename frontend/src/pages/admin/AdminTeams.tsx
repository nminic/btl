import { Resource } from '../../components/Resource'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { EditableCell } from './EditableCell'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/* Teams, with the organiser and the head count beside each. Both matter when a
 * team is approved: a team with nobody in it and a team whose organiser has
 * left are the two cases worth spotting from the list (PDL P13). */
export function AdminTeams() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const state = combinePair(useTeams(), useCompetitors())

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.teams')}</h1>
      <p className="member__note">{t('admin.teamsNote')}</p>
      <p className="member__note">{t('admin.editNote')}</p>

      <Resource state={state}>
        {([teams, competitors]) => (
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">{t('admin.teams')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('teams.name')}</th>
                  <th scope="col">{t('event.place')}</th>
                  <th scope="col">{t('teams.members')}</th>
                  <th scope="col">{t('admin.organizer')}</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => {
                  const members = competitors.filter((one) => one.teamId === team.id)
                  const organizer = competitors.find(
                    (one) => one.memberNumber === team.organizerMemberNumber,
                  )

                  return (
                    <tr key={team.id}>
                      <td>
                        <EditableCell
                          id={team.id}
                          field="name"
                          value={team.name}
                          label={t('teams.name')}
                        />
                      </td>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Resource>
    </div>
  )
}
