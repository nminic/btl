import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { MAIN_LEAGUE_SLUG } from '../../data/pricing'
import { useLeagues } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
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
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.leagues')}</h1>

      <Resource state={state}>
        {(leagues) => {
          /* Everything but the league the portal itself is (owner,
             10.08.2026): "Ona se podrazumeva i ne uređuje se." Every event
             counts towards it, its standings are the BTL tables, and there is
             nothing on this form anybody would ever change about it. Offered
             here it was a fourth row with a delete beside it.

             The same league is left off the public list of competitions, by the
             same name (pages/Leagues.tsx), so both screens mean one thing. */
          const rows = recordsOf(LEAGUES, leagues, overlay).filter(
            (one) => one.slug !== MAIN_LEAGUE_SLUG,
          )

          if (editing !== null) {
            return (
              <EntityEditor
                entity={LEAGUES}
                editing={editing}
                /* The addresses already answered at, so a second league cannot
                   be saved onto one. A league is filed under an id nobody sees
                   and answers at an address somebody chose, so the address is a
                   field like any other and the check is the one written pages
                   already use (entityForms.ts, `takenAddress`). */
                taken={rows.map((league) => league.slug)}
                onDone={() => setEditing(null)}
              />
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
                      <th scope="col">{t('admin.address')}</th>
                      <th scope="col">{t('rankings.season')}</th>
                      <th scope="col">{t('event.races')}</th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((league) => (
                      <tr key={league.id}>
                        {/* Read, not edited in place. Deliberate, and the
                            owner's own record of it (PENDING, 10.08.2026): a
                            league is changed on the form that now asks for
                            everything it answers at, so there is one place
                            where its name and its address are settled
                            together. The other five lists keep their cell. */}
                        <td>{league.name}</td>
                        <td>
                          {/* The whole address, read as well as clicked. The
                              written pages show one segment because that is
                              their whole address; a league answers a segment
                              below /liga, so showing the last part alone is a
                              404 to anybody who copies what they read rather
                              than following the link. */}
                          <Link to={`/${locale}/liga/${league.slug}`}>/liga/{league.slug}</Link>
                        </td>
                        <td>{league.season}</td>
                        <td>
                          {league.eventIds.length === 0 ? (
                            <span className="tag tag--checking">{t('admin.noEvents')}</span>
                          ) : (
                            formatNumber(league.eventIds.length, locale)
                          )}
                        </td>
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
