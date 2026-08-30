import { useState } from 'react'
import { useToday } from '../../clock/useClock'
import { fieldDate, isoDate, shiftDate } from '../../forms/dateField'
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
import type { FormDef, FormValues } from '../../forms/types'

import { categoryOf } from '../../data/raceCategory'
import { EventRaces } from './EventRaces'
import { RACE_KINDS } from '../../data/types'
import { allFinished, rowsOf, storedRow, type RaceOfRow, type RaceRow } from './raceRows'
import { nextNumber } from './raceIds'
import { nextSeason } from './nextSeason'
import { useOverlay } from './overlay'
import '../member/Member.css'
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
 *
 * What a row reads and no more (`RaceOfRow`), which since 30.08.2026 includes the
 * kind a race is and its limit. The table draws neither and cannot set either, but
 * saving the event writes every row back over the race it came from, so a field
 * left out here is a field that save deletes.
 */
function racesUnder(all: Record<string, unknown>[], event: string): RaceOfRow[] {
  return all
    .filter((one) => String(one.eventId) === event)
    .map((one) => ({
      id: String(one.id),
      eventId: String(one.eventId),
      /* Read straight, like the day beside it and for the same reason: both places
         a race can come from write it. One out of the file carries it, and one
         entered here is written by `storedRow`, which never leaves it out. A
         fallback here would be a second answer to a question that has one. */
      name: String(one.name),
      /* Read as the one word that means yes, because that is what the store keeps:
         every value in it is text (`session/context.ts`), so a boolean written into
         it comes back as the string „false", which is true. */
      renamed: one.renamed === 'yes' ? 'yes' : 'no',
      date: String(one.date),
      /* Read against the list of kinds that exist, because the row does act on the
         word: a race that does not fix its length is not asked for one
         (`raceRows.whatIsMissing`), so a word this portal does not know would put
         the table into a state where it refuses a length that race has not got.
         The store keeps every value as text (`session/context.ts`), and a record
         written before this field existed carries none. */
      kind: RACE_KINDS.find((known) => known === one.kind) ?? 'length',
      limitSeconds: Number(one.limitSeconds) || 0,
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
  const { editRecord, remove, create } = useSession()
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

            /**
             * Which kind of event the form in front of us is, on a screen where
             * the form does not always ask.
             *
             * A copy is not asked for its town, its country or its kind: it has
             * all three from the event it was copied from and none of them is in
             * question (owner, 23.08.2026), so `copyOfEvent` leaves the field out
             * and the values carry no kind at all. Read off the form where it is
             * there and off the record behind it where it is not.
             *
             * No third answer, and that is measured rather than assumed: a new
             * event is asked for its kind and opens on Trka (`entityForms.ts`,
             * `start`), and the one form that does not ask is a copy, which always
             * has the event it was copied from. A fallback of „race" written here
             * was a branch no test could reach.
             */
            /**
             * The two days a copy offers beside its calendar: next season, and a
             * week on (owner, 23.08.2026: „veoma zgodno za treninge i nedeljne
             * trkice").
             *
             * Both counted **from the event this was copied from**, never from what
             * the box holds now (owner, same day). That is what makes a button mean
             * one thing: a date changed by hand and then a press goes back to the
             * count from the original, and two presses give what one press gives.
             *
             * The event it came from is found by `copiedFrom`, which the copy writes
             * and nobody types (`event/copyOf.ts`). Empty where there is nothing to
             * count from, which is every screen but this one.
             */
            const from = copying
              ? all.find((one) => String(one.id) === String(openEvent?.copiedFrom))
              : undefined
            const steps =
              from === undefined
                ? undefined
                : [
                    {
                      label: '+1y',
                      title: t('admin.form.nextSeason'),
                      to: fieldDate(nextSeason(String(from.date))),
                    },
                    {
                      label: '+1w',
                      title: t('admin.form.nextWeek'),
                      to: fieldDate(shiftDate(String(from.date), 7)),
                    },
                  ]

            const kindOf = (values: FormValues): string =>
              String(values.kind ?? openEvent?.kind)

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
                    /* And nothing at all beneath a gathering or a training, which
                       have no races (owner, 23.08.2026). The rows are kept where
                       they are rather than thrown away, because the owner said in
                       the same breath what changing the kind does and does not do:
                       „prvo se sakriju sve trke sa ekrana, ali mogu da se vrate
                       ukoliko vratiš da je tip Trka. Ako se sačuva kao neki drugi
                       tip, u to čuvanje spada i brisanje svih trka koje su bile
                       povezane."

                       So this hides and the save deletes, and the two are not the
                       same moment. */
                    beneath={(values) => (
                      <EventRaces
                        eventName={
                          String(values.name) === '' ? t('admin.events') : String(values.name)
                        }
                        eventDate={String(values.date)}
                        rows={current}
                        onRows={setCurrent}
                        refused={refused}
                        /* Handed the kind rather than left off the screen when it is
                           not a race: it draws nothing either way, but kept here it
                           goes on remembering the day the rows were lined up with.
                           Taken off, it forgets, and the rows stop following the
                           event as soon as somebody touches the kind. */
                        hasRaces={kindOf(values) === 'race'}
                      />
                    )}
                    /* One press writes the event and every one of its mornings, so
                       one unfinished row is the whole press refused (owner,
                       23.08.2026: „validacija mi ne da da nastavim dalje dok svaki
                       red nema sve obavezne podatke"). */
                    steps={steps}
                    alsoRefuses={(values) => {
                      /* And nothing to refuse where there are no races to finish:
                         a gathering or a training has no table at all, so a row
                         left half typed before the kind was changed must not hold
                         the save. It is deleted by that save rather than asked
                         about (owner, 23.08.2026). */
                      const short = kindOf(values) === 'race' && !allFinished(current)

                      setRefused(short)

                      if (short) {
                        return 'admin.form.racesRefused'
                      }

                      /* And a save that would take the races away waits for the
                         results, exactly as the row that deletes the whole event
                         does (`admin.waitingForResults` below). Until that file is
                         here there is nothing to take along, and a round measured
                         what that costs: with the results refused, every race went
                         and every result stayed, each still counting in the standing
                         and pointing at a race that does not exist, while the screen
                         said „Sačuvano".

                         Asked of the state and not of the list: an empty list is the
                         same answer for a file still on its way, a file that failed,
                         and an event that truly has no results.

                         And only where this save would really take something away.
                         Measured by a round: asked of the kind alone, a gathering
                         with no races at all, and a gathering being entered for the
                         first time, were both refused while the file of results was
                         on its way, over a deletion that was never going to happen,
                         with a message about deleting. That file is the largest the
                         portal has, and this screen is built to work without it.

                         The two words the delete row uses, and for the same reason:
                         a file on its way and a file that failed are not the same
                         news, and „waiting" over a file that will never come is a
                         screen that asks somebody to wait forever. */
                      /* Counted over what the save really deletes, which is the list
                         as it was filed and not the rows on the screen. Measured by a
                         round when it was counted over the rows: delete the one row
                         of an event, change the kind, press Sačuvaj, and the guard
                         let it through while the save still took that race down and
                         left its result behind, counting in the standing and pointing
                         at a race that is gone.

                         Races and not results, and that is the whole of it: a result
                         only exists where a race did, so an event with no filed race
                         has nothing on its address either. Which is also why the case
                         of results without races is closed here rather than measured:
                         the only way to make one was the fault above. */
                      /* Counted the way the save counts: a filed race that no surviving
                         row keeps is a race this save takes away, whatever the kind.
                         Asked of the kind alone it covered only the sweep that empties
                         a whole event, and let a single deleted row through while that
                         row's results were still on their way, which is the same fault
                         the round above measured, one race at a time instead of twelve.
                         Where the kind is not a race nothing survives at all, so every
                         filed race counts, exactly as it did before. */
                      const survives =
                        kindOf(values) === 'race'
                          ? new Set(current.filter((row) => row.id !== '').map((row) => row.id))
                          : new Set<string>()

                      const takesAway = allRaces.some(
                        (one) => String(one.eventId) === under && !survives.has(one.id),
                      )

                      if (!takesAway || results !== null) {
                        return undefined
                      }

                      return resultsFailed ? 'admin.resultsFailed' : 'admin.waitingForResults'
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
                     * The day the event begins is folded into the values before
                     * any of this, in `alsoFolds` below.
                     */
                    alsoSave={(values, written) => {
                      const was = allRaces.filter((one) => String(one.eventId) === written)

                      /* A gathering or a training has no races, and saving one as
                         such is what takes the races it used to have away. Owner,
                         23.08.2026, on what changing the kind does and does not do:
                         „prvo se sakriju sve trke sa ekrana, ali mogu da se vrate
                         ukoliko vratiš da je tip Trka. Ako se sačuva kao neki drugi
                         tip, u to čuvanje spada i brisanje svih trka koje su bile
                         povezane."

                         So the rows are kept on the screen while the table is
                         hidden, and nothing is written for them here: they are all
                         unkept, and the loop below has nothing to walk. */
                      const kept =
                        kindOf(values) === 'race'
                          ? new Set(current.filter((row) => row.id !== '').map((row) => row.id))
                          : new Set<string>()

                      const gone = new Set<string>()

                      for (const race of was) {
                        if (!kept.has(race.id)) {
                          remove(RACES.id, race.id)
                          gone.add(race.id)
                        }
                      }

                      /* And the results of the races that just went, because a result
                         of a race that does not exist still counts in the standings
                         and in the boards. Measured by a round before this was here:
                         an event with twelve races saved as a gathering deleted all
                         twelve and left thirteen results behind.
                       *
                         Not asked of the owner, because it follows from what the
                         portal already does at both of its other mass deletions: the
                         row that removes an event and the button on the event's own
                         page each take the results down with the races, and each says
                         why. Written here in the same shape, including the one guard
                         those two carry: while two events answer at one address there
                         is no telling whose result is whose, so the results are left
                         rather than taken with somebody else's. */
                      /* The address is read off the record and not off the values:
                         it is derived rather than asked for, so the form carries no
                         `slug` at all. Written out of the values it was `undefined`,
                         nothing matched it, and every result stayed while the races
                         went. Changing the kind does not move the address, so the
                         record's own is the one the results point at. */
                      const address = String(openEvent?.slug ?? '')
                      const shares =
                        address === '' ||
                        all.some((each) => String(each.id) !== written && each.slug === address)

                      const byAddress =
                        kindOf(values) === 'race' || shares
                          ? []
                          : allResults.filter((each) => each.eventSlug === address)

                      /* And by the race rather than by the address, which is what a
                         single row deleted from the table needs. The sweep above only
                         fires where the event stops being a race, so a race taken off
                         an event that stays a race left its results behind, each still
                         counting in the standings and pointing at a race that is gone.
                         Measured on a live event: delete one of two race rows, save,
                         and both results are still there. Owner, 24.08.2026: „Brisanje
                         trke treba da pobriše i njene rezultate."

                         No `shares` guard on this route, and that is not an omission.
                         The guard above exists because one address can answer for two
                         events and there is then no telling whose result is whose; a
                         race identity answers for one race, so a result that names it
                         is that race's and nobody else's.

                         Gathered into one set rather than removed twice: a save that
                         turns an event with races into a gathering walks both routes
                         over the same records. */
                      const taken = new Set(byAddress.map((each) => each.id))

                      for (const result of allResults) {
                        if (gone.has(result.raceId)) {
                          taken.add(result.id)
                        }
                      }

                      for (const id of taken) {
                        remove(RESULTS, id)
                      }

                      /* Counted up from the highest number already used, over every
                         race that exists rather than over what this visit made
                         (`raceIds.ts`). Counted rather than measured, it handed a
                         new race the number a deleted one had freed and two records
                         answered to one id. */
                      let next = nextNumber(
                        allRaces.map((one) => String(one.id)),
                        `${written}-trka-`,
                      )

                      for (const row of kindOf(values) === 'race' ? current : []) {
                        if (row.id === '') {
                          create(RACES.id, `${written}-trka-${String(next)}`, storedRow(row, written))
                          next += 1
                        } else {
                          editRecord(row.id, storedRow(row, written))
                        }
                      }

                    }}
                    /**
                     * The event follows its first morning (owner, 10.08.2026): its
                     * date is the day it begins, so a race entered on an earlier
                     * one makes that day the event's.
                     *
                     * Folded into the values rather than written over the record
                     * afterwards, because the address is derived from the date and
                     * the confirmation is drawn from the values: moved after the
                     * fact, the screen said „Datum 30/01/2027 … Adresa
                     * podgoricka-desetka-2027" over a record filed on 30.12.2026,
                     * and the address kept a year the event was no longer in.
                     * Measured 23.08.2026.
                     */
                    alsoFolds={(values) => {
                      /* And only where there are races to follow. A gathering or a
                         training has none, and the same press that saves it takes
                         the rows away, so a row still standing must not decide the
                         day.

                         Measured by a round before this line was here: an event on
                         16/01/2027 saved as a gathering with 15/11/2027 typed in
                         kept 16/01/2027, because the earliest race said so, and the
                         address is derived from the date, so a year's difference
                         left the event answering at the wrong one. The day a person
                         typed was overruled by a race that press deleted. */
                      const first = (kindOf(values) === 'race' ? current : [])
                        .map((row) => isoDate(row.date))
                        .filter((day) => day !== '')
                        .sort()[0]

                      return first === undefined || first === isoDate(String(values.date))
                        ? values
                        : { ...values, date: fieldDate(first) }
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
