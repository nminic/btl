import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { useLeagues } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { EditableCell } from './EditableCell'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { LEAGUES, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import '../member/Member.css'

/* Leagues, with the number of events each one carries. A league with no events
 * is the one to notice: it is announced, it appears in the navigation, and it
 * has nothing to rank (PDL P15). */
export function AdminLeagues() {
  const { locale, t } = useI18n()
  const overlay = useOverlay()
    const [editing, setEditing] = useState<Editing | null>(null)
  const state = useLeagues()

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the browser
          tab. Here it was a heading and a sentence or two above the work, and the
          moderator arrives having just read the name in the list he came from
          (owner, 30.07.2026). It stays in the markup so the page has a name for
          anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.leagues')}</h1>

      <Resource state={state}>
        {(leagues) => {
          const rows = recordsOf(LEAGUES, leagues, overlay)

          if (editing !== null) {
            return (
              <EntityEditor entity={LEAGUES} editing={editing} onDone={() => setEditing(null)} />
            )
          }

          return (
            <>
              <EntityBar entity={LEAGUES} onNew={() => setEditing({ mode: 'new' })} />

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.leagues')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('leagues.name')}</th>
                      <th scope="col">{t('rankings.season')}</th>
                      <th scope="col">{t('event.races')}</th>
                      <th scope="col">{t('admin.byCategory')}</th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((league) => (
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
                        <td>
                          <RowActions
                            entity={LEAGUES}
                            record={league}
                            name={league.name}
                            onOpen={() => setEditing({ mode: 'one', record: league })}
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
