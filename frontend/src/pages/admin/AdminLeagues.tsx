import { Resource } from '../../components/Resource'
import { useLeagues } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { EditableCell } from './EditableCell'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/* Leagues, with the number of events each one carries. A league with no events
 * is the one to notice: it is announced, it appears in the navigation, and it
 * has nothing to rank (PDL P15). */
export function AdminLeagues() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const state = useLeagues()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.leagues')}</h1>
      <p className="member__note">{t('admin.leaguesNote')}</p>
      <p className="member__note">{t('admin.editNote')}</p>

      <Resource state={state}>
        {(leagues) => (
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">{t('admin.leagues')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('leagues.name')}</th>
                  <th scope="col">{t('rankings.season')}</th>
                  <th scope="col">{t('event.races')}</th>
                  <th scope="col">{t('admin.byCategory')}</th>
                </tr>
              </thead>
              <tbody>
                {leagues.map((league) => (
                  <tr key={league.id}>
                    <td>
                      <EditableCell
                        id={league.id}
                        field="name"
                        value={league.name}
                        label={t('leagues.name')}
                      />
                    </td>
                    <td>{league.season}</td>
                    <td>
                      {league.eventIds.length === 0 ? (
                        <span className="tag tag--checking">{t('admin.noEvents')}</span>
                      ) : (
                        formatNumber(league.eventIds.length, locale)
                      )}
                    </td>
                    <td>{t(league.groupsByCategory ? 'admin.yes' : 'admin.no')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Resource>
    </div>
  )
}
