import { useState } from 'react'
import { Resource } from '../../components/Resource'
import type { BtlEvent } from '../../data/types'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import type { FieldOption } from '../../forms/types'
import { formatNumber, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { EditableCell } from './EditableCell'
import { EntityEditor, NewRecord, OpenRecord } from './EntityEditor'
import { RACES, recordsOf, type Editing } from './entityForms'
import '../member/Member.css'

/* Races, the level below an event. They are listed with the event they belong
 * to, because a race called "21 km" means nothing on its own and there are
 * dozens of them. */

/** How many rows the screen draws at once. There are well over a thousand races,
 *  and the browser is the one that suffers. */
const SHOWN = 60

/**
 * Which event a race belongs to is a closed list, but the list is data: twelve
 * hundred events have no business being copied into a form definition, so the
 * screen hands them to the renderer instead. The date is in the label because
 * the same race is run every year under the same name.
 */
function eventOptions(events: BtlEvent[], locale: string): FieldOption[] {
  return [...events]
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((one) => ({ value: one.id, labelKey: `${one.name}, ${formatShortDate(one.date, locale)}` }))
}

export function AdminRaces() {
  const { locale, t } = useI18n()
  const { edits, creations } = useSession()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = combinePair(useRaces(), useEvents())

  return (
    <div className="member">
      <h1>{t('admin.races')}</h1>
      <p className="member__note">{t('admin.racesNote')}</p>
      <p className="member__note">{t('admin.editNote')}</p>

      <Resource state={state}>
        {([races, events]) => {
          const all = recordsOf(RACES, races, edits, creations)

          if (editing !== null) {
            return (
              <EntityEditor
                entity={RACES}
                editing={editing}
                options={{ eventId: eventOptions(events, locale) }}
                onDone={() => setEditing(null)}
              />
            )
          }

          const eventNames = new Map(events.map((one) => [one.id, one.name]))
          const needle = search.trim().toLowerCase()
          const found = all.filter((one) =>
            `${one.name} ${eventNames.get(one.eventId) ?? ''}`.toLowerCase().includes(needle),
          )
          const rows = found.slice(0, SHOWN)

          return (
            <>
              <NewRecord entity={RACES} onOpen={() => setEditing({ mode: 'new' })} />

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
                      <th scope="col">{t('admin.form.record')}</th>
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
