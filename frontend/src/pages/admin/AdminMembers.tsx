import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { useCompetitors } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/* The list of members, with the one thing that is not public about them: on
 * what basis their membership is active. That is a fact about money, kept off
 * every public screen and shown only here (PDL P8). */
export function AdminMembers() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const [search, setSearch] = useState('')
  const state = useCompetitors()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.members')}</h1>

      <Resource state={state}>
        {(competitors) => {
          const needle = search.trim().toLowerCase()
          const rows = competitors.filter((one) =>
            `${one.firstName} ${one.lastName} ${one.memberNumber} ${one.city}`
              .toLowerCase()
              .includes(needle),
          )

          return (
            <>
              <div className="rankings__filters">
                <label className="rankings__field rankings__field--wide">
                  <span>{t('competitors.search')}</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>

              <p className="rankings__count">{t('competitors.count', { count: rows.length })}</p>

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.members')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('competitors.columns.member')}</th>
                      <th scope="col">{t('competitors.columns.category')}</th>
                      <th scope="col">{t('competitors.columns.city')}</th>
                      <th scope="col">{t('admin.basis')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.memberNumber}>
                        <td>
                          <Link to={`/${locale}/takmicar/${one.memberNumber}`}>
                            {one.firstName} {one.lastName}
                          </Link>{' '}
                          <span className="table__member-number">{one.memberNumber}</span>
                        </td>
                        <td>{one.categoryCode}</td>
                        <td>{one.city}</td>
                        <td>
                          <span className={`tag tag--${one.membershipBasis}`}>
                            {t(`admin.basisValue.${one.membershipBasis}`)}
                          </span>
                        </td>
                      </tr>
                    ))}
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
