import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { useEvents } from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/* The calendar from the other side. Between 15 and 30 September this is the
 * screen the owner spends the period of looking around on, filling the season
 * in, so it opens on what is still ahead rather than on the whole archive. */
export function AdminEvents() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const [search, setSearch] = useState('')
  const state = useEvents()
  const today = new Date().toISOString().slice(0, 10)

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.events')}</h1>
      <p className="member__note">{t('admin.eventsNote')}</p>

      <Resource state={state}>
        {(events) => {
          const needle = search.trim().toLowerCase()
          const rows = events
            .filter((one) => (needle === '' ? one.date >= today : true))
            .filter((one) => `${one.name} ${one.city}`.toLowerCase().includes(needle))
            .sort((left, right) => left.date.localeCompare(right.date))
            .slice(0, 60)

          return (
            <>
              <div className="rankings__filters">
                <label className="rankings__field rankings__field--wide">
                  <span>{t('competitors.search')}</span>
                  <input
                    type="search"
                    value={search}
                    placeholder={t('admin.searchEvents')}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>

              <p className="rankings__count">{t('admin.showing', { count: rows.length })}</p>

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.events')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('profile.columns.date')}</th>
                      <th scope="col">{t('profile.columns.event')}</th>
                      <th scope="col">{t('event.place')}</th>
                      <th scope="col">{t('event.races')}</th>
                      <th scope="col">{t('admin.state')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.id}>
                        <td>{formatShortDate(one.date, locale)}</td>
                        <td>
                          <Link to={`/${locale}/kalendar/${one.slug}`}>{one.name}</Link>
                        </td>
                        <td>{one.city}</td>
                        <td>{one.raceIds.length}</td>
                        <td>
                          <span className={`tag tag--${one.status}`}>
                            {t(`calendar.status.${one.status}`)}
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
