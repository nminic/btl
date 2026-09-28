import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import type { League } from '../../data/types'
import { failed, useEvents, useLeagues, useRaces } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import type { FormValues } from '../../forms/types'
import { recordKey } from '../../session/context'
import { EntityBar, EntityEditor, RowActions, type Saving } from './EntityEditor'
import { LeagueRaceModeration } from './LeagueRaceModeration'
import { countedDaysOf, countedRacesOf } from './leagueCounted'
import { LEAGUES, recordsOf, type Editing, type Overlay } from './entityForms'
import { WHEN_WRITING_A_LEAGUE, identityIn, upsertFrom } from './leagueWrites'
import '../member/Member.css'

/** An overlay holding nothing, which is what this screen starts every visit with. */
const NOTHING_YET: Overlay = { edits: {}, creations: {}, deletions: {} }

/**
 * HOW MANY DAYS A COMPETITION COUNTS, WORKED OUT OF THE RACES IT COUNTS AND NOT OF THE
 * `eventIds` THE ANSWER CARRIED.
 *
 * **The fault this closes reached QA and the owner read it as work lost** (28.09.2026:
 * „Popunim ovo ovako i onda se nista ne sacuva, nije se kreirala Liga sa ovim dogadjajem").
 * Nothing was lost - `league` held the row, `league_race` held four, and `GET /api/leagues`
 * answered with all of it - but this cell was drawing `league.eventIds.length` off the answer
 * the screen had been served BEFORE the panel under it wrote anything, and a competition made
 * during a visit carries the empty list `entityForms.ts` gives a new record. So the truest
 * record the portal has had a false sentence written over it, which is the worst shape a fault
 * can take.
 *
 * **Three states and not two, which is the shape `pages/Leagues.tsx` already gives the same
 * number on the public list, word for word.** Nothing while the calendar is coming, because a
 * nought drawn before the races have landed is this cell telling the same lie in a smaller
 * size; the word for „unknown" if they will not come at all; the number when they are here.
 *
 * **WHAT IT COSTS, NAMED AS A DECISION.** The number used to appear with the name of the
 * competition, out of an answer of a few kilobytes, and now waits on the races and the events.
 * That is the same bargain the public list took on 13.09.2026 and for the same reason, and
 * both files are here rather than one because the two read DIFFERENT lists: the public one has
 * no panel and reads the days off `eventIds`, this one reads what the screen is holding.
 */
function CountedDays({ counted }: { counted: number[] }) {
  const { locale, t } = useI18n()
  const events = useEvents()
  const races = useRaces()

  if (failed(events, races)) {
    return <>{t('leagues.unknown')}</>
  }

  if (events.status !== 'ready' || races.status !== 'ready') {
    return null
  }

  const days = countedDaysOf(counted, races.data, events.data).length

  return days === 0 ? (
    <span className="tag tag--checking">{t('admin.noEvents')}</span>
  ) : (
    <>{formatNumber(days, locale)}</>
  )
}

/**
 * Leagues, with the number of events each one carries. A league with no events
 * is the one to notice: it is announced, it appears in the navigation, and it
 * has nothing to rank.
 *
 * **THIS SCREEN WRITES TO THE SERVER AND SIX OTHERS STILL DO NOT** (PDL P28c point 2,
 * owner 24.09.2026: „Svi ekrani administracije prestaju da pisu u sesijski sloj i pocinju
 * da zovu rute", with his reason - „bez toga nijedan entitet unet kroz portal stvarno ne
 * postoji, pa se ni liga ne moze isprobati iako su joj rute gotove"). The competitions go
 * first because they are the entity whose routes were already finished and unreachable:
 * `LeagueWriteApi` has been able to make, change and delete one since B40 while nothing
 * called it.
 *
 * **WHAT THAT COST BEFORE TODAY, AND IT IS A MEASUREMENT RATHER THAN AN ARGUMENT.** A
 * competition entered here was remembered as an overlay, and an entity filed under `id`
 * takes its identity from `admin/raceIds.ts`, which counts DOWN from nought so that
 * nothing it hands out can collide with a `bigserial`. So the first competition entered
 * during a visit was number `-1`, and the panel of races underneath it - which HAS been
 * speaking to the server since 24.09.2026 - posted to `/api/leagues/-1/races`. The screen
 * confirmed a save, drew a row, and every race put into that row went nowhere.
 *
 * **NOTHING ABOUT THE OTHER SIX ENTITIES MOVES.** `EntityEditor` and `RowActions` grew one
 * optional argument each and behave exactly as they did where it is not passed, which is
 * every other screen. A change to what a member or an event does on save is six screens'
 * worth of risk riding on one competition's, and this increment is not that.
 */
export function AdminLeagues() {
  const { locale, t } = useI18n()
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = useLeagues()

  /**
   * WHAT THIS VISIT HAS WRITTEN, ON TOP OF WHAT THE SERVER ANSWERED WITH.
   *
   * **The same three-part overlay the session keeps, over a different store, and merged
   * by the same `recordsOf`.** Writing a second merge here would be a second answer to
   * „what does this list show", and the first fault of that shape is always the one the
   * session's own note names: a record somebody deleted going on standing in a list,
   * which reads as a screen that has not refreshed.
   *
   * **Why anything is held at all, when the server now knows.** A screen that is still
   * mounted never asks its resource again - `useResource`'s effect runs once, on the
   * name, which does not change while this stands - so there is nothing here to re-read
   * the moment a write comes back. What is held is therefore what the server has just
   * ACCEPTED, never what this screen hopes it did: every one of the three is written
   * inside the branch that ran only because an answer said the write went through. That
   * is the arrangement `LeagueRaceModeration` beside it already uses and gives its
   * reason for.
   *
   * **AND, SINCE 25.09.2026, THE CACHE BEHIND ALL OF THIS DOES NOT OUTLIVE A SUCCESSFUL
   * WRITE EITHER.** A review measured what holding this locally cost the moment it
   * stopped being the session's: the session survives a screen unmounting and this does
   * not, so a competition made or renamed here was gone the instant the router carried a
   * reader to another screen and back - the row was never lost, only what this component
   * remembered was. `saveOne` and `deleteOne` below call `clearResourceCache('leagues')`
   * once the route confirms the write, so the NEXT mount - of this screen or of the
   * public list - asks the server again rather than reading the array this visit fetched
   * before anything was saved.
   */
  const [written, setWritten] = useState<Overlay>(NOTHING_YET)

  /**
   * WHICH RACES EACH COMPETITION COUNTS, AS THIS VISIT HAS LEFT IT, over what was served.
   *
   * **The one home for a fact two things on this screen draw**, and it is here rather than in
   * the panel because the panel is not the only reader: the count in the row above it is the
   * other, and until 28.09.2026 the two were separate stores. The panel held its own
   * `useState` and the row counted `League.eventIds` off the served answer, so a race written
   * through the panel reached one of them and not the other. That is what the owner met on QA
   * and read as a competition that had not saved.
   *
   * **The shape is `pages/Leagues.tsx`'s `standing`, word for word** - „what this visit wrote
   * into it, or what was served" - and nothing is put in that a route has not accepted.
   *
   * **And it outlives the editor, which the panel's own state did not.** Opening a form swaps
   * the whole subtree below, so every panel is unmounted and mounted again; this component is
   * not, so a race entered and then a form opened and closed no longer reads as a race that
   * went away.
   */
  const [counting, setCounting] = useState<Record<number, number[]>>({})

  /** What just happened, for whoever is not watching the list. */
  const [said, setSaid] = useState('')

  /** Why a deletion did not happen, beside the row it was pressed on. */
  const [refused, setRefused] = useState<{
    id: number
    answer: Exclude<Answer, { got: 'done' }>
  } | null>(null)

  /** The words for an answer that was not „it was done". */
  function saying(answer: Exclude<Answer, { got: 'done' }>) {
    return <ServerSaid answer={answer} refusals={WHEN_WRITING_A_LEAGUE} />
  }

  /**
   * MAKING ONE OR CHANGING ONE, AND THE IDENTITY COMES BACK FROM THE DATABASE.
   *
   * **`POST` answers 201 with the id it handed out** (`LeagueWriteApi.Written`), and that
   * id is the whole of what the row, the panel of races under it and both of the other two
   * routes are addressed by. Read off the answer through `identityIn`, which refuses
   * anything that is not a whole number above nought - the range a `bigserial` lives in,
   * and deliberately not the range the session overlay used to hand out.
   *
   * **`PUT` answers 200 with the record**, and nothing of it is read: what the screen puts
   * in the row after a save is what was typed, which it already holds. Reading the record
   * back would make this a second home for the competition's own data.
   */
  async function saveOne(values: FormValues, text: Record<string, string>): Promise<Saving> {
    const mine = editing !== null && editing.mode === 'one' ? editing.record : null
    const id = mine === null ? null : Number(mine[LEAGUES.idField])
    const answer = await askTheServer(
      id === null ? '/api/leagues' : `/api/leagues/${id}`,
      upsertFrom(values),
      id === null ? 'POST' : 'PUT',
    )

    if (answer.got !== 'done') {
      return { said: saying(answer) }
    }

    /* THE NEXT MOUNT READS THE SERVER AND NOT THIS VISIT'S FIRST ANSWER. Cleared here
       rather than left to the two branches below, because both of them count as the
       write this screen exists to close: a made competition and a renamed one are
       equally gone from a remounted screen if only the local overlay is fixed and the
       cache is not (review, 25.09.2026). */
    clearResourceCache('leagues')

    if (id !== null) {
      setWritten((was) => ({
        ...was,
        edits: { ...was.edits, [recordKey(LEAGUES.id, id)]: text },
      }))

      return { written: String(id) }
    }

    /* THE ONE ANSWER THAT IS NEITHER A REFUSAL NOR SOMETHING THIS SCREEN CAN DRAW. The
       write happened - the route answered 201 - but without the identity there is no
       address for the row, for the panel under it or for either of the other two routes.
       Drawing a row anyway is exactly the fault this whole increment closes, one number
       further along, so nothing is drawn and the reader is told the truth: it is saved,
       and the screen has to be reloaded to see it. */
    const made = identityIn(answer.body)

    if (made === null) {
      return {
        said: (
          <p className="field__error" role="alert">
            {t('admin.leagueSavedUnseen')}
          </p>
        ),
      }
    }

    setWritten((was) => ({
      ...was,
      creations: {
        ...was.creations,
        [LEAGUES.id]: [...(was.creations[LEAGUES.id] ?? []), { id: String(made), values: text }],
      },
    }))

    return { written: String(made) }
  }

  /**
   * AND TAKING ONE AWAY, WHATEVER SEASON IT BELONGS TO AND WHETHER OR NOT IT HAS FROZEN.
   *
   * PDL P15c point 1, owner 22.09.2026, choosing between three outcomes: a competition
   * running alongside is deleted at any moment, frozen season or not. So this draws no
   * condition of its own and asks the route nothing extra: `LeagueWriteApi.remove` is the
   * one of its four routes that does not ask whether the season is frozen, and a screen
   * that refused first would be a second rule over a decision already taken.
   */
  async function deleteOne(league: League): Promise<void> {
    const answer = await askTheServer(`/api/leagues/${league.id}`, {}, 'DELETE')

    if (answer.got !== 'done') {
      setRefused({ id: league.id, answer })

      return
    }

    /* Cleared for the same reason `saveOne` clears it: a deletion this visit made is
       held below as an overlay over what the cache still carries, and a remounted
       screen reading that same stale array would draw the row back as though the
       delete had never happened, which is worse than a row that merely vanished. */
    clearResourceCache('leagues')
    setRefused(null)
    setSaid(t('admin.leagueGone'))
    setWritten((was) => ({
      ...was,
      /* OUT OF BOTH STORES, because a competition entered during this visit is held as a
         CREATION and one that was served is filtered out by a DELETION. Written into the
         second only, the row somebody just made would go on standing and he would press
         Delete on it again, against a competition the server has already forgotten. */
      creations: {
        ...was.creations,
        [LEAGUES.id]: (was.creations[LEAGUES.id] ?? []).filter(
          (one) => one.id !== String(league.id),
        ),
      },
      deletions: {
        ...was.deletions,
        [LEAGUES.id]: [...(was.deletions[LEAGUES.id] ?? []), String(league.id)],
      },
    }))
  }

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
          const rows = recordsOf(LEAGUES, leagues, written)

          /** Which races a competition counts now: what this visit wrote, or what was served. */
          function counted(id: number): number[] {
            return counting[id] ?? countedRacesOf(leagues, id)
          }

          /**
           * THE PANEL'S ROUTE HAS ACCEPTED A CHANGE, AND BOTH THINGS THAT READ IT HEAR ABOUT IT.
           *
           * **Two writes and not one, for the two different lifetimes this fact has.** The state
           * is what THIS mount draws, count and panel alike, because nothing re-reads a resource
           * a mounted screen already holds. The cache is what the NEXT mount reads - this screen
           * entered again, or the public list at `/lige` - and `POST /api/leagues/{id}/races`
           * changes what `GET /api/leagues` answers with, so an answer kept from before it is an
           * answer that is now wrong. `saveOne` and `deleteOne` above have cleared it since
           * 25.09.2026 for the same reason and this was the third write on this screen and the
           * only one that cleared nothing.
           *
           * The change arrives as a function of what was, rather than as the list it makes,
           * because two presses can be answered between one render and the next.
           */
          function nowCounting(id: number, change: (was: number[]) => number[]): void {
            clearResourceCache('leagues')
            setCounting((was) => ({ ...was, [id]: change(was[id] ?? countedRacesOf(leagues, id)) }))
          }

          if (editing !== null) {
            return (
              <EntityEditor
                entity={LEAGUES}
                editing={editing}
                /* WHO REFUSES AN ADDRESS SOMEBODY ALREADY ANSWERS AT, AND SINCE
                   25.09.2026 IT IS THE ROUTE ALONE. `taken` used to carry every
                   address on the screen, and `takenAddress` coloured the field
                   before anything was sent. That list can only ever be
                   INCOMPLETE - it is what this browser was served plus what this
                   visit made, while the table is what every administrator has
                   entered - so it refused some collisions and let others through
                   to a route that refuses all of them by name. Two sentences
                   about one fact, one of which cannot be made right. The route
                   decides: `add` writes with `on conflict (slug) do nothing` and
                   `change` with a `not exists` clause inside the statement, both
                   of which answer `theAddressIsTaken`. */
                save={saveOne}
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
                      {/* „Događaja", not `event.races`: this column has never counted races
                          (PDL, 28.09.2026, „Kolona u administraciji liga broji DANE, pa se
                          tako i zove"). The header used to borrow `event.races` and said
                          „Trke" over a cell that counts days, which is the same lie the public
                          list corrected on 13.09.2026 for the same fact - so this reads the
                          list's own key, `leagues.events`, rather than adding a second name
                          for one number. `event.races` stays exactly as it is for the three
                          screens that really do show races (`AdminEvents.tsx`, `EventDetail.tsx`
                          twice): reusing it here would have renamed their heading too. */}
                      <th scope="col">{t('leagues.events')}</th>
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
                          {/* OFF THE SAME LIST THE BOX UNDER THIS ROW DRAWS, which is what
                              stops the two saying different things about one competition. */}
                          <CountedDays counted={counted(league.id)} />
                        </td>
                        <td>
                          <RowActions
                            entity={LEAGUES}
                            record={league}
                            name={league.name}
                            onOpen={() => setEditing({ mode: 'one', record: league })}
                            deleteRecord={() => void deleteOne(league)}
                          />
                          {/* Why this one did not go, in the row it was pressed in.
                              The focus has already moved to the control that starts a
                              new record, as it does on every other list, so the words
                              carry themselves: `ServerSaid` draws them in an alert. */}
                          {refused !== null && refused.id === league.id && saying(refused.answer)}
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

                         **Since 25.09.2026 it is addressed by an identity the
                         DATABASE handed out**, for a competition entered during
                         this visit as much as for one that was served. It was
                         the first thing on this screen with a route behind it and
                         the rest of the screen has now followed; what that closes
                         is a panel that posted to `/api/leagues/-1/races`.

                         **AND WHAT IT COUNTS IS HANDED DOWN FROM HERE, out of the
                         answer THIS screen was served, rather than fetched again
                         out of the cache that answer arrived in.** The panel read
                         `arrivedResource('leagues')` at every mount until
                         25.09.2026, and `saveOne` and `deleteOne` above now EMPTY
                         that entry the moment a write goes through. Closing the
                         editor swaps this whole subtree, so each panel mounted
                         again and found nothing where its races had been - while
                         `state` up here still holds the served answer in full,
                         which is what `leagues` is. One home, reached one way.

                         **AND SINCE 28.09.2026 THE LIST GOES ON BEING THIS
                         SCREEN'S AFTER THE PANEL CHANGES IT** (`counting` above).
                         It was handed down as the served answer and then kept
                         inside the panel, which made two homes of one fact: the
                         count in the row was still counting `eventIds` off that
                         same served answer, so a race written through the panel
                         reached the box and not the count. Now the panel reports
                         what the route accepted, this holds it, and both the count
                         and the box are drawn off it.

                         A competition entered during this visit is in neither the
                         answer nor the cache, so it starts counting nothing, which
                         is what it does count until somebody puts a race in it. */
                      <tr key={`${league.id}-races`}>
                        <td colSpan={5}>
                          <LeagueRaceModeration
                            league={league}
                            counted={counted(league.id)}
                            onCounted={(change) => nowCounting(league.id, change)}
                          />
                        </td>
                      </tr>,
                    ])}
                  </tbody>
                </table>
              </div>

              {/* Said once and politely: the list beside it has already changed, and a
                  reader who is not looking at it gets the one sentence that says so.
                  The same shape the panel of races uses. */}
              <p aria-live="polite" className="visually-hidden">
                {said}
              </p>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
