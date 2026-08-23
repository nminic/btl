import { useState } from 'react'
import { useToday } from '../../clock/useClock'
import { isoDate } from '../../forms/dateField'
import { Resource } from '../../components/Resource'
import {
  RESULTS,
  combinePair,
  dataOr,
  failed,
  useEvents,
  useRaces,
  useResults,
} from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { EVENTS, RACES, eventClash, recordsOf, type Editing, type EntityDef } from './entityForms'
import { dogadjaj } from '../../forms/definitions'
import type { FormDef } from '../../forms/types'
import type { Race } from '../../data/types'
import { categoryOf } from '../../data/raceCategory'
import { EventRaces } from './EventRaces'
import { allFinished, rowsOf, storedRow, type RaceRow } from './raceRows'
import { useOverlay } from './overlay'
import '../member/Member.css'
import { fieldDate } from '../../forms/dateField'
import { useFilterParams } from '../../app/useFilterParams'

/**
 * The event form as a copy is asked it: without the town, the country and the
 * kind.
 *
 * A copy has all three out of the event it came from and none of them is in
 * question (owner, 23.08.2026: „ne treba da se pominju Mesto, Država, Vrsta
 * događaja nego se kopiraju po default-u"). „Istaknuto" stays, because being
 * singled out is a choice about this running of the race.
 *
 * Left off the form rather than filled in and hidden: a save writes the fields the
 * form carries, so what is not asked keeps what the record already had. The town
 * carries the country, so taking the town takes both.
 */
const copyOfEvent: FormDef = {
  ...dogadjaj,
  fields: dogadjaj.fields.filter((one) => one.name !== 'city' && one.name !== 'kind'),
}

/**
 * The races of one event, read off the overlaid list.
 *
 * `recordsOf` answers with records of whatever shape an entity keeps; the rows
 * need races. Read field by field rather than asserted into a `Race`, so a record
 * missing one of them comes out as a row that says so rather than as a race with
 * `undefined` inside it.
 */
function racesUnder(all: Record<string, unknown>[], event: string): Race[] {
  return all
    .filter((one) => String(one.eventId) === event)
    .map((one) => ({
      id: String(one.id),
      eventId: String(one.eventId),
      date: String(one.date),
      distanceKm: Number(one.distanceKm),
      ascentM: Number(one.ascentM),
      descentM: Number(one.descentM),
      category: categoryOf(Number(one.distanceKm)),
    }))
}

/* The calendar from the other side. Between 15 and 30 September this is the
 * screen the owner spends the period of looking around on, filling the season
 * in, so it opens on what is still ahead rather than on the whole archive. */
export function AdminEvents() {
  const { locale, t } = useI18n()
  const { editRecord, remove, create, creations } = useSession()
  const overlay = useOverlay()
  const [search, setSearch] = useState('')
  /* And what was opened by pressing something somewhere else. The calendar
     sends a date here (`?nov=2027-05-08`), which is a `+` pressed on that day
     (owner, 12.08.2026). Read once, into the same state a press on this screen
     writes, so there is one way of being open and not two.

     A date that is not a date opens an empty form rather than nothing: a
     mistyped address is not worth a screen that refuses to work. Round trip and
     not a shape test, because „2027-13-45" has the shape of a date and is not
     one: `isoDate` gives back only what a calendar really holds, so a day that
     survives the journey there and back is a day that exists. */
  const [params, setParams] = useFilterParams()
  const askedDate = params.get('nov')
  const askedDay = askedDate === null ? '' : fieldDate(askedDate)
  const [chosen, setChosen] = useState<Editing | null>(
    askedDate === null ? null : { mode: 'new', start: { date: isoDate(askedDay) === askedDate ? askedDay : '' } },
  )
  /* The event entered a moment ago, so its races can be added under it while
     the confirmation of the save is still on screen. */
  const [justMade, setJustMade] = useState<string | null>(null)
  /**
   * The races of the open event as they stand, before anything is saved.
   *
   * Held here and not in the table, because the one button under the table writes
   * them (owner, 23.08.2026): the event and the mornings it runs on are one
   * question, asked once and refused once.
   *
   * Keyed by the event they were read off, so opening another event lines them up
   * again. Held as state rather than worked out on every render, because they are
   * what somebody is typing into.
   */
  const [held, setHeld] = useState<{ of: string; rows: RaceRow[] }>({ of: '', rows: [] })
  /** Whether the last press was refused over a row, which is when the rows start
   *  saying what is missing. */
  const [refused, setRefused] = useState(false)
  /**
   * How many times the races have moved the event while its own form was open.
   *
   * The form is seeded once, when it is drawn (FormRenderer), and the races
   * beside it may move the event: entering one on an earlier morning, or taking
   * the first one away, makes that day the event's (owner, 10.08.2026). The form
   * then holds the day the event used to be on, and saving it, even untouched,
   * moved every race by the difference between the two: delete the first race of
   * a two-day event, press Sačuvaj without touching anything, and the race that
   * was left went back to the morning nothing runs on any more.
   *
   * So the form is drawn again from the record as it now is. Counted rather than
   * keyed on the date itself, because the date also changes when the form is the
   * thing that changed it, and there the form must stay where it is: it has just
   * said "Sačuvano" and remounting would take that away.
   */
  const state = combinePair(useEvents(), useRaces())
  /* Read for what it is worth rather than waited for. No row here shows a
     result: they are read only to take them down with the event they belong to.
     Waited for, a results file that failed replaced this whole screen with "the
     data cannot be loaded", and with it every way of editing an event or a race,
     over a file nothing on it draws.

     What the deletion needs is waited for instead, in the one row that offers
     it: until the results are here there is nothing to take along, and an event
     deleted in that window leaves its results pointing at an event that is gone,
     each still counting in the standing and linking to a page that says it does
     not exist. The event's own page holds the same two buttons back altogether
     until both files are ready (EventDetail.tsx); here the screen is the work
     itself, so only the deletion waits.

     Three states, because `dataOr` answers the same for a file on its way and a
     file that failed. Told to wait for something that never arrives, an
     administrator who holds the right is refused it for good, and the row says
     it is waiting: the same conflation this whole change is about, one row
     further in. */
  const resultsState = useResults()
  const results = dataOr(resultsState, null)
  const resultsFailed = failed(resultsState)
  const today = useToday()
  /**
   * The record this screen was sent to open, and the field to open it at.
   *
   * Copying an event happens on the event's own page and ends here, on the form
   * for the copy with the cursor in the date (owner, 03.08.2026). The address
   * carries it because a screen cannot be told anything else: the editor is
   * state inside this component, and a link is what the other page has.
   */
  const asked = params.get('zapis')
  /* And whether this is the copy being made, said by the press that made it
     rather than worked out here: a copy is edited again like any other event a
     season later, and both its id and its `copiedFrom` would still say „copy"
     then (event/EventActions.tsx). */
  const copying = params.get('kopija') === '1'

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.events')}</h1>

      <Resource state={state}>
        {([events, races]) => {
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
          const allResults = results === null ? [] : recordsOf(asResults, results, overlay)
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
              ? /* And the one that has just been entered, which is a record with
                   an identity even though the form is still the form that made
                   it: its races are entered under it right away, one by one,
                   rather than after going back to a list of eleven hundred to
                   find it again (owner, 11.08.2026). */
                all.find((one) => one.id === justMade)
              : all.find((one) => one.id === String(editing.record[EVENTS.idField]))

          if (editing !== null) {
            /* The rows this screen is holding, or the event's races lined up as
               rows where it is not holding any yet. Worked out rather than put
               into state by an effect: state that mirrors a list is state that
               falls out of step with it, and this screen has been bitten by an
               effect that copied a record already (see `wanted` above). */
            const under = openEvent?.id ?? 'nov'
            const current =
              held.of === under
                ? held.rows
                : rowsOf(racesUnder(allRaces, under), fieldDate)
            const setCurrent = (next: RaceRow[]) => {
              setHeld({ of: under, rows: next })
            }

            return (
              <>
                {(
                  <EntityEditor
                    entity={EVENTS}
                    /* What a copy is not asked for: it has its town, its country
                       and its kind out of the event it came from, and none of the
                       three is in question (owner, 23.08.2026). A save writes the
                       fields it carries, so what is not asked stays as it was. */
                    form={copying ? copyOfEvent : undefined}
                    titleKey={copying ? 'admin.form.copying' : undefined}
                    beneath={(values) => (
                      <EventRaces
                        eventName={
                          String(values.name) === '' ? t('admin.events') : String(values.name)
                        }
                        eventDate={String(values.date)}
                        rows={current}
                        onRows={setCurrent}
                        refused={refused}
                      />
                    )}
                    /* One press writes the event and every one of its mornings, so
                       one unfinished row is the whole press refused (owner,
                       23.08.2026: „validacija mi ne da da nastavim dalje dok svaki
                       red nema sve obavezne podatke"). */
                    alsoRefuses={() => {
                      const short = !allFinished(current)

                      setRefused(short)

                      return short ? 'admin.form.racesRefused' : undefined
                    }}
                    editing={
                      openEvent === undefined ? editing : { mode: 'one', record: openEvent }
                    }
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
                              (editing.mode === 'one'
                                ? String(editing.record[EVENTS.idField])
                                : ''),
                          )
                          .map((each) => each.slug),
                        /* The same record the editor was handed, so the address
                           the clash is tested against is the address the save
                           will write. Undefined where a new event is being
                           entered, which is what says there is nothing to
                           keep. */
                        openEvent,
                      )
                    }
                    /**
                     * And its races, in the same press (owner, 23.08.2026).
                     *
                     * Three things happen and the order matters. A row that was a
                     * race and is no longer on the table is taken away first, so a
                     * length deleted and entered again in one sitting does not
                     * meet itself. A row that is already a race is written over. A
                     * row that is new is created under the event that was written
                     * a line above, which is what the identity handed in is for: a
                     * new event has none until that moment.
                     *
                     * Then the event follows its first morning (owner,
                     * 10.08.2026): its date is the day it begins, so a race
                     * entered on an earlier one makes that day the event's.
                     */
                    alsoSave={(values, written) => {
                      const was = allRaces.filter((one) => String(one.eventId) === written)
                      const kept = new Set(
                        current.filter((row) => row.id !== '').map((row) => row.id),
                      )

                      for (const race of was) {
                        if (!kept.has(race.id)) {
                          remove(RACES.id, race.id)
                        }
                      }

                      /* Counted against the races already created in this visit and
                         not against the rows on the table, which is what it was for
                         a moment: a row deleted and another entered gives two rows
                         and one creation, and the second would land on an id the
                         first already has. */
                      let made = (creations[RACES.id] ?? []).filter((one) =>
                        one.id.startsWith(`${written}-trka-`),
                      ).length

                      for (const row of current) {
                        if (row.id === '') {
                          made += 1
                          create(RACES.id, `${written}-trka-${String(made)}`, storedRow(row, written))
                        } else {
                          editRecord(row.id, storedRow(row, written))
                        }
                      }

                      const first = current
                        .map((row) => isoDate(row.date))
                        .filter((day) => day !== '')
                        .sort()[0]

                      if (first !== undefined && first !== isoDate(String(values.date))) {
                        editRecord(written, { date: first })
                      }
                    }}
                    onCreated={setJustMade}
                    onDone={() => {
                      setChosen(null)
                      setJustMade(null)
                      setHeld({ of: '', rows: [] })
                      setRefused(false)
                      /* And the address forgets it, so leaving the form and coming
                         back to this screen does not open it again. */
                      setParams({}, { replace: true })
                    }}
                  />
                )}
              </>
            )
          }

          const needle = search.trim().toLowerCase()
          const found = all
            .filter((one) => (needle === '' ? one.date >= today : true))
            .filter((one) => `${one.name} ${one.city}`.toLowerCase().includes(needle))
            .sort((left, right) => left.date.localeCompare(right.date))
          /* Sixty rows and no more, of eleven hundred. */
          const rows = found.slice(0, 60)

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

              {/* And how many were left out, which used to be said only on the
                  screen of races. That screen is gone since 06.08.2026 and this
                  one is the way to every race, so a search that matches five
                  hundred events drew sixty of them, the earliest sixty, and said
                  nothing: everything from this season on was behind a cut with
                  no sign of it. */}
              <p className="rankings__count">
                {t('admin.showing', { count: rows.length })}
                {found.length > rows.length ? ` ${t('admin.ofMany', { count: found.length })}` : ''}
              </p>

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.events')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('profile.columns.date')}</th>
                      <th scope="col">{t('profile.columns.event')}</th>
                      <th scope="col">{t('event.place')}</th>
                      <th scope="col">{t('event.races')}</th>
                      <th scope="col">{t('admin.field.kind')}</th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.id}>
                        <td>{formatShortDate(one.date, locale)}</td>
                        {/* Read here and changed on the form, unlike the town
                            beside it: the address an event answers at is made
                            out of its name and its year (entityForms.ts), and a
                            cell writes one field and cannot put the address
                            right after it. Renamed in a cell, an event kept the
                            address of the name it used to have. */}
                        <td>{one.name}</td>
                        {/* Read here and changed on the form, like the name
                            beside it. A town carries the country it is in and a
                            cell writes one field, so a town corrected here left
                            the event in the country of the town it used to be
                            in, and nothing on any screen shows a country. */}
                        <td>{one.city}</td>
                        {/* Counted from the races themselves rather than from
                            a list the event carries. The list is filled by the
                            generator and by nothing else, so an event entered or
                            copied here said it had none while its races were in
                            the next screen along. */}
                        <td>{allRaces.filter((race) => race.eventId === one.id).length}</td>
                        {/* What is being put on, in words. Every event has a
                            kind: the type requires it, the form opens on Trka,
                            and the copy carries it (owner, 10.08.2026). There
                            is no fallback here, and the day a backend answers
                            without the field this cell prints the name of the
                            key, which is the loudest way to find out. */}
                        <td>{t(`event.kind.${one.kind}`)}</td>
                        <td>
                          <RowActions
                            entity={EVENTS}
                            record={one}
                            name={one.name}
                            onOpen={() => setChosen({ mode: 'one', record: one })}
                            whyNoRemove={
                              results !== null
                                ? undefined
                                : resultsFailed
                                  ? t('admin.resultsFailed')
                                  : t('admin.waitingForResults')
                            }
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
                              for (const race of allRaces.filter(
                                (each) => each.eventId === one.id,
                              )) {
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
