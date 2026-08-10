import { useState } from 'react'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { RESULTS, combineResources, useEvents, useRaces, useResults } from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { EditableCell } from './EditableCell'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import {
  EVENTS,
  RACES,
  eventClash,
  recordsOf,
  type Editing,
  type EntityDef,
} from './entityForms'
import { EventRaces } from './EventRaces'
import { useOverlay } from './overlay'
import '../member/Member.css'
import { useFilterParams } from '../../app/useFilterParams'

/* The calendar from the other side. Between 15 and 30 September this is the
 * screen the owner spends the period of looking around on, filling the season
 * in, so it opens on what is still ahead rather than on the whole archive. */
export function AdminEvents() {
  const { locale, t } = useI18n()
  const { remove } = useSession()
  const overlay = useOverlay()
  const [search, setSearch] = useState('')
  /** What was opened by pressing something on this screen. */
  const [chosen, setChosen] = useState<Editing | null>(null)
  /** Which race of the open event is being edited, if any. Held here because
   *  the event's own form is put away while one is. */
  const [race, setRace] = useState<Editing | null>(null)
  const state = combineResources(useEvents(), useRaces(), useResults())
  const today = useToday()
  /**
   * The record this screen was sent to open, and the field to open it at.
   *
   * Copying an event happens on the event's own page and ends here, on the form
   * for the copy with the cursor in the date (owner, 03.08.2026). The address
   * carries it because a screen cannot be told anything else: the editor is
   * state inside this component, and a link is what the other page has.
   */
  const [params, setParams] = useFilterParams()
  const asked = params.get('zapis')

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.events')}</h1>

      <Resource state={state}>
        {([events, races, results]) => {
          const all = recordsOf(EVENTS, events, overlay)
          /* Through the overlay, like the events beside them. Read straight from
             the file the count below said an event copied here had no races,
             while its races were on the next screen along. */
          const allRaces = recordsOf(RACES, races, overlay)
          /* A result is not an entity anybody edits here, so there is no
             definition of one to reach for. What `recordsOf` reads off a
             definition is its `id` and its `idField`; everything else is carried
             along unread, and `EVENTS` is here only because the parameter is
             typed as a whole definition. Written out so the line is not read as
             a claim that a result is an event. */
          const asResults: EntityDef = { ...EVENTS, id: RESULTS, idField: 'id' }
          const allResults = recordsOf(asResults, results, overlay)
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

          /* The record the form is open on, as the event it is, so its races
             can be looked up. Found in the list rather than taken off the form's
             own record: the form carries what was handed to it, and the list is
             what the overlay has since made of it. */
          const openEvent =
            editing === null || editing.mode === 'new'
              ? undefined
              : all.find((one) => one.id === String(editing.record[EVENTS.idField]))

          if (editing !== null) {
            return (
              <>
                {race === null && (
                  <EntityEditor
                    entity={EVENTS}
                    editing={editing}
                    /* The date, and only where the address asked for a record. A
                       form that grabs the cursor is a form that has taken the page
                       away from whoever opened it, and the copy is the one case
                       where the cursor already knows where it is wanted. */
                    openAt={chosen === null && asked !== null ? 'date' : undefined}
                    /* Not onto an address another event already answers at. A copy
                       keeps the name and the day it was copied from, so saving one
                       without changing the date wrote a second event at the first
                       one's address, and everything that joins to an event by
                       address then meant both: deleting either took the other's
                       results with it (entityForms.ts, `eventClash`). */
                    also={(values) =>
                      eventClash(
                        values,
                        all
                          .filter(
                            (each) =>
                              each.id !==
                              (editing.mode === 'one' ? String(editing.record[EVENTS.idField]) : ''),
                          )
                          .map((each) => each.slug),
                      )
                    }
                    onDone={() => {
                      setChosen(null)
                      setRace(null)
                      /* And the address forgets it, so leaving the form and coming
                         back to this screen does not open it again. */
                      setParams({}, { replace: true })
                    }}
                  />
                )}

                {/* And its races, under the form that names it. A race is one
                    length of one morning and belongs to the event it is run at
                    (owner, 06.08.2026); it had a screen of its own, where finding
                    the event meant searching a list of eleven hundred. Only on a
                    record that exists: a new event has no identity to hang a race
                    on until it is saved. */}
                {openEvent !== undefined && (
                  <EventRaces
                    event={openEvent}
                    races={allRaces}
                    editing={race}
                    setEditing={setRace}
                  />
                )}
              </>
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
                        {/* Read here and changed on the form, unlike the town
                            beside it: the address an event answers at is made
                            out of its name and its day (entityForms.ts), and a
                            cell writes one field and cannot put the address
                            right after it. Renamed in a cell, an event kept the
                            address of the name it used to have. */}
                        <td>{one.name}</td>
                        <td>
                          <EditableCell
                            id={one.id}
                            field="city"
                            value={one.city}
                            label={t('event.place')}
                          />
                        </td>
                        {/* Counted from the races themselves rather than from
                            a list the event carries. The list is filled by the
                            generator and by nothing else, so an event entered or
                            copied here said it had none while its races were in
                            the next screen along. */}
                        <td>{allRaces.filter((race) => race.eventId === one.id).length}</td>
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
                            /* With its races and its results, which is what the
                               same deletion does from the event's own page
                               (event/EventActions.tsx). The races are defined
                               inside it and are shown nowhere else, so an event
                               deleted alone leaves them belonging to nothing and
                               invisible; a result carries the address of its
                               event, so left behind it goes on counting in the
                               standing, in the top boards and in the team
                               totals, each of them linking to a page that says
                               the event does not exist. Two buttons that delete
                               one thing must not delete two different amounts of
                               it. */
                            alsoRemove={() => {
                              for (const race of allRaces.filter((each) => each.eventId === one.id)) {
                                remove(RACES.id, race.id)
                              }

                              /* Only where the address belongs to this event
                                 alone. A result names its event by address, and
                                 a copy keeps the name and the day it was copied
                                 from until somebody changes the date, so for as
                                 long as two events answer at one address there
                                 is no telling whose result is whose. Deleting
                                 them then takes the other event's with it, which
                                 is worse than leaving them: the form refuses to
                                 save a second event onto a taken address
                                 (`eventClash`), so this is the window before
                                 that save. */
                              const shared = all.some(
                                (each) => each.id !== one.id && each.slug === one.slug,
                              )

                              for (const result of shared
                                ? []
                                : allResults.filter((each) => each.eventSlug === one.slug)) {
                                remove(RESULTS, result.id)
                              }
                            }}
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
