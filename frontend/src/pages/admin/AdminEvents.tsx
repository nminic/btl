import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { useEvents } from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { EditableCell } from './EditableCell'
import { EntityEditor, NewRecord, OpenRecord } from './EntityEditor'
import { EVENTS, recordsOf, type Editing } from './entityForms'
import '../member/Member.css'

/* The calendar from the other side. Between 15 and 30 September this is the
 * screen the owner spends the period of looking around on, filling the season
 * in, so it opens on what is still ahead rather than on the whole archive. */
export function AdminEvents() {
  const { locale, t } = useI18n()
  const { edits, creations } = useSession()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = useEvents()
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="member">
      <h1>{t('admin.events')}</h1>
      <p className="member__note">{t('admin.eventsNote')}</p>
      <p className="member__note">{t('admin.editNote')}</p>

      <Resource state={state}>
        {(events) => {
          const all = recordsOf(EVENTS, events, edits, creations)

          if (editing !== null) {
            return (
              <EntityEditor entity={EVENTS} editing={editing} onDone={() => setEditing(null)} />
            )
          }

          const needle = search.trim().toLowerCase()
          const rows = all
            .filter((one) => (needle === '' ? one.date >= today : true))
            .filter((one) => `${one.name} ${one.city}`.toLowerCase().includes(needle))
            .sort((left, right) => left.date.localeCompare(right.date))
            .slice(0, 60)

          return (
            <>
              <NewRecord entity={EVENTS} onOpen={() => setEditing({ mode: 'new' })} />

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
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.id}>
                        <td>{formatShortDate(one.date, locale)}</td>
                        <td>
                          <EditableCell
                            id={one.id}
                            field="name"
                            value={one.name}
                            label={t('profile.columns.event')}
                          />
                        </td>
                        <td>
                          <EditableCell
                            id={one.id}
                            field="city"
                            value={one.city}
                            label={t('event.place')}
                          />
                        </td>
                        <td>{one.raceIds.length}</td>
                        <td>
                          <span className={`tag tag--${one.status}`}>
                            {t(`calendar.status.${one.status}`)}
                          </span>
                        </td>
                        <td>
                          <OpenRecord
                            name={one.name}
                            onOpen={() => setEditing({ mode: 'one', record: one })}
                          />
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
