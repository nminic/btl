import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { EditableCell } from './EditableCell'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/* Races, the level below an event. They are listed with the event they belong
 * to, because a race called "21 km" means nothing on its own and there are
 * dozens of them. */

/** How many rows the screen draws at once. There are well over a thousand races,
 *  and the browser is the one that suffers. */
const SHOWN = 60

export function AdminRaces() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const [search, setSearch] = useState('')
  const state = combinePair(useRaces(), useEvents())

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.races')}</h1>
      <p className="member__note">{t('admin.racesNote')}</p>
      <p className="member__note">{t('admin.editNote')}</p>

      <Resource state={state}>
        {([races, events]) => {
          const eventNames = new Map(events.map((one) => [one.id, one.name]))
          const needle = search.trim().toLowerCase()
          const found = races.filter((one) =>
            `${one.name} ${eventNames.get(one.eventId) ?? ''}`.toLowerCase().includes(needle),
          )
          const rows = found.slice(0, SHOWN)

          return (
            <>
              <div className="rankings__filters">
                <label className="rankings__field rankings__field--wide">
                  <span>{t('competitors.search')}</span>
                  <input
                    type="search"
                    value={search}
                    placeholder={t('admin.searchRaces')}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>

              <p className="rankings__count">
                {t('admin.showing', { count: rows.length })}
                {/* Said out loud, or an administrator reads a cut list as the
                    whole list and concludes a race is missing. */}
                {found.length > rows.length && ` ${t('admin.ofMany', { count: found.length })}`}
              </p>

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.races')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('profile.columns.event')}</th>
                      <th scope="col">{t('admin.raceName')}</th>
                      <th scope="col">{t('rankings.columns.distance')}</th>
                      <th scope="col">{t('rankings.columns.ascent')}</th>
                      <th scope="col">{t('rankings.columns.descent')}</th>
                      <th scope="col">{t('rankings.columns.category')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.id}>
                        <td>{eventNames.get(one.eventId) ?? t('admin.noEvent')}</td>
                        <td>
                          <EditableCell
                            id={one.id}
                            field="name"
                            value={one.name}
                            label={t('admin.raceName')}
                          />
                        </td>
                        <td>{formatNumber(one.distanceKm, locale, 1)}</td>
                        <td>{formatNumber(one.ascentM, locale)}</td>
                        <td>{formatNumber(one.descentM, locale)}</td>
                        <td>{t(`category.${one.category}`)}</td>
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
