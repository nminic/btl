import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { useEvents } from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { EditableCell } from './EditableCell'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { EVENTS, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import '../member/Member.css'

/* The calendar from the other side. Between 15 and 30 September this is the
 * screen the owner spends the period of looking around on, filling the season
 * in, so it opens on what is still ahead rather than on the whole archive. */
export function AdminEvents() {
  const { locale, t } = useI18n()
  const overlay = useOverlay()
  const [search, setSearch] = useState('')
  /** What was opened by pressing something on this screen. */
  const [chosen, setChosen] = useState<Editing | null>(null)
  const state = useEvents()
  const today = useToday()
  /**
   * The record this screen was sent to open, and the field to open it at.
   *
   * Copying an event happens on the event's own page and ends here, on the form
   * for the copy with the cursor in the date (owner, 03.08.2026). The address
   * carries it because a screen cannot be told anything else: the editor is
   * state inside this component, and a link is what the other page has.
   */
  const [params, setParams] = useSearchParams()
  const asked = params.get('zapis')

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.events')}</h1>

      <Resource state={state}>
        {(events) => {
          const all = recordsOf(EVENTS, events, overlay)
          /* Worked out rather than copied into state.
           *
             It was an effect that put the record from the address into state,
             and `recordsOf` builds its records fresh on every render, so the
             record was a new object every time, the effect saw a changed value
             every time, and it set state every time: the screen never settled,
             and pressing anything that led away from it left the address changed
             and the old screen still drawn.
           *
             Read here, there is nothing to keep in step. What the address names
             is the form for that record; what somebody pressed wins over it,
             because they pressed it later. */
          const wanted = asked === null ? undefined : all.find((one) => String(one.id) === asked)
          const editing: Editing | null =
            chosen ?? (wanted === undefined ? null : { mode: 'one', record: wanted })

          if (editing !== null) {
            return (
              <EntityEditor
                entity={EVENTS}
                editing={editing}
                /* The date, and only where the address asked for a record. A
                   form that grabs the cursor is a form that has taken the page
                   away from whoever opened it, and the copy is the one case
                   where the cursor already knows where it is wanted. */
                openAt={chosen === null && asked !== null ? 'date' : undefined}
                onDone={() => {
                  setChosen(null)
                  /* And the address forgets it, so leaving the form and coming
                     back to this screen does not open it again. */
                  setParams({}, { replace: true })
                }}
              />
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
              <EntityBar entity={EVENTS} onNew={() => setChosen({ mode: 'new' })}>
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
              </EntityBar>

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
                          <RowActions
                            entity={EVENTS}
                            record={one}
                            name={one.name}
                            onOpen={() => setChosen({ mode: 'one', record: one })}
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
