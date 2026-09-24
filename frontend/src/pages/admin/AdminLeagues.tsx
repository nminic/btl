import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { useLeagues } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { LeagueRaceModeration } from './LeagueRaceModeration'
import { LEAGUES, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import '../member/Member.css'

/* Leagues, with the number of events each one carries. A league with no events
 * is the one to notice: it is announced, it appears in the navigation, and it
 * has nothing to rank. */
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
          /* EVERY LEAGUE SERVED IS OFFERED, AND NOTHING IS FILTERED OFF THIS
             SCREEN. Until 24.09.2026 a row at `btl-2027` was taken out here and
             on the public list, on the reading that the portal's own league was
             a row of this table like any other. The owner settled the shape on
             22.09.2026 (PDL P15a): „Balkanska trkacka liga je globalno
             takmicenje ... Ne kreira se i ne moderira", and „BTL ne treba da se
             cuva na isti nacin kao ostale lige jer je potpuno drugaciji
             koncept." So this table is the competitions that run ALONGSIDE,
             there is no such row, and a filter against one was a guard over an
             assumption that had already been overturned. */
          const rows = recordsOf(LEAGUES, leagues, overlay)

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
                    {rows.flatMap((league) => [
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
                      </tr>,
                      /* WHICH RACES COUNT TOWARDS THIS ONE, AND THE `+` THAT
                         PUTS ONE THERE (PDL P15a, P28b point 7).

                         In a row of its own under the league rather than in a
                         cell beside it, because it is a box that opens and what
                         it opens is a list of days and distances: inside the
                         five columns it would either squeeze the table or push
                         the page sideways, and the portal's rule is no sideways
                         scrolling from 360px up.

                         **It writes to the SERVER and the rest of this screen
                         does not**, and that is worth saying rather than
                         leaving to be noticed. Every entity here is entered and
                         changed through the session overlay, because the
                         prototype had no database; the races of a competition
                         are the first thing on this screen with a route behind
                         them (`LeagueWriteApi`), so they go to it. Bringing the
                         other six onto the server is one change for all seven
                         and not this one. */
                      <tr key={`${league.id}-races`}>
                        <td colSpan={5}>
                          <LeagueRaceModeration league={league} />
                        </td>
                      </tr>,
                    ])}
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
